---
name: bount-management-system-guide
description: คู่มือและเอกสารระบบ Bount Back Office (BO) อย่างละเอียด ครอบคลุมโครงสร้าง สถาปัตยกรรม ฐานข้อมูล บทบาทผู้ใช้งาน และขั้นตอนการ Deploy
---

# Bount Management System (BO)

ไฟล์นี้คือ AI Skill Instruction สำหรับให้ AI Agent ใช้ทำความเข้าใจ โครงสร้าง, ลอจิก, และข้อควรระวังต่างๆ ของระบบ Bount (bonusais.com) เพื่อให้สามารถเขียนโค้ดและแก้ไขปัญหาได้อย่างแม่นยำ

## 1. ข้อมูลทั่วไปของระบบ (System Overview)
- **ชื่อโปรเจกต์:** Bount ระบบจัดการงาน
- **เป้าหมาย:** ระบบ Back Office สำหรับจัดการทีมช่างภาคสนาม (Field Service Management), จัดการคลังสินค้า, ลงเวลาเข้าออกงาน และรายงานผลสถิติ
- **Tech Stack:**
  - **Frontend:** React.js (Vite), Tailwind CSS, React Router
  - **Backend:** Node.js, Express.js
  - **Database:** MySQL
- **Root Directory:** `c:\xampp\htdocs\BO\ad\`

## 2. บทบาทและสิทธิ์ผู้ใช้งาน (User Roles & Permissions)
ระบบจัดการสิทธิ์ผ่านคอลัมน์ `role` และ `user_roles` (Extra Roles) ในตาราง `users`:
1. `super_admin` (ผู้ดูแลระบบ): เห็นทุกเมนู มี Super Admin Dashboard จัดการผู้ใช้และภาพรวมทั้งหมด
2. `admin` (แอดมิน): ดูแลจัดการ Dispatch, คลังสินค้า, และสรุปผล MA
3. `technician` (ช่าง Office): ช่างทั่วไป ลงเวลาเข้างานแบบปกติ (เวลาสายตั้งได้แบบ Global หรือรายบุคคล)
4. `ma_technician` (ช่าง MA): ทีมซ่อมบำรุง ระบบลงเวลาจะเชื่อมโยงกับงาน MA วันนั้น (Threshold)
5. `sales` (เซล): ทีมขาย ระบบลงเวลาจะมี **เฉพาะ "เข้างาน"** ไม่มีเลิกงาน
6. `intern` (เด็กฝึกงาน): ผู้ใช้ฝึกหัด

## 3. ระบบหลักที่สำคัญ (Core Features)

### 3.1 ระบบ Authentication & Real-time Status
- ใช้ **JWT (JSON Web Token)** แนบไปกับ Header `Authorization: Bearer <token>`
- **สถานะออนไลน์ (Online/Offline):**
  - ไม่ได้อิงจากการแค่กดเช็คอิน แต่เช็คจาก **การใช้งานระบบจริงๆ (Real-time Usage)**
  - ทุกครั้งที่ยิง API Backend จะอัปเดตเวลาล่าสุดใน `global.activeUsers` (อยู่ที่ `backend/middleware/auth.js`)
  - หากไม่มีการใช้งานเกิน 15 นาที ระบบจะมองว่าออฟไลน์ (`is_online = 0`) ในหน้า Dashboard

### 3.2 ระบบลงเวลาเข้า-ออกงาน (Check-in System)
- อยู่ในหน้า `CheckinPage.jsx`
- ดึงพิกัด GPS อัตโนมัติและเปิดกล้องถ่ายภาพ (ประทับลายน้ำพิกัด+เวลา)
- ระบบจะซ่อนปุ่มบางปุ่มหรือบางแท็บตาม Role อัตโนมัติ (เช่น เซล จะเห็นแค่ปุ่มเข้างาน)

### 3.3 ระบบจ่ายงานและติดตามสถานะ (Dispatch & Timeline)
- แอดมินนำเข้างานด้วยไฟล์ Excel (`jobs` table)
- **Timeline** ของแต่ละงานดึงจาก Timestamp ต่อไปนี้:
  1. `created_at` / `create_time`: สร้างงานในระบบ
  2. `plan_arrival_time`: เวลานัดหมาย
  3. `set_off_time`: ออกเดินทาง
  4. `arrival_time`: ถึงหน้างาน
  5. `finish_time`: ปิดงาน
- เมื่อช่างมอบหมายงาน หรืออัปเดตสถานะในแอป เวลาจะถูกบันทึกลงฟิลด์เหล่านี้ทันที

### 3.4 ระบบคลังสินค้า (Inventory)
- นำเข้าสินค้าด้วย Excel ตาราง `inventory` และ `equipments`
- เบิกจ่ายของให้ทีมช่าง โดยมีหน้า Inventory Dashboard คอยสรุปของคงคลัง

## 4. โครงสร้างโฟลเดอร์ (Directory Structure)
```
BO/ad/
├── backend/                  # Node.js Express API
│   ├── config/               # db.js (เชื่อมต่อ MySQL)
│   ├── middleware/           # auth.js (เช็ค JWT & อัปเดตสถานะ Online)
│   ├── routes/               # API endpoints (auth.js, checkin.js, dispatch.js, stats.js ฯลฯ)
│   ├── uploads/              # เก็บรูปภาพถ่ายเข้างาน และหลักฐานการทำงาน
│   ├── server.js             # Entry point ของ Backend (Port 3001)
│   └── package.json
├── frontend/                 # React.js (Vite)
│   ├── src/
│   │   ├── api/              # axios.js (ตั้งค่า BaseURL ชี้ไปที่ Backend)
│   │   ├── components/       # UI Components เช่น Layout.jsx, Timeline
│   │   ├── context/          # AuthContext.jsx
│   │   ├── pages/            # หน้าเว็บทั้งหมด เช่น AdminDashboard, CheckinPage
│   │   └── index.css         # ไฟล์ CSS หลัก (Tailwind)
│   └── package.json
└── database/
    └── bou_schema.sql        # โครงสร้างตารางฐานข้อมูลล่าสุด
```

## 5. คู่มือการแก้ไขโค้ดและ Deploy
1. **Frontend:**
   - เมื่อทำการแก้ไขไฟล์ในโฟลเดอร์ `frontend/src/` **ต้องสั่ง Build ทุกครั้ง**
   - คำสั่ง: `cd frontend && npm run build` 
   - ระบบจะ Build ไฟล์ไปลง `dist/` หรือถูกเรียกใช้งานผ่าน Server
2. **Backend:**
   - หากแก้ไฟล์ในฝั่ง `backend/` ต้องรีสตาร์ทเซิร์ฟเวอร์
   - สามารถสั่งรีสตาร์ทด้วยคำสั่ง `echo restart > backend/tmp/restart.txt` หรือ restart node process
3. **Database:**
   - ใช้ `mysql2/promise` เป็นหลัก
   - ระวังเรื่องพอร์ตและการเชื่อมต่อ สามารถเช็คค่าจาก `backend/config/db.js`

## 6. ข้อพึงระวังสำหรับ AI (Critical Instructions)
- หากแก้ UI ให้พิจารณาเรื่อง Responsive ด้วยคลาส Tailwind (เช่น `sm:flex-row`, `md:col-span-2`)
- โทนสีหลักของระบบเน้น Glassmorphism (`glass` class), สีฟ้า/น้ำเงิน (Blue/Brand) และมีการเล่น Gradient เพื่อความสวยงาม
- เมื่อผู้ใช้ร้องขอให้เพิ่มระบบใดๆ ต้องเช็ค `users` schema ก่อนเสมอว่ามีฟิลด์รองรับหรือไม่
- **หากแก้ไขหน้าใดๆ บน Frontend ต้องรัน `npm run build` เสมอ เพื่อให้การเปลี่ยนแปลงแสดงผลบน Production (bonusais.com)**
