CREATE TABLE sources (
  id BIGINT NOT NULL AUTO_INCREMENT,
  source_code VARCHAR(80) NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(40) NOT NULL,
  site_url VARCHAR(1024) NOT NULL,
  language VARCHAR(20) NOT NULL,
  trust_level VARCHAR(20) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  crawl_rule_json JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_sources_source_code (source_code),
  KEY idx_sources_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE crawl_runs (
  id BIGINT NOT NULL AUTO_INCREMENT,
  run_type VARCHAR(40) NOT NULL,
  status VARCHAR(30) NOT NULL,
  started_at DATETIME(3) NOT NULL,
  finished_at DATETIME(3) NULL,
  note TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_crawl_runs_started_at (started_at),
  KEY idx_crawl_runs_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE news (
  id BIGINT NOT NULL AUTO_INCREMENT,
  news_code VARCHAR(64) NOT NULL,
  source_id BIGINT NOT NULL,
  canonical_url VARCHAR(1024) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  current_version_id BIGINT NULL,
  first_seen_at DATETIME(3) NOT NULL,
  last_seen_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_news_code (news_code),
  UNIQUE KEY uk_news_source_url (source_id, canonical_url(512)),
  KEY idx_news_source_id (source_id),
  KEY idx_news_slug (slug),
  KEY idx_news_current_version_id (current_version_id),
  CONSTRAINT fk_news_source FOREIGN KEY (source_id) REFERENCES sources (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE news_versions (
  id BIGINT NOT NULL AUTO_INCREMENT,
  news_id BIGINT NOT NULL,
  crawl_run_id BIGINT NULL,
  title VARCHAR(1024) NOT NULL,
  summary TEXT NOT NULL,
  cover_image TEXT NULL,
  source_url VARCHAR(1024) NOT NULL,
  original_url VARCHAR(1024) NOT NULL,
  published_at DATETIME(3) NOT NULL,
  language VARCHAR(20) NOT NULL,
  category VARCHAR(40) NOT NULL,
  keywords_json JSON NOT NULL,
  region_tags_json JSON NOT NULL,
  entity_ids_json JSON NOT NULL,
  is_guangxi_related TINYINT(1) NOT NULL DEFAULT 0,
  content_hash VARCHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_news_versions_hash (news_id, content_hash),
  KEY idx_news_versions_news_id (news_id),
  KEY idx_news_versions_crawl_run_id (crawl_run_id),
  KEY idx_news_versions_published_at (published_at),
  KEY idx_news_versions_category (category),
  KEY idx_news_versions_guangxi (is_guangxi_related),
  CONSTRAINT fk_news_versions_news FOREIGN KEY (news_id) REFERENCES news (id),
  CONSTRAINT fk_news_versions_crawl_run FOREIGN KEY (crawl_run_id) REFERENCES crawl_runs (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE crawl_run_sources (
  id BIGINT NOT NULL AUTO_INCREMENT,
  crawl_run_id BIGINT NOT NULL,
  source_id BIGINT NOT NULL,
  status VARCHAR(30) NOT NULL,
  fetched_count INT NOT NULL DEFAULT 0,
  published_count INT NOT NULL DEFAULT 0,
  duplicate_count INT NOT NULL DEFAULT 0,
  error_message TEXT NULL,
  note TEXT NULL,
  started_at DATETIME(3) NOT NULL,
  finished_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_crawl_run_sources_run_id (crawl_run_id),
  KEY idx_crawl_run_sources_source_id (source_id),
  CONSTRAINT fk_crawl_run_sources_run FOREIGN KEY (crawl_run_id) REFERENCES crawl_runs (id),
  CONSTRAINT fk_crawl_run_sources_source FOREIGN KEY (source_id) REFERENCES sources (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE dataset_snapshots (
  id BIGINT NOT NULL AUTO_INCREMENT,
  crawl_run_id BIGINT NULL,
  dataset_type VARCHAR(40) NOT NULL,
  payload_json JSON NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_dataset_snapshots_type_created (dataset_type, created_at),
  KEY idx_dataset_snapshots_run_id (crawl_run_id),
  CONSTRAINT fk_dataset_snapshots_run FOREIGN KEY (crawl_run_id) REFERENCES crawl_runs (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
