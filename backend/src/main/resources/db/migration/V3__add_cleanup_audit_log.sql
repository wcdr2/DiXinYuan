CREATE TABLE cleanup_audit_log (
  id BIGINT NOT NULL AUTO_INCREMENT,
  cleanup_type VARCHAR(40) NOT NULL,
  criteria_json JSON NOT NULL,
  dry_run TINYINT(1) NOT NULL DEFAULT 0,
  deleted_news_count INT NOT NULL DEFAULT 0,
  deleted_versions_count INT NOT NULL DEFAULT 0,
  audit_report_path VARCHAR(512) NULL,
  started_at DATETIME(3) NOT NULL,
  finished_at DATETIME(3) NULL,
  status VARCHAR(30) NOT NULL,
  error_message TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_cleanup_audit_log_type (cleanup_type),
  KEY idx_cleanup_audit_log_started_at (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
