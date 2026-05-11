const mysql = require("mysql2/promise");
const {
  REQUIRED_SUMMARY_TERMS,
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

async function main() {
  const connection = await mysql.createConnection(datasource());
  const [rows] = await connection.query(
    `SELECT
       n.id AS news_id,
       s.source_code,
       s.name AS source_name,
       s.site_url,
       s.crawl_rule_json,
       s.active AS source_active,
       s.whitelist_entity_id,
       v.title,
       v.summary,
       v.original_url,
       v.published_at,
       v.keywords_json,
       v.is_guangxi_related,
       v.language,
       v.url_status,
       v.body_text
     FROM news n
     JOIN news_versions v ON n.current_version_id = v.id
     JOIN sources s ON n.source_id = s.id
     ORDER BY n.id`,
  );
  const [sourceRows] = await connection.query(
    `SELECT
       s.source_code AS sourceCode,
       s.name,
       s.language,
       COUNT(*) AS total
     FROM news n
     JOIN news_versions v ON n.current_version_id = v.id
     JOIN sources s ON n.source_id = s.id
     GROUP BY s.id
     ORDER BY total DESC
     LIMIT 20`,
  );
  await connection.end();

  const whitelistTerms = whitelist();
  const keywords = coreTerms();
  const quality = {
    total: rows.length,
    badDate: 0,
    badSource: 0,
    sourceUrlDomainMismatch: 0,
    badUrlStatus: 0,
    notDetailUrl: 0,
    bodyMissing: 0,
    summaryNotFromBody: 0,
    summaryRequiredTermMissing: 0,
    bodyRelevanceFailed: 0,
    zhCount: 0,
    guangxiRelatedCount: 0,
    verifiedAccessibleCurrentCount: 0,
    qualifiedUniqueNews: 0,
  };

  for (const row of rows) {
    const badSource = Number(row.source_active) !== 1
      || !row.whitelist_entity_id
      || !whitelistTerms.byId.has(row.whitelist_entity_id);
    const bodyRelevant = checkBodyRelevance(row, whitelistTerms, keywords, row.body_text).ok;
    const rowOk = inRange(row.published_at)
      && !badSource
      && sourceUrlAllowed(row)
      && isDetailUrl(row.original_url)
      && row.url_status === "accessible"
      && Boolean(row.body_text)
      && summaryFromBody(row.summary, row.body_text)
      && hasRequiredSummaryTerm(row.summary)
      && bodyRelevant;

    if (!inRange(row.published_at)) quality.badDate++;
    if (badSource) quality.badSource++;
    if (!sourceUrlAllowed(row)) quality.sourceUrlDomainMismatch++;
    if (row.url_status !== "accessible") quality.badUrlStatus++;
    if (!isDetailUrl(row.original_url)) quality.notDetailUrl++;
    if (!row.body_text) quality.bodyMissing++;
    if (!summaryFromBody(row.summary, row.body_text)) quality.summaryNotFromBody++;
    if (!hasRequiredSummaryTerm(row.summary)) quality.summaryRequiredTermMissing++;
    if (!bodyRelevant) quality.bodyRelevanceFailed++;
    if (row.language === "zh") quality.zhCount++;
    if (Number(row.is_guangxi_related) === 1) quality.guangxiRelatedCount++;
    if (row.url_status === "accessible") quality.verifiedAccessibleCurrentCount++;
    if (rowOk) quality.qualifiedUniqueNews++;
  }

  console.log(JSON.stringify({
    quality,
    requiredSummaryTerms: REQUIRED_SUMMARY_TERMS,
    topSources: sourceRows,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
