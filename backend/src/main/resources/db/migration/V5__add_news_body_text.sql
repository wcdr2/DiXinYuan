ALTER TABLE news_versions
  ADD COLUMN body_text MEDIUMTEXT NULL AFTER final_url;
