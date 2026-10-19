-- Additive LINE import schema. Run explicitly; never through unauthenticated routes.
CREATE TABLE IF NOT EXISTS line_settings (id INT PRIMARY KEY, auto_enabled TINYINT NOT NULL DEFAULT 0);
INSERT IGNORE INTO line_settings(id,auto_enabled) VALUES(1,0);
CREATE TABLE IF NOT EXISTS line_groups (source_id VARCHAR(191) PRIMARY KEY, team_id INT NOT NULL, enabled TINYINT NOT NULL DEFAULT 0, updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6));
CREATE TABLE IF NOT EXISTS line_bindings (line_user_id VARCHAR(191) PRIMARY KEY, user_id INT NOT NULL UNIQUE, updated_by INT NOT NULL, updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6));
CREATE TABLE IF NOT EXISTS line_product_roles (product_id INT NOT NULL, role VARCHAR(30) NOT NULL, PRIMARY KEY(product_id,role));
CREATE TABLE IF NOT EXISTS line_identities (business_key CHAR(64) PRIMARY KEY);
CREATE TABLE IF NOT EXISTS line_events (event_id VARCHAR(191) PRIMARY KEY, payload LONGTEXT NOT NULL, allow_auto TINYINT NOT NULL DEFAULT 0, received_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), state VARCHAR(20) NOT NULL DEFAULT 'pending', attempts INT NOT NULL DEFAULT 0, next_attempt_at DATETIME(6) NULL, error_code VARCHAR(100) NULL, KEY work(state,next_attempt_at));
CREATE TABLE IF NOT EXISTS line_records (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, event_id VARCHAR(191) NULL, message_id VARCHAR(191) NULL, source_id VARCHAR(191) NOT NULL DEFAULT '', line_user_id VARCHAR(191) NOT NULL DEFAULT '',
 source VARCHAR(20) NOT NULL, tech_id INT NULL, team_id INT NULL, job_kind VARCHAR(10) NULL, job_id INT NULL,
 type VARCHAR(30) NOT NULL, job_date DATE NULL, case_no VARCHAR(100) NOT NULL DEFAULT '', order_no VARCHAR(100) NOT NULL DEFAULT '', srt VARCHAR(100) NOT NULL DEFAULT '', customer VARCHAR(255) NOT NULL DEFAULT '',
 raw_text LONGTEXT NOT NULL, parsed_json LONGTEXT NOT NULL, dedupe_key CHAR(64) NOT NULL UNIQUE, business_key CHAR(64) NOT NULL,
 status VARCHAR(30) NOT NULL DEFAULT 'review', version INT NOT NULL DEFAULT 1, conflict_with BIGINT NULL, reason TEXT NULL, checks_json LONGTEXT NULL,
 received_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 KEY report_filter(job_date,type,status), KEY business_lookup(business_key), KEY message_lookup(message_id,source_id), KEY job_lookup(job_kind,job_id)
);
CREATE TABLE IF NOT EXISTS line_effects (id BIGINT AUTO_INCREMENT PRIMARY KEY, record_id BIGINT NOT NULL, item_id INT NOT NULL, job_kind VARCHAR(10) NOT NULL, job_id INT NOT NULL, usage_id INT NOT NULL, log_id INT NOT NULL, owner_id INT NULL, tech_id INT NOT NULL, team_id INT NULL, quantity_before DECIMAL(12,2) NOT NULL, quantity_after DECIMAL(12,2) NOT NULL, active_item_id INT NULL UNIQUE, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE KEY record_item(record_id,item_id), KEY job_lookup(job_kind,job_id));
CREATE TABLE IF NOT EXISTS line_audit (id BIGINT AUTO_INCREMENT PRIMARY KEY, record_id BIGINT NULL, actor_id INT NULL, action VARCHAR(50) NOT NULL, detail_json LONGTEXT NOT NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), KEY record_lookup(record_id,id));
CREATE TABLE IF NOT EXISTS line_sheet_outbox (record_id BIGINT PRIMARY KEY, version INT NOT NULL, state VARCHAR(20) NOT NULL DEFAULT 'pending', attempts INT NOT NULL DEFAULT 0, next_attempt_at DATETIME NULL, last_error VARCHAR(100) NULL);

