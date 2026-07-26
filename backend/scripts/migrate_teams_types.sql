-- Teams: type / leader / oil flag
-- Safe to re-run; ignore duplicate column errors.

ALTER TABLE `teams`
  ADD COLUMN `team_type` ENUM('office_install','office_ma','contractor_install','contractor_ma') NOT NULL DEFAULT 'office_install';

ALTER TABLE `teams`
  ADD COLUMN `leader_user_id` INT NULL;

ALTER TABLE `teams`
  ADD COLUMN `counts_for_oil` TINYINT(1) NOT NULL DEFAULT 1;

ALTER TABLE `teams`
  ADD COLUMN `vehicle_plate` VARCHAR(32) NULL;

ALTER TABLE `teams`
  ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1;

ALTER TABLE `teams`
  ADD COLUMN `notes` VARCHAR(255) NULL;

ALTER TABLE `teams`
  ADD INDEX `idx_teams_leader` (`leader_user_id`);

UPDATE `teams` SET `counts_for_oil` = CASE
  WHEN `team_type` IN ('contractor_install','contractor_ma') THEN 0
  ELSE 1
END;
