-- ============================================================
--  BOU — Operations Management System
--  Complete Database Schema (Consolidated)
--  Tables: 28 | Engine: InnoDB | Charset: utf8mb4_unicode_ci
--  Generated: 2026-06-06
--  Compatible with: MySQL 8.0+ / MariaDB 10.4+
-- ============================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";
SET NAMES utf8mb4;

-- ============================================================
--  CREATE & SELECT DATABASE
-- ============================================================

CREATE DATABASE IF NOT EXISTS `BOU`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `BOU`;

-- ============================================================
--  1. system_settings
--     Stores key-value config: late_time, late_time_ma_technician, etc.
-- ============================================================
CREATE TABLE `system_settings` (
  `setting_key`   VARCHAR(50)  NOT NULL,
  `setting_value` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `system_settings` (`setting_key`, `setting_value`) VALUES
  ('late_time',               '08:30:00'),
  ('late_time_ma_technician', '08:30:00'),
  ('app_name',                'BOU Operations Suite'),
  ('version',                 '1.0.0');

-- ============================================================
--  2. teams
--     Dispatch groups. Each team = one vehicle/crew.
-- ============================================================
CREATE TABLE `teams` (
  `id`        INT(11)      NOT NULL AUTO_INCREMENT,
  `team_name` VARCHAR(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_team_name` (`team_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `teams` (`id`, `team_name`) VALUES
  (1, 'Team Alpha'),
  (2, 'Team Beta');

-- ============================================================
--  3. users
--     All system users. `role` = primary role (legacy compat).
--     Multi-role support via user_roles table below.
-- ============================================================
CREATE TABLE `users` (
  `id`             INT(11)      NOT NULL AUTO_INCREMENT,
  `username`       VARCHAR(50)  NOT NULL,
  `password_hash`  VARCHAR(255) NOT NULL,
  `role` ENUM(
    'super_admin',
    'admin',
    'technician',
    'ma_technician',
    'sales',
    'intern'
  ) NOT NULL DEFAULT 'technician',
  `full_name`      VARCHAR(100) NOT NULL,
  `profile_image`  VARCHAR(255) DEFAULT NULL,
  `status` ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved',
  `team_id`        INT(11)      DEFAULT NULL,
  `allow_late_time` TIME        NOT NULL DEFAULT '08:30:00',
  `created_at`     TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_username` (`username`),
  KEY `idx_users_team` (`team_id`),
  KEY `idx_users_role` (`role`),
  CONSTRAINT `users_fk_team` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default accounts (password: admin123 — bcrypt hash)
INSERT INTO `users` (`id`, `username`, `password_hash`, `role`, `full_name`, `status`, `team_id`) VALUES
  (1, 'superadmin', '$2y$10$77pZhvEFEBMZB/iXgLHAGO5sAZ506MRnmu7odUicNn0Wy4.pGfjqG', 'super_admin', 'System Administrator', 'approved', NULL),
  (2, 'admin',      '$2y$10$77pZhvEFEBMZB/iXgLHAGO5sAZ506MRnmu7odUicNn0Wy4.pGfjqG', 'admin',       'General Admin',        'approved', NULL),
  (3, 'tech1',      '$2y$10$77pZhvEFEBMZB/iXgLHAGO5sAZ506MRnmu7odUicNn0Wy4.pGfjqG', 'technician',  'John Technician',      'approved', 1),
  (4, 'matech1',    '$2y$10$77pZhvEFEBMZB/iXgLHAGO5sAZ506MRnmu7odUicNn0Wy4.pGfjqG', 'ma_technician','MA Technician One',   'approved', 2);

-- ============================================================
--  4. user_roles
--     Junction: one user → many roles simultaneously.
--     Replaces single-column `role` for multi-role scenarios.
-- ============================================================
CREATE TABLE `user_roles` (
  `id`         INT(11)     NOT NULL AUTO_INCREMENT,
  `user_id`    INT(11)     NOT NULL,
  `role`       VARCHAR(50) NOT NULL,
  `created_at` TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_role` (`user_id`, `role`),
  KEY `idx_user_roles_user` (`user_id`),
  CONSTRAINT `user_roles_fk_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sync primary roles into user_roles
INSERT INTO `user_roles` (`user_id`, `role`) VALUES
  (1, 'super_admin'),
  (2, 'admin'),
  (3, 'technician'),
  (4, 'ma_technician');

-- ============================================================
--  5. vehicles
--     Company vehicles. linked to last assigned technician.
-- ============================================================
CREATE TABLE `vehicles` (
  `id`            INT(11)     NOT NULL AUTO_INCREMENT,
  `license_plate` VARCHAR(20) NOT NULL,
  `last_tech_id`  INT(11)     DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_license_plate` (`license_plate`),
  KEY `idx_vehicles_tech` (`last_tech_id`),
  CONSTRAINT `vehicles_fk_tech` FOREIGN KEY (`last_tech_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `vehicles` (`license_plate`, `last_tech_id`) VALUES
  ('กก 1234', 3),
  ('ขข 5678', 4);

-- ============================================================
--  6. checkins
--     Standard technician daily attendance.
--     Checkout updates the SAME row (upsert by user_id + date).
-- ============================================================
CREATE TABLE `checkins` (
  `id`              INT(11)      NOT NULL AUTO_INCREMENT,
  `user_id`         INT(11)      NOT NULL,
  `image_path`      VARCHAR(255) NOT NULL            COMMENT 'Check-in selfie filename',
  `checkin_time`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `checkin_lat`     DECIMAL(10,8) DEFAULT NULL,
  `checkin_lng`     DECIMAL(11,8) DEFAULT NULL,
  `is_late`         TINYINT(1)   NOT NULL DEFAULT 0  COMMENT '1 = arrived after late_time threshold',
  `checkout_time`   TIMESTAMP    NULL DEFAULT NULL,
  `checkout_image`  VARCHAR(255) DEFAULT NULL        COMMENT 'Check-out selfie filename',
  `checkout_lat`    DECIMAL(10,8) DEFAULT NULL,
  `checkout_lng`    DECIMAL(11,8) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_checkins_user` (`user_id`),
  KEY `idx_checkins_time` (`checkin_time`),
  CONSTRAINT `checkins_fk_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  7. ma_checkins
--     Separate check-in table for MA Technicians.
--     Compared against late_time_ma_technician in system_settings.
-- ============================================================
CREATE TABLE `ma_checkins` (
  `id`           INT(11)      NOT NULL AUTO_INCREMENT,
  `user_id`      INT(11)      NOT NULL,
  `image_path`   VARCHAR(255) NOT NULL,
  `checkin_time` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `checkin_lat`  DECIMAL(10,8) DEFAULT NULL,
  `checkin_lng`  DECIMAL(11,8) DEFAULT NULL,
  `is_late`      TINYINT(1)   NOT NULL DEFAULT 0,
  `checkout_time`  TIMESTAMP  NULL DEFAULT NULL,
  `checkout_image` VARCHAR(255) DEFAULT NULL,
  `checkout_lat`   DECIMAL(10,8) DEFAULT NULL,
  `checkout_lng`   DECIMAL(11,8) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ma_checkin_user` (`user_id`),
  KEY `idx_ma_checkin_time` (`checkin_time`),
  CONSTRAINT `ma_checkins_fk_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  8. products
--     Product catalog (e.g., Router, ONT, CPE).
-- ============================================================
CREATE TABLE `products` (
  `id`           INT(11)     NOT NULL AUTO_INCREMENT,
  `product_code` VARCHAR(50) NOT NULL,
  `name`         VARCHAR(150) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_product_code` (`product_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  9. product_models
--     Sub-models under each product (e.g., "Huawei EG8145V5").
-- ============================================================
CREATE TABLE `product_models` (
  `id`         INT(11)      NOT NULL AUTO_INCREMENT,
  `product_id` INT(11)      NOT NULL,
  `model_name` VARCHAR(100) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_pm_product` (`product_id`),
  CONSTRAINT `product_models_fk_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 10. inventory_consumable
--     Non-serialized stock (cables, clips, connectors, etc.)
--     Global warehouse stock level tracked here.
-- ============================================================
CREATE TABLE `inventory_consumable` (
  `id`           VARCHAR(50)  NOT NULL COMMENT 'Short code, e.g. CABLE-UTP-5M',
  `product_name` VARCHAR(150) NOT NULL,
  `qty`          DECIMAL(10,2) DEFAULT 0.00,
  `unit`         VARCHAR(50)  DEFAULT 'ชิ้น',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 11. inventory_consumable_logs
--     Movement audit for consumables (in/out/transfer/used).
-- ============================================================
CREATE TABLE `inventory_consumable_logs` (
  `id`             INT(11)      NOT NULL AUTO_INCREMENT,
  `consumable_id`  VARCHAR(50)  NOT NULL,
  `action`         ENUM('in','out','transfer','used') NOT NULL,
  `qty`            DECIMAL(10,2) NOT NULL,
  `admin_id`       INT(11)      NOT NULL,
  `target_user_id` INT(11)      DEFAULT NULL COMMENT 'Recipient tech when action=transfer',
  `user_id`        INT(11)      DEFAULT NULL COMMENT 'Tech who consumed (action=used)',
  `note`           VARCHAR(255) DEFAULT NULL,
  `timestamp`      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_icl_consumable` (`consumable_id`),
  KEY `idx_icl_admin`      (`admin_id`),
  KEY `idx_icl_target`     (`target_user_id`),
  KEY `idx_icl_user`       (`user_id`),
  CONSTRAINT `icl_fk_consumable`  FOREIGN KEY (`consumable_id`)  REFERENCES `inventory_consumable` (`id`) ON DELETE CASCADE,
  CONSTRAINT `icl_fk_admin`       FOREIGN KEY (`admin_id`)       REFERENCES `users` (`id`),
  CONSTRAINT `icl_fk_target_user` FOREIGN KEY (`target_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `icl_fk_user`        FOREIGN KEY (`user_id`)        REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 12. inventory_items
--     Serialized (SN) items. status tracks lifecycle.
-- ============================================================
CREATE TABLE `inventory_items` (
  `id`       INT(11)     NOT NULL AUTO_INCREMENT,
  `model_id` INT(11)     NOT NULL,
  `sn`       VARCHAR(100) NOT NULL,
  `status`   ENUM('in_stock','outbound','used') NOT NULL DEFAULT 'in_stock',
  `remark`   TEXT         DEFAULT NULL,
  `added_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sn` (`sn`),
  KEY `idx_ii_model`  (`model_id`),
  KEY `idx_ii_status` (`status`),
  CONSTRAINT `inventory_items_fk_model` FOREIGN KEY (`model_id`) REFERENCES `product_models` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 13. inventory_logs
--     Movement audit for serialized items (in/out/transfer/used).
-- ============================================================
CREATE TABLE `inventory_logs` (
  `id`             INT(11)  NOT NULL AUTO_INCREMENT,
  `item_id`        INT(11)  NOT NULL,
  `action`         ENUM('in','out','transfer','used') NOT NULL,
  `admin_id`       INT(11)  NOT NULL,
  `target_user_id` INT(11)  DEFAULT NULL COMMENT 'Recipient tech (transfer)',
  `user_id`        INT(11)  DEFAULT NULL COMMENT 'Tech who used item (used)',
  `receiver_id`    INT(11)  DEFAULT NULL,
  `note`           VARCHAR(255) DEFAULT NULL,
  `timestamp`      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_il_item`    (`item_id`),
  KEY `idx_il_admin`   (`admin_id`),
  KEY `idx_il_target`  (`target_user_id`),
  KEY `idx_il_user`    (`user_id`),
  KEY `idx_il_receiver`(`receiver_id`),
  CONSTRAINT `il_fk_item`        FOREIGN KEY (`item_id`)        REFERENCES `inventory_items` (`id`),
  CONSTRAINT `il_fk_admin`       FOREIGN KEY (`admin_id`)       REFERENCES `users` (`id`),
  CONSTRAINT `il_fk_target_user` FOREIGN KEY (`target_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `il_fk_user`        FOREIGN KEY (`user_id`)        REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `il_fk_receiver`    FOREIGN KEY (`receiver_id`)    REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 14. user_consumables
--     Each tech's personal bag stock of consumables.
--     Incremented on transfer, decremented on use.
-- ============================================================
CREATE TABLE `user_consumables` (
  `id`            INT(11)     NOT NULL AUTO_INCREMENT,
  `user_id`       INT(11)     NOT NULL,
  `consumable_id` VARCHAR(50) NOT NULL,
  `qty`           DECIMAL(10,2) DEFAULT 0.00,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_consumable` (`user_id`, `consumable_id`),
  KEY `idx_uc_consumable` (`consumable_id`),
  CONSTRAINT `uc_fk_user`       FOREIGN KEY (`user_id`)       REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `uc_fk_consumable` FOREIGN KEY (`consumable_id`) REFERENCES `inventory_consumable` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 15. jobs
--     Standard ISP/Install dispatch jobs. Assigned to a team.
-- ============================================================
CREATE TABLE `jobs` (
  `id`                        INT(11)      NOT NULL AUTO_INCREMENT,
  `plan_arrival_date`         DATE         DEFAULT NULL,
  `plan_arrival_time`         DATETIME     DEFAULT NULL,
  `access_no`                 VARCHAR(50)  NOT NULL COMMENT 'ISP access/order number',
  `customer`                  VARCHAR(150) DEFAULT NULL,
  `phone`                     VARCHAR(100) DEFAULT NULL,
  `package`                   VARCHAR(150) DEFAULT NULL,
  `address`                   TEXT         DEFAULT NULL,
  `field_engineer_id`         INT(11)      DEFAULT NULL,
  `reject_reason`             TEXT         DEFAULT NULL,
  `task_status`               VARCHAR(50)  DEFAULT NULL COMMENT 'New/Existing/Done',
  `product`                   VARCHAR(150) DEFAULT NULL,
  `lat`                       DECIMAL(10,8) DEFAULT NULL,
  `lng`                       DECIMAL(11,8) DEFAULT NULL,
  `order_no`                  VARCHAR(50)  DEFAULT NULL,
  `called_assigner`           VARCHAR(150) DEFAULT 'None Call',
  `called_engineer`           VARCHAR(150) DEFAULT 'None Call',
  `task_order`                VARCHAR(50)  DEFAULT NULL,
  `product_owner`             VARCHAR(150) DEFAULT NULL,
  `order_type`                VARCHAR(100) DEFAULT NULL,
  `install_device`            VARCHAR(150) DEFAULT NULL,
  `service_note`              TEXT         DEFAULT NULL,
  `sub_access_mode`           VARCHAR(100) DEFAULT 'N/A',
  `region`                    VARCHAR(50)  DEFAULT 'ROS',
  `task_type`                 VARCHAR(50)  DEFAULT NULL,
  `customer_order_no`         VARCHAR(50)  DEFAULT NULL,
  `contract_team`             VARCHAR(255) DEFAULT 'หจก.โบนัส แอดว้านซ์ (สุราษฎร์ธานี)#Bonus Advance (Surat Thani) - AISPM_Install_Bonus Advance_Bonus Advance (Surat Thani)_1002136_FTH,PLB',
  `team_product_owner`        VARCHAR(150) DEFAULT NULL,
  `province`                  VARCHAR(100) DEFAULT NULL,
  `task_duration`             VARCHAR(50)  DEFAULT NULL,
  `sla_status`                VARCHAR(50)  DEFAULT 'Normal',
  `create_time`               DATETIME     DEFAULT NULL,
  `deadline`                  DATETIME     DEFAULT NULL,
  `set_off_time`              DATETIME     DEFAULT NULL,
  `arrival_time`              DATETIME     DEFAULT NULL,
  `finish_time`               DATETIME     DEFAULT NULL,
  `area_code`                 VARCHAR(50)  DEFAULT NULL,
  `area_name`                 VARCHAR(150) DEFAULT NULL,
  `processing_status`         VARCHAR(50)  DEFAULT NULL,
  `create_user_role`          VARCHAR(50)  DEFAULT NULL,
  `fail_reason`               TEXT         DEFAULT NULL,
  `event`                     VARCHAR(150) DEFAULT NULL,
  `service_level`             VARCHAR(100) DEFAULT NULL,
  `type_of_installation`      VARCHAR(100) DEFAULT NULL,
  `reason_sync_system_failed` TEXT         DEFAULT NULL,
  `status`                    VARCHAR(50)  DEFAULT 'pending' COMMENT 'pending, in_progress, completed, failed, cancelled',
  `remark`                    TEXT         DEFAULT NULL,
  `seq`                       INT(11)      DEFAULT NULL,
  `map_link`                  TEXT         DEFAULT NULL,
  `team_id`                   INT(11)      DEFAULT NULL,
  `completed_at`              TIMESTAMP    NULL DEFAULT NULL,
  `completed_by`              INT(11)      DEFAULT NULL,
  `created_at`                TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_access_no` (`access_no`),
  UNIQUE KEY `uq_customer_order_no` (`customer_order_no`),
  KEY `idx_jobs_team`   (`team_id`),
  KEY `idx_jobs_status` (`status`),
  KEY `idx_jobs_date`   (`plan_arrival_date`),
  CONSTRAINT `jobs_fk_team`         FOREIGN KEY (`team_id`)     REFERENCES `teams` (`id`) ON DELETE SET NULL,
  CONSTRAINT `jobs_fk_completed_by` FOREIGN KEY (`completed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 16. job_logs
--     Audit trail for every status change on a job.
--     Completing a job also triggers syncTeamOilMonth().
-- ============================================================
CREATE TABLE `job_logs` (
  `id`        INT(11)     NOT NULL AUTO_INCREMENT,
  `job_id`    INT(11)     NOT NULL,
  `tech_id`   INT(11)     NOT NULL,
  `status`    VARCHAR(50) NOT NULL COMMENT 'completed, failed, pending, in_progress',
  `remark`    TEXT        DEFAULT NULL,
  `timestamp` TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_jl_job`    (`job_id`),
  KEY `idx_jl_tech`   (`tech_id`),
  KEY `idx_jl_status` (`status`),
  KEY `idx_jl_tech_date` (`tech_id`, `timestamp`),
  KEY `idx_jl_job_status`(`job_id`, `status`),
  CONSTRAINT `job_logs_fk_job`  FOREIGN KEY (`job_id`)  REFERENCES `jobs` (`id`) ON DELETE CASCADE,
  CONSTRAINT `job_logs_fk_tech` FOREIGN KEY (`tech_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 17. ma_jobs
--     MA (Maintenance Agreement) jobs — separate dispatch flow.
--     Supports AIS/3BB area providers and team matching.
-- ============================================================
CREATE TABLE `ma_jobs` (
  `id`                 INT(11)      NOT NULL AUTO_INCREMENT,
  `plan_arrival_date`  DATE         DEFAULT NULL,
  `job_time`           VARCHAR(20)  DEFAULT NULL       COMMENT 'Appointment time',
  `access_no`          VARCHAR(50)  NOT NULL,
  `non_number`         VARCHAR(50)  DEFAULT NULL       COMMENT 'Customer NON reference number',
  `customer`           VARCHAR(150) DEFAULT NULL,
  `phone`              VARCHAR(100) DEFAULT NULL,
  `package`            VARCHAR(150) DEFAULT NULL,
  `address`            TEXT         DEFAULT NULL,
  `status`             VARCHAR(50)  DEFAULT 'pending'  COMMENT 'pending, in_progress, completed, failed, rescheduled',
  `product`            VARCHAR(150) DEFAULT NULL,
  `symptoms`           TEXT         DEFAULT NULL,
  `lat`                DECIMAL(10,8) DEFAULT NULL,
  `lng`                DECIMAL(11,8) DEFAULT NULL,
  `order_no`           VARCHAR(50)  DEFAULT NULL,
  `task_order`         VARCHAR(50)  DEFAULT NULL,
  `task_type`          VARCHAR(50)  DEFAULT NULL,
  `area_provider`      ENUM('AIS','3BB') DEFAULT NULL,
  `remark`             TEXT         DEFAULT NULL,
  `seq`                INT(11)      DEFAULT NULL,
  `map_link`           TEXT         DEFAULT NULL,
  `team_id`            INT(11)      DEFAULT NULL,
  `team_name_import`   VARCHAR(100) DEFAULT NULL       COMMENT 'Team name from Excel import',
  `team_match_status`  ENUM('matched','unmatched') DEFAULT NULL,
  `assigned_user_id`   INT(11)      DEFAULT NULL,
  `completed_at`       TIMESTAMP    NULL DEFAULT NULL,
  `completed_by`       INT(11)      DEFAULT NULL,
  `created_at`         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`         TIMESTAMP    NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_maj_team`       (`team_id`),
  KEY `idx_maj_status`     (`status`),
  KEY `idx_maj_non`        (`non_number`),
  KEY `idx_maj_date`       (`plan_arrival_date`),
  KEY `idx_maj_assigned`   (`assigned_user_id`),
  CONSTRAINT `ma_jobs_fk_team`         FOREIGN KEY (`team_id`)         REFERENCES `teams` (`id`) ON DELETE SET NULL,
  CONSTRAINT `ma_jobs_fk_assigned`     FOREIGN KEY (`assigned_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `ma_jobs_fk_completed_by` FOREIGN KEY (`completed_by`)     REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 18. ma_job_completion_images
--     Evidence photos uploaded when tech completes an MA job.
-- ============================================================
CREATE TABLE `ma_job_completion_images` (
  `id`          INT(11)      NOT NULL AUTO_INCREMENT,
  `ma_job_id`   INT(11)      NOT NULL,
  `image_path`  VARCHAR(255) NOT NULL,
  `uploaded_by` INT(11)      DEFAULT NULL,
  `created_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_mci_job` (`ma_job_id`),
  CONSTRAINT `mci_fk_job`      FOREIGN KEY (`ma_job_id`)   REFERENCES `ma_jobs` (`id`) ON DELETE CASCADE,
  CONSTRAINT `mci_fk_uploader` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 19. ma_job_reschedules
--     Log of reschedule events for MA jobs.
-- ============================================================
CREATE TABLE `ma_job_reschedules` (
  `id`                 INT(11) NOT NULL AUTO_INCREMENT,
  `ma_job_id`          INT(11) NOT NULL,
  `previous_plan_date` DATE    DEFAULT NULL,
  `new_plan_date`      DATE    NOT NULL,
  `remark`             TEXT    DEFAULT NULL,
  `created_by`         INT(11) DEFAULT NULL,
  `created_at`         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_mjr_job` (`ma_job_id`),
  CONSTRAINT `mjr_fk_job`        FOREIGN KEY (`ma_job_id`)  REFERENCES `ma_jobs` (`id`) ON DELETE CASCADE,
  CONSTRAINT `mjr_fk_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 20. ma_customers
--     Unique customer records identified by NON number.
--     Acts as master record for customer history lookups.
-- ============================================================
CREATE TABLE `ma_customers` (
  `id`            INT(11)      NOT NULL AUTO_INCREMENT,
  `non_number`    VARCHAR(50)  NOT NULL COMMENT 'Unique customer reference from ISP',
  `customer_name` VARCHAR(150) DEFAULT NULL,
  `phone`         VARCHAR(100) DEFAULT NULL,
  `address`       TEXT         DEFAULT NULL,
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_non_number` (`non_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 21. ma_customer_history
--     Timeline of all events (import, visit, complete, fail)
--     per customer NON. Drives the Customer History View.
-- ============================================================
CREATE TABLE `ma_customer_history` (
  `id`            INT(11)     NOT NULL AUTO_INCREMENT,
  `customer_id`   INT(11)     NOT NULL,
  `ma_job_id`     INT(11)     DEFAULT NULL,
  `non_number`    VARCHAR(50) NOT NULL COMMENT 'Denormalized for fast query without join',
  `action`        VARCHAR(50) NOT NULL COMMENT 'imported, completed, failed, rescheduled, in_progress',
  `symptoms`      TEXT        DEFAULT NULL,
  `area_provider` VARCHAR(10) DEFAULT NULL,
  `remark`        TEXT        DEFAULT NULL,
  `tech_id`       INT(11)     DEFAULT NULL,
  `team_id`       INT(11)     DEFAULT NULL,
  `action_date`   DATE        DEFAULT NULL,
  `created_at`    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_mch_customer`  (`customer_id`),
  KEY `idx_mch_non`       (`non_number`),
  KEY `idx_mch_job`       (`ma_job_id`),
  KEY `idx_mch_tech`      (`tech_id`),
  KEY `idx_mch_date`      (`action_date`),
  CONSTRAINT `mch_fk_customer` FOREIGN KEY (`customer_id`) REFERENCES `ma_customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `mch_fk_tech`     FOREIGN KEY (`tech_id`)     REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `mch_fk_team`     FOREIGN KEY (`team_id`)     REFERENCES `teams` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 22. team_oil_cases
--     Aggregated job completion counter per team per month.
--     Populated by syncTeamOilMonth() when a job is completed.
--     Used as denominator in: Liters / Cases = L/Job efficiency.
-- ============================================================
CREATE TABLE `team_oil_cases` (
  `id`          INT(11)    NOT NULL AUTO_INCREMENT,
  `team_id`     INT(11)    NOT NULL,
  `year_month`  VARCHAR(7) NOT NULL COMMENT 'Format: YYYY-MM (e.g. 2026-05)',
  `case_count`  INT(11)    NOT NULL DEFAULT 0,
  `created_at`  DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_team_month`  (`team_id`, `year_month`),
  KEY `idx_toc_year_month`    (`year_month`),
  CONSTRAINT `toc_fk_team` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 23. oil_records
--     Fuel fill-up records per technician/vehicle.
--     Numerator in efficiency: SUM(liters) / case_count.
-- ============================================================
CREATE TABLE `oil_records` (
  `id`              INT(11)      NOT NULL AUTO_INCREMENT,
  `tech_id`         INT(11)      NOT NULL,
  `license_plate`   VARCHAR(20)  NOT NULL,
  `liters`          DECIMAL(10,2) NOT NULL,
  `mileage`         INT(11)      NOT NULL  COMMENT 'Odometer reading at fill-up (km)',
  `price_per_liter` DECIMAL(10,2) NOT NULL,
  `total_price`     DECIMAL(10,2) NOT NULL,
  `distance`        DECIMAL(10,2) DEFAULT 0  COMMENT 'km driven since last fill-up',
  `baht_per_km`     DECIMAL(10,2) DEFAULT 0  COMMENT 'Fuel cost per km',
  `filler_name`     VARCHAR(150) DEFAULT NULL COMMENT 'Name of person who filled (can differ from tech)',
  `date_recorded`   DATETIME     DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_or_tech`  (`tech_id`),
  KEY `idx_or_plate` (`license_plate`),
  KEY `idx_or_date`  (`date_recorded`),
  CONSTRAINT `oil_records_fk_tech` FOREIGN KEY (`tech_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 24. oil_images
--     Receipt/evidence images attached to oil records.
-- ============================================================
CREATE TABLE `oil_images` (
  `id`         INT(11)      NOT NULL AUTO_INCREMENT,
  `record_id`  INT(11)      NOT NULL,
  `image_path` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_oi_record` (`record_id`),
  CONSTRAINT `oil_images_fk_record` FOREIGN KEY (`record_id`) REFERENCES `oil_records` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 25. announcements
--     Admin-created pop-up or banner announcements.
-- ============================================================
CREATE TABLE `announcements` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `type` VARCHAR(50) DEFAULT 'info',
  `status` ENUM('active', 'inactive') DEFAULT 'active',
  `expires_at` DATETIME NULL,
  `created_by` INT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 26. issue_reports
--     Field tech submitted bug/issue reports with optional image.
-- ============================================================
CREATE TABLE `issue_reports` (
  `id`         INT(11)     NOT NULL AUTO_INCREMENT,
  `user_id`    INT(11)     NOT NULL,
  `message`    TEXT        DEFAULT NULL,
  `image_url`  VARCHAR(255) DEFAULT NULL,
  `status`     VARCHAR(50) DEFAULT 'pending' COMMENT 'pending, reviewed, resolved',
  `created_at` TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ir_user` (`user_id`),
  KEY `idx_ir_status` (`status`),
  CONSTRAINT `issue_reports_fk_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 27. notifications
--     System-wide or team-targeted push notifications.
-- ============================================================
CREATE TABLE `notifications` (
  `id`         INT(11)      NOT NULL AUTO_INCREMENT,
  `title`      VARCHAR(255) NOT NULL,
  `message`    TEXT         NOT NULL,
  `team_id`    INT(11)      DEFAULT NULL COMMENT 'NULL = broadcast to all',
  `created_by` INT(11)      NOT NULL,
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notif_team`       (`team_id`),
  KEY `idx_notif_created_by` (`created_by`),
  CONSTRAINT `notif_fk_team`       FOREIGN KEY (`team_id`)    REFERENCES `teams` (`id`) ON DELETE SET NULL,
  CONSTRAINT `notif_fk_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 28. notification_reads
--     Tracks which users have read which notifications.
-- ============================================================
CREATE TABLE `notification_reads` (
  `id`              INT(11)   NOT NULL AUTO_INCREMENT,
  `notification_id` INT(11)   NOT NULL,
  `user_id`         INT(11)   NOT NULL,
  `read_at`         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_notif_user` (`notification_id`, `user_id`),
  KEY `idx_nr_user` (`user_id`),
  CONSTRAINT `nr_fk_notification` FOREIGN KEY (`notification_id`) REFERENCES `notifications` (`id`) ON DELETE CASCADE,
  CONSTRAINT `nr_fk_user`         FOREIGN KEY (`user_id`)         REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  VIEWS — Pre-built queries for common analytics
-- ============================================================

-- Oil Efficiency View: L/Job per team per month
CREATE OR REPLACE VIEW `v_oil_efficiency` AS
  SELECT
    t.id            AS team_id,
    t.team_name,
    toc.year_month,
    toc.case_count,
    COALESCE(SUM(ori.liters), 0) AS total_liters,
    CASE
      WHEN toc.case_count > 0
      THEN ROUND(COALESCE(SUM(ori.liters), 0) / toc.case_count, 2)
      ELSE NULL
    END AS liters_per_job
  FROM `team_oil_cases` toc
  JOIN `teams` t ON t.id = toc.team_id
  LEFT JOIN `vehicles` v ON v.last_tech_id IN (
    SELECT id FROM `users` WHERE team_id = toc.team_id
  )
  LEFT JOIN `oil_records` ori
    ON ori.license_plate = v.license_plate
    AND DATE_FORMAT(ori.date_recorded, '%Y-%m') = toc.year_month
  GROUP BY t.id, t.team_name, toc.year_month, toc.case_count;

-- Today's Attendance Summary
CREATE OR REPLACE VIEW `v_today_attendance` AS
  SELECT
    u.id           AS user_id,
    u.full_name,
    u.role,
    u.team_id,
    c.id           AS checkin_id,
    c.checkin_time,
    c.is_late,
    c.checkout_time,
    CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END AS has_checked_in,
    CASE WHEN c.checkout_time IS NOT NULL THEN 1 ELSE 0 END AS has_checked_out
  FROM `users` u
  LEFT JOIN `checkins` c
    ON c.user_id = u.id
    AND DATE(c.checkin_time) = CURDATE()
  WHERE u.status = 'approved';

-- ============================================================
--  COMMIT
-- ============================================================
COMMIT;

-- ============================================================
--  QUICK REFERENCE — Default Login
--  Username: superadmin | Password: admin123
--  Username: admin      | Password: admin123
--  Username: tech1      | Password: admin123
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  has_sn BOOLEAN DEFAULT TRUE,
  prefix VARCHAR(10) NULL COMMENT 'For auto-generating codes',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_models (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  model_name VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES inventory_products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  model_id INT NOT NULL,
  sn VARCHAR(255) UNIQUE NOT NULL,
  quantity DECIMAL(10,2) DEFAULT 1.00,
  status ENUM('in_stock', 'staging', 'dispatched', 'expired') DEFAULT 'in_stock',
  owner_id INT NULL COMMENT 'User ID of technician holding this',
  team_id INT NULL COMMENT 'Team ID',
  dispatched_at DATETIME NULL,
  expires_at DATETIME NULL COMMENT 'dispatched_at + 1 day',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (model_id) REFERENCES inventory_models(id) ON DELETE RESTRICT,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_id INT NOT NULL,
  from_user_id INT NULL,
  to_user_id INT NULL,
  action ENUM('receive', 'dispatch', 'transfer', 'expire') NOT NULL,
  quantity DECIMAL(10,2) DEFAULT 1.00,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
  FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
