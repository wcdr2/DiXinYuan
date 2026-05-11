const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const {
  REQUIRED_SUMMARY_TERMS,
  compliance,
  coreTerms,
  datasource,
  whitelist,
} = require("./news-strict-rules.cjs");

const DRY_RUN = process.argv.includes("--dryRun") || process.argv.includes("--dry-run");
const VERIFY_URLS = !process.argv.includes("--skip-verify-urls");
const ALLOW_MASS_DELETE = process.argv.includes("--allow-mass-delete");
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 15000);
const CONCURRENCY = Number(process.env.URL_VERIFY_CONCURRENCY || 12);

function csv(value) {
  return `"${String(value ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
}

function timestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

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

async function loadCurrentRows(connection) {
  const [rows] = await connection.query(
    `SELECT
       n.id AS news_id,
       n.news_code,
       n.source_id,
       n.current_version_id,
       v.id AS version_id,
       v.title,
       v.summary,
       v.original_url,
       v.published_at,
       v.keywords_json,
       v.url_status,
       v.body_text,
       s.name AS source_name,
       s.source_code,
       s.site_url,
       s.crawl_rule_json,
       s.active AS source_active,
       s.whitelist_entity_id
     FROM news n
     JOIN news_versions v ON n.current_version_id = v.id
     JOIN sources s ON n.source_id = s.id
     ORDER BY n.id`,
  );
  return rows;
}

async function loadVersions(connection, newsId) {
  const [versions] = await connection.query(
    `SELECT
       v.*,
       n.source_id,
       s.name AS source_name,
       s.source_code,
       s.site_url,
       s.crawl_rule_json,
       s.active AS source_active,
       s.whitelist_entity_id
     FROM news_versions v
     JOIN news n ON v.news_id = n.id
     JOIN sources s ON n.source_id = s.id
     WHERE v.news_id=?
     ORDER BY v.published_at DESC, v.id DESC`,
    [newsId],
  );
  return versions.map((version) => ({
    ...version,
    news_id: newsId,
    version_id: version.id,
  }));
}

async function backfillBodyText(connection, versionId, existingBodyText, bodyText) {
  if (existingBodyText || !bodyText) return false;
  await connection.query("UPDATE news_versions SET body_text=? WHERE id=?", [bodyText, versionId]);
  return true;
}

async function main() {
  const startedAt = new Date();
  const context = {
    whitelistTerms: whitelist(),
    coreKeywords: coreTerms(),
  };
  const connection = await mysql.createConnection(datasource());
  const rows = await loadCurrentRows(connection);
  fs.mkdirSync("target/audit", { recursive: true });
  const reportPath = path.join("target", "audit", `noncompliant-cleanup-${timestamp()}.csv`);
  const lines = ["news_id,news_code,version_id,source_code,title,published_at,original_url,body_text_length,reasons,will_delete"];

  const checked = await mapLimit(rows, VERIFY_URLS ? CONCURRENCY : 1, async (row) => {
    const result = await compliance(row, context, { verifyUrls: VERIFY_URLS, timeoutMs: REQUEST_TIMEOUT_MS });
    return { row, result };
  });

  const decisions = [];
  const bodyBackfills = [];
  for (const item of checked) {
    const { row, result } = item;
    lines.push([
      row.news_id,
      row.news_code,
      row.version_id,
      row.source_code,
      csv(row.title),
      row.published_at ? new Date(row.published_at).toISOString() : "",
      csv(row.original_url),
      result.bodyText ? result.bodyText.length : 0,
      csv(result.reasons.join(";")),
      !result.qualified,
    ].join(","));
    if (result.qualified) {
      if (!row.body_text && result.bodyText) bodyBackfills.push({ versionId: row.version_id, bodyText: result.bodyText });
    } else {
      decisions.push(item);
    }
  }
  fs.writeFileSync(reportPath, `${lines.join("\n")}\n`, "utf8");

  const inaccessibleOnlyFromPreviouslyAccessible = decisions.filter(({ row, result }) =>
    row.url_status === "accessible"
    && result.reasons.length === 1
    && result.reasons[0] === "original_url_inaccessible"
  ).length;
  const likelyVerifierOutage = VERIFY_URLS
    && rows.length >= 20
    && decisions.length / rows.length >= 0.5
    && decisions.length > 0
    && inaccessibleOnlyFromPreviouslyAccessible / decisions.length >= 0.8;
  if (!DRY_RUN && likelyVerifierOutage && !ALLOW_MASS_DELETE) {
    await connection.end();
    console.error(JSON.stringify({
      aborted: true,
      reason: "url_verifier_outage_guard",
      reportPath,
      scanned: rows.length,
      noncompliantCurrentNews: decisions.length,
      inaccessibleOnlyFromPreviouslyAccessible,
      hint: "Live URL verification failed for most previously accessible rows. Re-run with --allow-mass-delete only after confirming the verifier/network is healthy.",
    }, null, 2));
    process.exit(2);
  }

  let deletedNewsCount = 0;
  let deletedVersionsCount = 0;
  let updatedNewsCount = 0;
  let bodyTextBackfilledCount = 0;

  if (!DRY_RUN) {
    await connection.beginTransaction();
    try {
      for (const item of bodyBackfills) {
        if (await backfillBodyText(connection, item.versionId, "", item.bodyText)) {
          bodyTextBackfilledCount++;
        }
      }

      for (const decision of decisions) {
        const versions = await loadVersions(connection, decision.row.news_id);
        let validVersion = null;
        let validResult = null;
        for (const version of versions) {
          const versionResult = await compliance(version, context, { verifyUrls: VERIFY_URLS, timeoutMs: REQUEST_TIMEOUT_MS });
          if (versionResult.qualified) {
            validVersion = version;
            validResult = versionResult;
            break;
          }
        }
        if (validVersion) {
          await connection.query("UPDATE news SET current_version_id=?, updated_at=NOW(3) WHERE id=?", [
            validVersion.id,
            decision.row.news_id,
          ]);
          updatedNewsCount++;
          if (await backfillBodyText(connection, validVersion.id, validVersion.body_text, validResult.bodyText)) {
            bodyTextBackfilledCount++;
          }
          const invalidVersionIds = [];
          for (const version of versions) {
            if (version.id === validVersion.id) continue;
            const versionResult = await compliance(version, context, { verifyUrls: VERIFY_URLS, timeoutMs: REQUEST_TIMEOUT_MS });
            if (!versionResult.qualified) invalidVersionIds.push(version.id);
          }
          if (invalidVersionIds.length) {
            await connection.query("DELETE FROM news_versions WHERE id IN (?)", [invalidVersionIds]);
            deletedVersionsCount += invalidVersionIds.length;
          }
          continue;
        }
        await connection.query("DELETE FROM news_versions WHERE news_id=?", [decision.row.news_id]);
        deletedVersionsCount += versions.length;
        await connection.query("DELETE FROM news WHERE id=?", [decision.row.news_id]);
        deletedNewsCount++;
      }

      await connection.query(
        `INSERT INTO cleanup_audit_log(cleanup_type,criteria_json,dry_run,deleted_news_count,deleted_versions_count,audit_report_path,started_at,finished_at,status)
         VALUES('noncompliant',?,?,?,?,?,?,NOW(3),'completed')`,
        [
          JSON.stringify({
            minimumPublishedAt: "2024-01-01T00:00:00+08:00",
            verifyUrls: VERIFY_URLS,
            requiredSummaryTerms: REQUIRED_SUMMARY_TERMS,
            requiresSummaryFromBody: true,
            requiresBodyRelevance: true,
          }),
          0,
          deletedNewsCount,
          deletedVersionsCount,
          reportPath,
          startedAt.toISOString().slice(0, 19).replace("T", " "),
        ],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  }

  await connection.end();
  console.log(JSON.stringify({
    dryRun: DRY_RUN,
    verifyUrls: VERIFY_URLS,
    reportPath,
    scanned: rows.length,
    noncompliantCurrentNews: decisions.length,
    deletedNewsCount,
    deletedVersionsCount,
    updatedNewsCount,
    bodyTextBackfilledCount,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
