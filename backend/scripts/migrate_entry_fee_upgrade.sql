-- ============================================
-- Migration: Entry Fee Upgrade (3 modes)
-- Run this SQL on your MySQL database
-- ============================================

-- 1. เพิ่มคอลัมน์ fee_type ในตาราง entry_fees
ALTER TABLE entry_fees 
  ADD COLUMN fee_type ENUM('slip','cash','backdate') NOT NULL DEFAULT 'slip';

-- 2. เพิ่มคอลัมน์ backdate ในตาราง entry_fees
ALTER TABLE entry_fees 
  ADD COLUMN backdate DATE NULL;

-- 3. เพิ่มคอลัมน์ entry_fee_status ในตาราง customers
ALTER TABLE customers 
  ADD COLUMN entry_fee_status VARCHAR(50) NULL;

-- 4. เพิ่มคอลัมน์ entry_fee_date ในตาราง customers
ALTER TABLE customers 
  ADD COLUMN entry_fee_date DATETIME NULL;

-- 5. อัปเดต entry_fees เดิมที่มี image_path = 'รับหน้างาน' ให้เป็น fee_type = 'cash'
UPDATE entry_fees SET fee_type = 'cash' WHERE image_path = 'รับหน้างาน';

-- ============================================
-- Done! ระบบค่าแรกเข้า 3 ตัวเลือกพร้อมใช้งาน
-- ============================================
