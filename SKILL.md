# 🛠️ System Tech Stack & Comprehensive Overview

เอกสารนี้ถูกสร้างและอัปเดตอัตโนมัติจากโค้ดจริง (Code Analysis)
🕒 **อัปเดตล่าสุด:** 22/6/2569 14:35:15

## 🖥️ Frontend Architecture (React.js / Vite)

### 🗺️ Frontend Routes (`App.jsx`)
* `/login` ➡️ **Login** 🔒
* `/dashboard` ➡️ **UnifiedDashboard** 🔒
* `/jobs` ➡️ **DispatchDashboardPage** 🔒
* `/checkin` ➡️ **CheckinPage** 🔒
* `/oil` ➡️ **OilDashboardPage** 🔒
* `/users` ➡️ **UserManagementPage** 🔒
* `/customers` ➡️ **CustomersPage** 🔒
* `/inventory` ➡️ **InventoryDashboardPage** 🔒
* `/bag` ➡️ **TechBagPage** 🔒
* `/entry-fee` ➡️ **EntryFeePage** 🔒
* `/attendance-summary` ➡️ **AttendanceSummaryPage** 🔒
* `/ma-performance` ➡️ **MaPerformancePage** 🔒
* `/announcements` ➡️ **AnnouncementsPage** 🔒
* `/ais-expansion` ➡️ **AisExpansionPage** 🔒
* `/report` ➡️ **ReportIssuePage** 🔒
* `/` ➡️ **RootRedirect** 
* `*` ➡️ **RootRedirect** 

### 🧩 Components (`frontend/src/components`)
* 📄 AutoDispatchModal.jsx
* 📁 dashboards
* 📄 DateRangeFilter.jsx
* 📄 DateTimePicker.jsx
* 📄 EditJobModal.jsx
* 📄 ExportModal.jsx
* 📄 ImportExcelModal.jsx
* 📄 InboxModal.jsx
* 📄 JobActionModals.jsx
* 📄 JobCard.jsx
* 📄 JobDispatchModal.jsx
* 📄 Layout.jsx
* 📄 ManualCheckinModal.jsx
* 📄 OilRecordEditModal.jsx
* 📄 OilRecordModal.jsx
* 📄 ProfileModal.jsx
* 📄 Sidebar.jsx
* 📄 TargetSettingsModal.jsx
* 📄 TeamManagementModal.jsx
* 📄 TechBagDrawer.jsx
* 📁 ui
* 📄 UserProfileModal.jsx

### 📦 Frontend Dependencies
<details>
  <summary>คลิกเพื่อดู Dependencies ฝั่ง Frontend</summary>

* **@radix-ui/react-popover** (v1.1.16)
* **@radix-ui/react-slot** (v1.2.5)
* **aos** (v2.3.4)
* **axios** (v1.17.0)
* **clsx** (v2.1.1)
* **date-fns** (v3.6.0)
* **iconv-lite** (v0.7.2)
* **leaflet** (v1.9.4)
* **lucide-react** (v1.17.0)
* **ol** (v10.9.0)
* **react** (v19.2.6)
* **react-day-picker** (v8.10.1)
* **react-dom** (v19.2.6)
* **react-is** (v19.2.7)
* **react-leaflet** (v5.0.0)
* **react-router-dom** (v7.17.0)
* **recharts** (v3.8.1)
* **sweetalert2** (v11.26.25)
* **tailwind-merge** (v3.6.0)
* **xlsx** (v0.18.5)
* **@eslint/js** (v10.0.1)
* **@types/react** (v19.2.14)
* **@types/react-dom** (v19.2.3)
* **@vitejs/plugin-react** (v6.0.1)
* **autoprefixer** (v10.5.0)
* **eslint** (v10.3.0)
* **eslint-plugin-react-hooks** (v7.1.1)
* **eslint-plugin-react-refresh** (v0.5.2)
* **globals** (v17.6.0)
* **postcss** (v8.5.15)
* **tailwindcss** (v3.4.19)
* **vite** (v8.0.12)

</details>

## ⚙️ Backend Architecture (Node.js / Express)

### 🔌 API Endpoints (`backend/routes`)
#### 📄 announcements.js
  * `GET` `/api/announcements/active`
  * `GET` `/api/announcements`
  * `POST` `/api/announcements`
  * `PUT` `/api/announcements/:id`
  * `DELETE` `/api/announcements/:id`

#### 📄 auth.js
  * `POST` `/api/auth/login`
  * `GET` `/api/auth/me`
  * `PUT` `/api/auth/change-password`
  * `PUT` `/api/auth/profile-image`

#### 📄 checkin.js
  * `GET` `/api/checkin/migrate-db`
  * `GET` `/api/checkin/ma-threshold`
  * `GET` `/api/checkin/today`
  * `GET` `/api/checkin/ma-performance`
  * `GET` `/api/checkin/history`
  * `GET` `/api/checkin/stats`
  * `GET` `/api/checkin/summary`
  * `GET` `/api/checkin/user/:id/history`
  * `DELETE` `/api/checkin/:id`
  * `PUT` `/api/checkin/admin/edit/:id`

#### 📄 dispatch.js
  * `GET` `/api/dispatch/jobs`
  * `GET` `/api/dispatch/jobs/:id`
  * `PUT` `/api/dispatch/jobs/:id/set-off`
  * `PUT` `/api/dispatch/jobs/:id/arrive`
  * `POST` `/api/dispatch/jobs`
  * `POST` `/api/dispatch/jobs/bulk`
  * `PUT` `/api/dispatch/jobs/bulk-assign`
  * `PUT` `/api/dispatch/jobs/reorder-by-location`
  * `PUT` `/api/dispatch/jobs/:id/assign`
  * `GET` `/api/dispatch/summary`
  * `POST` `/api/dispatch/auto-assign`
  * `GET` `/api/dispatch/search-access/:accessNo`
  * `POST` `/api/dispatch/entry-fee`
  * `GET` `/api/dispatch/entry-fee/history`
  * `PUT` `/api/dispatch/jobs/:id/incomplete`
  * `PUT` `/api/dispatch/jobs/:id/postpone`
  * `PUT` `/api/dispatch/jobs/clear-dispatch`
  * `PUT` `/api/dispatch/jobs/clear-queue`
  * `PUT` `/api/dispatch/jobs/:id`
  * `DELETE` `/api/dispatch/jobs/bulk`
  * `DELETE` `/api/dispatch/jobs/all`
  * `DELETE` `/api/dispatch/jobs/:id`

#### 📄 inventory.js
  * `GET` `/api/inventory/products`
  * `POST` `/api/inventory/products`
  * `POST` `/api/inventory/models`
  * `DELETE` `/api/inventory/products/:id`
  * `POST` `/api/inventory/receive`
  * `GET` `/api/inventory/search-sn/:sn`
  * `POST` `/api/inventory/dispatch`
  * `GET` `/api/inventory/my-bag`
  * `GET` `/api/inventory/my-history`
  * `POST` `/api/inventory/transfer`
  * `GET` `/api/inventory/history`
  * `PUT` `/api/inventory/items/tech/:id`
  * `DELETE` `/api/inventory/items/tech/:id`
  * `DELETE` `/api/inventory/logs/:id`
  * `GET` `/api/inventory/stock`
  * `GET` `/api/inventory/stock/:model_id`
  * `DELETE` `/api/inventory/items/:id`
  * `POST` `/api/inventory/check-sn-duplicates`

#### 📄 messages.js
  * `GET` `/api/messages/users`
  * `GET` `/api/messages/unread-count`
  * `GET` `/api/messages/inbox`
  * `GET` `/api/messages/sent`
  * `POST` `/api/messages/send`
  * `PUT` `/api/messages/:id/read`

#### 📄 migrate.js
  * `GET` `/api/migrate/migrate-fix`
  * `GET` `/api/migrate/backfill-customers`

#### 📄 oil.js
  * `GET` `/api/oil/records`
  * `DELETE` `/api/oil/records/:id`
  * `POST` `/api/oil/recalculate`
  * `GET` `/api/oil/efficiency`
  * `GET` `/api/oil/analytics`
  * `DELETE` `/api/oil/records/:id`

#### 📄 reports.js
  * `GET` `/api/reports`
  * `POST` `/api/reports`
  * `PUT` `/api/reports/:id/status`

#### 📄 settings.js
  * `GET` `/api/settings/targets`
  * `PUT` `/api/settings/targets`

#### 📄 stats.js
  * `GET` `/api/stats/dashboard`
  * `GET` `/api/stats/admin-dashboard`
  * `GET` `/api/stats/super-admin-dashboard`
  * `GET` `/api/stats/efficiency`
  * `GET` `/api/stats/office-tech-dashboard`
  * `GET` `/api/stats/ma-tech-dashboard`

#### 📄 users.js
  * `GET` `/api/users`
  * `GET` `/api/users/teams`
  * `POST` `/api/users/teams`
  * `DELETE` `/api/users/teams/:id`
  * `POST` `/api/users`
  * `PUT` `/api/users/:id/roles`
  * `PUT` `/api/users/:id`
  * `DELETE` `/api/users/:id`
  * `GET` `/api/users/settings/late_time`
  * `PUT` `/api/users/settings/late_time`

### ⏱️ Cron Jobs (`backend/cron`)
* 📄 reminders.js

### 🛠️ Utils & Services (`backend/utils`)
* 📄 customerSync.js

### 📜 Scripts (`backend/scripts`)
* 📄 backfill-customers.js
* 📄 create_announcements_table.sql
* 📄 create_job_completion_images.sql
* 📄 create_messages_table.sql
* 📄 migrate_entry_fee_upgrade.sql
* 📄 run_announcements_sql.js
* 📄 run_entry_fee_migration.js

### 📦 Backend Dependencies
<details>
  <summary>คลิกเพื่อดู Dependencies ฝั่ง Backend</summary>

* **bcryptjs** (v2.4.3)
* **cors** (v2.8.5)
* **dotenv** (v16.4.5)
* **express** (v4.19.2)
* **jsonwebtoken** (v9.0.2)
* **multer** (v1.4.5-lts.1)
* **mysql2** (v3.9.7)
* **node-cron** (v4.2.1)
* **nodemon** (v3.1.3)

</details>

## 🗄️ Database Architecture
* **MySQL** (เชื่อมต่อผ่าน mysql2 แบบ Connection Pool)
* ใช้ Environment Variables (`.env`) เพื่อจัดการค่า Connection

---

## 📖 หลักการทำงานและการไหลของข้อมูล (System Data Flow & Principles)

### 1. 🔐 ระบบ Authentication & Authorization
* **ตัวแปรหลัก (Variables):** `JWT Token`, `user` object (มีฟิลด์ `roles`, `team_id`, `id`)
* **การไหลของข้อมูล (Data Flow):** 
  - ผู้ใช้ล็อกอินผ่าน `/api/auth/login` ได้รับ JWT
  - **Frontend:** ใช้ `AuthContext` (`App.jsx`) เก็บ `bou_token` และ `bou_user` ลงใน `localStorage` ทุกหน้าจอจะถูกหุ้มด้วย `<ProtectedRoute allowedRoles={[...]}>` เพื่อเช็คสิทธิ์ก่อนเรนเดอร์
  - **Backend:** ทุก API ที่เป็นความลับจะถูกป้องกันด้วย Middleware `auth` และ `requireRole` เพื่อถอดรหัส JWT และตรวจสอบว่าสิทธิ์ถึงหรือไม่

### 2. 🚛 กระบวนการจ่ายงานและปฏิบัติงาน (Dispatch & Job Execution)
* **ตารางหลัก (Tables):** `jobs`, `ma_jobs`, `job_logs`, `job_completion_images`
* **การไหลของข้อมูล (Data Flow):** 
  1. **นำเข้างาน:** Admin สร้างงาน (Post) หรือนำเข้าไฟล์ Excel (`/jobs/bulk`) งานจะเริ่มต้นที่สถานะ `pending`
  2. **จ่ายงาน (Assign):** 
     - **Manual:** เลือกงานและผูกกับ `team_id`
     - **Auto-Assign:** ใช้ Algorithm หาพิกัด (`lat`, `lng`) ที่ใกล้เคียงกันที่สุด (Nearest Neighbor/Haversine distance) ในการจัดเรียงคิว (`seq`)
  3. **การทำงานของช่าง (Tech Flow):**
     - กด "ออกเดินทาง" (Set Off) ➡️ สถานะเปลี่ยนเป็น `in_progress`
     - กด "ถึงหน้างาน" (Arrive) ➡️ บันทึก `arrival_time`
     - กด "ปิดงาน" (Complete) ➡️ บันทึกข้อมูลเข้าตาราง `jobs` เปลี่ยนสถานะเป็น `completed`
  4. **กระบวนการเสริมตอนปิดงาน:**
     - อัปโหลดรูปภาพหลักฐานการทำงาน
     - เก็บค่าผ่านทาง (Entry Fees)
     - **ตัดสต๊อกกระเป๋าช่างอัตโนมัติ:** หากมีการเลือก Serial Number ระบบจะทำงานผ่านฟังก์ชัน `processUsedInventory()` เพื่อตัดของออกจากกระเป๋าช่าง

### 3. 📦 ระบบจัดการคลังและกระเป๋าช่าง (Inventory Management)
* **ความสัมพันธ์ (ER Diagram):** `Products` (ประเภท) ➡️ `Models` (รุ่น) ➡️ `Items` (ชิ้น/S/N) ➡️ `Logs` (ประวัติ)
* **การไหลของข้อมูล (Data Flow):**
  - **Inbound:** Admin เพิ่มสินค้าเข้าคลัง (`/api/inventory/receive`) ของจะได้สถานะ `in_stock`
  - **Outbound:** Admin จ่ายของให้ช่าง (`/api/inventory/dispatch`) ของจะเปลี่ยน `owner_id` เป็นช่าง และสถานะเป็น `dispatched`
  - **Usage:** เมื่อช่างปิดงาน ของชิ้นนั้นจะเปลี่ยนสถานะเป็น `used` และบันทึกลง `job_used_inventory`

### 4. 📊 ระบบประสิทธิภาพและการเช็คอิน (Check-in, Oil & Performance)
* **การไหลของข้อมูล (Data Flow):**
  - **Check-in:** พนักงานสแกนหรือกดเช็คอิน บันทึกพิกัดและเวลาเข้าตาราง `attendance`
  - **Oil Management:** เก็บข้อมูลการเติมน้ำมัน เชื่อมกับระยะทางจาก `jobs` เพื่อคำนวณความคุ้มค่า (Efficiency Km/L) ผ่าน `/api/oil/efficiency`
  - **Dashboard/Stats:** ดึงข้อมูลจากหลายตาราง (งานที่สำเร็จ, งานที่เลื่อน, ค่าเข้าพื้นที่) มาแสดงผลที่ `/api/stats/dashboard`