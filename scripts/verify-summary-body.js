const mysql = require("mysql2/promise");
const {
  datasource,
  summaryFromBody,
  verifyUrlWithBody,
} = require("./news-strict-rules.cjs");

const CONCURRENCY = Number(process.env.URL_VERIFY_CONCURRENCY || 12);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 15000);
const DELETE_INVALID = process.argv.includes("--delete");

async function mapLimit(items, limit, worker) {
  let index = 0;
  const results = [];
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await worker(items[current], current);
    }
  });
  await Promise.all(workers);
  return results;
}

async function deleteNews(connection, newsIds) {
  if (newsIds.length === 0) return { deletedNews: 0, deletedVersions: 0 };
  const [versionResult] = await connection.query("DELETE FROM news_versions WHERE news_id IN (?)", [newsIds]);
  const [newsResult] = await connection.query("DELETE FROM news WHERE id IN (?)", [newsIds]);
  return { deletedNews: newsResult.affectedRows || 0, deletedVersions: versionResult.affectedRows || 0 };
}

async function main() {
  const connection = await mysql.createConnection(datasource());
  const [rows] = await connection.query(
    `SELECT n.id newsId, v.id versionId, v.title, v.summary, v.original_url originalUrl, v.body_text bodyText
     FROM news n
     JOIN news_versions v ON n.current_version_id = v.id
     ORDER BY n.id`,
  );
  const results = await mapLimit(rows, CONCURRENCY, async (row) => {
    if (String(row.title || "").trim() && String(row.title || "").trim() === String(row.summary || "").trim()) {
      return { newsId: row.newsId, ok: false, reason: "summary_from_title", url: row.originalUrl };
    }
    let bodyText = row.bodyText || "";
    let finalUrl = row.originalUrl;
    if (!bodyText) {
      const verification = await verifyUrlWithBody(row.originalUrl, REQUEST_TIMEOUT_MS);
      if (!verification.accessible) {
        return { newsId: row.newsId, ok: false, reason: "url_inaccessible", url: row.originalUrl };
      }
      bodyText = verification.bodyText;
      finalUrl = verification.finalUrl || row.originalUrl;
    }
    if (!summaryFromBody(row.summary, bodyText)) {
      return { newsId: row.newsId, ok: false, reason: "summary_not_found_in_body", url: row.originalUrl };
    }
    await connection.query(
      "UPDATE news_versions SET body_text=?, url_verified_at=NOW(3), url_status='accessible', final_url=? WHERE id=?",
      [bodyText, finalUrl, row.versionId],
    );
    return { newsId: row.newsId, ok: true, reason: "", url: row.originalUrl };
  });
  const invalid = results.filter((item) => !item.ok);
  const reasonCounts = invalid.reduce((acc, item) => {
    acc[item.reason] = (acc[item.reason] || 0) + 1;
    return acc;
  }, {});
  let deleted = { deletedNews: 0, deletedVersions: 0 };
  if (DELETE_INVALID && invalid.length > 0) {
    await connection.beginTransaction();
    try {
      deleted = await deleteNews(connection, invalid.map((item) => item.newsId));
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  }
  await connection.end();
  console.log(JSON.stringify({
    deleteInvalid: DELETE_INVALID,
    scanned: rows.length,
    valid: results.length - invalid.length,
    invalid: invalid.length,
    reasonCounts,
    deleted,
    samples: invalid.slice(0, 20),
  }, null, 2));
  if (!DELETE_INVALID && invalid.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
