-- Audit log for office/MA job actions (idempotent)
CREATE TABLE IF NOT EXISTS job_audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  job_type ENUM('office','ma') NOT NULL,
  job_id INT NOT NULL,
  action VARCHAR(50) NOT NULL,
  old_status VARCHAR(50) DEFAULT NULL,
  new_status VARCHAR(50) DEFAULT NULL,
  old_team_id INT DEFAULT NULL,
  new_team_id INT DEFAULT NULL,
  old_assignee_id INT DEFAULT NULL,
  new_assignee_id INT DEFAULT NULL,
  actor_id INT DEFAULT NULL,
  remark TEXT DEFAULT NULL,
  meta_json JSON DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_jal_job (job_type, job_id),
  KEY idx_jal_actor (actor_id),
  KEY idx_jal_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Shared Excel engineer aliases (เจมส์ → user_id)
CREATE TABLE IF NOT EXISTS user_import_aliases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  job_type ENUM('office','ma','any') NOT NULL DEFAULT 'any',
  normalized_alias VARCHAR(150) NOT NULL,
  user_id INT DEFAULT NULL,
  team_id INT DEFAULT NULL,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_alias (job_type, normalized_alias),
  KEY idx_uia_user (user_id),
  KEY idx_uia_team (team_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
