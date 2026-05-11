const mysql = require("mysql2/promise");
const {
  checkBodyRelevance,
  coreTerms,
  datasource,
  hasRequiredSummaryTerm,
  inRange,
  isDetailUrl,
  sourceUrlAllowed,
  summaryFromBody,
  whitelist,
} = require("./news-strict-rules.cjs");

const FORBIDDEN_SOURCE_CODES = new Set(["gisuser", "spatialsource", "geoawesome", "digital-geography"]);

async function main() {
  const entityIds = whitelist();
  const keywords = coreTerms();
  const connection = await mysql.createConnection(datasource());
  const [rows] = await connection.query(
    `SELECT n.id newsId,
            s.source_code sourceCode,
            s.name source_name,
            s.site_url,
            s.crawl_rule_json,
            s.active source_active,
            s.whitelist_entity_id,
            v.title,
            v.summary,
            v.original_url,
            v.published_at,
            v.keywords_json,
            v.url_status,
            v.body_text
     FROM news n
     JOIN news_versions v ON n.current_version_id = v.id
     JOIN sources s ON n.source_id = s.id
     ORDER BY n.id`,
  );
  await connection.end();

  const problems = [];
  for (const row of rows) {
    if (!inRange(row.published_at)) problems.push([row.newsId, "bad_date"]);
    if (Number(row.source_active) !== 1 || !row.whitelist_entity_id || !entityIds.byId.has(row.whitelist_entity_id)) {
      problems.push([row.newsId, "bad_source_whitelist"]);
    }
    if (!sourceUrlAllowed(row)) problems.push([row.newsId, "source_url_domain_mismatch"]);
    if (row.url_status !== "accessible") problems.push([row.newsId, "bad_url_status"]);
    if (FORBIDDEN_SOURCE_CODES.has(row.sourceCode)) problems.push([row.newsId, "forbidden_source"]);
    if (!isDetailUrl(row.original_url)) problems.push([row.newsId, "not_detail_url"]);
    if (!row.body_text) problems.push([row.newsId, "body_missing"]);
    if (!summaryFromBody(row.summary, row.body_text)) problems.push([row.newsId, "summary_not_from_body"]);
    if (!hasRequiredSummaryTerm(row.summary)) problems.push([row.newsId, "summary_required_term_missing"]);
    if (!checkBodyRelevance(row, entityIds, keywords, row.body_text).ok) problems.push([row.newsId, "body_relevance_failed"]);
    if (String(row.title || "").trim() && String(row.title || "").trim() === String(row.summary || "").trim()) {
      problems.push([row.newsId, "summary_from_title"]);
    }
  }

  const counts = problems.reduce((acc, [, reason]) => {
    acc[reason] = (acc[reason] || 0) + 1;
    return acc;
  }, {});
  const result = {
    total: rows.length,
    qualified: rows.length - new Set(problems.map(([id]) => id)).size,
    problemCount: problems.length,
    problemReasons: counts,
    samples: problems.slice(0, 20).map(([newsId, reason]) => ({ newsId, reason })),
  };
  console.log(JSON.stringify(result, null, 2));
  if (problems.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
