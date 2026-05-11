ALTER TABLE sources
  ADD COLUMN whitelist_entity_id VARCHAR(80) NULL AFTER trust_level,
  ADD KEY idx_sources_whitelist_entity_id (whitelist_entity_id);

ALTER TABLE news_versions
  ADD COLUMN url_verified_at DATETIME(3) NULL AFTER content_hash,
  ADD COLUMN url_status VARCHAR(40) NOT NULL DEFAULT 'unknown' AFTER url_verified_at,
  ADD COLUMN final_url VARCHAR(1024) NULL AFTER url_status,
  ADD KEY idx_news_versions_url_status (url_status);
