-- ============================================================
-- Fix contractor inventory summary (office + MA)
-- Run once on MySQL / MariaDB (phpMyAdmin or mysql CLI)
-- ============================================================

-- 1) Allow NoSN / TechBag on office job usage rows
--    (bag equipment without SN used to fail under strict ENUM)
ALTER TABLE `job_used_inventory`
  MODIFY COLUMN `device_role`
  ENUM('SOA','ONU','PB','Mesh','SIM','Cam','NoSN','TechBag') NOT NULL;

-- 2) MA job equipment usage table (if not created yet by first MA complete)
CREATE TABLE IF NOT EXISTS `ma_job_used_inventory` (
  `id`               INT AUTO_INCREMENT PRIMARY KEY,
  `ma_job_id`        INT NOT NULL,
  `inventory_item_id` INT NOT NULL,
  `device_role`      VARCHAR(50) DEFAULT 'NoSN',
  `sn`               VARCHAR(255) DEFAULT NULL,
  `product_name`     VARCHAR(255) DEFAULT NULL,
  `model_name`       VARCHAR(255) DEFAULT NULL,
  `quantity`         DECIMAL(10,2) DEFAULT 1.00,
  `used_at`          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `used_by`          INT DEFAULT NULL,
  KEY `idx_mjui_job` (`ma_job_id`),
  KEY `idx_mjui_item` (`inventory_item_id`),
  KEY `idx_mjui_used_by` (`used_by`),
  KEY `idx_mjui_used_at` (`used_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Optional: speed up date filters on office usage
-- (safe to ignore if index already exists)
-- CREATE INDEX idx_jui_used_by ON job_used_inventory (used_by);
-- CREATE INDEX idx_jui_used_at ON job_used_inventory (used_at);

-- Note (2026-07): MA SN usage writes device_role='SN' into ma_job_used_inventory
-- which is VARCHAR(50) — no ALTER needed for MA SN support.
