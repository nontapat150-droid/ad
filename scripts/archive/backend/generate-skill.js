const fs = require('fs');
const path = require('path');

// 1. Dependencies
function getDependencies(packagePath) {
    try {
        if (fs.existsSync(packagePath)) {
            const data = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            const deps = { ...data.dependencies, ...data.devDependencies };
            return Object.keys(deps).map(pkg => `* **${pkg}** (v${deps[pkg].replace(/[\^\~]/g, '')})`);
        }
    } catch (error) {
        return ["* ❌ ไม่สามารถอ่านข้อมูลแพ็กเกจได้"];
    }
    return ["* ⚠️ ไม่พบไฟล์ package.json ในระบบ"];
}

// 2. Read Frontend Routes from App.jsx
function getFrontendRoutes(appJsxPath) {
    try {
        if (fs.existsSync(appJsxPath)) {
            const content = fs.readFileSync(appJsxPath, 'utf8');
            const routes = [];
            // Regex to find paths and their rendering components, including ProtectedRoutes
            const regex = /<Route[^>]*path=["']([^"']+)["'][^>]*element=\{[\s\n]*(?:<ProtectedRoute[^>]*>[\s\n]*)?<([A-Za-z0-9_]+)/g;
            let match;
            while ((match = regex.exec(content)) !== null) {
                const routePath = match[1];
                const componentName = match[2];
                // Check if it's protected by searching locally within the match area roughly
                const isProtected = content.substring(match.index, match.index + 200).includes('<ProtectedRoute');
                routes.push(`* \`${routePath}\` ➡️ **${componentName}** ${isProtected ? '🔒' : ''}`);
            }
            return routes.length > 0 ? routes : ["* ไม่พบ Route ใน App.jsx"];
        }
    } catch (error) {
        return ["* ❌ ไม่สามารถอ่าน App.jsx ได้"];
    }
    return ["* ⚠️ ไม่พบไฟล์ App.jsx"];
}

// 3. Read Backend API Endpoints
function getBackendEndpoints(routesDirPath) {
    const endpoints = [];
    try {
        if (fs.existsSync(routesDirPath)) {
            const files = fs.readdirSync(routesDirPath).filter(f => f.endsWith('.js'));
            files.forEach(file => {
                const filePath = path.join(routesDirPath, file);
                const content = fs.readFileSync(filePath, 'utf8');
                const regex = /router\.(get|post|put|delete|patch)\(['"`]([^'"`]+)['"`]/g;
                let match;
                const fileEndpoints = [];
                while ((match = regex.exec(content)) !== null) {
                    const method = match[1].toUpperCase();
                    const routePath = match[2];
                    fileEndpoints.push(`  * \`${method}\` \`/api/${file.replace('.js', '')}${routePath === '/' ? '' : routePath}\``);
                }
                if (fileEndpoints.length > 0) {
                    endpoints.push(`#### 📄 ${file}\n${fileEndpoints.join('\n')}`);
                }
            });
            return endpoints.length > 0 ? endpoints : ["* ไม่พบ API Endpoints"];
        }
    } catch (error) {
        return ["* ❌ ไม่สามารถอ่าน routes ได้"];
    }
    return ["* ⚠️ ไม่พบโฟลเดอร์ routes"];
}

// 4. Basic File/Folder Listing
function getItemsInDir(dirPath) {
    try {
        if (fs.existsSync(dirPath)) {
            const items = fs.readdirSync(dirPath);
            if (items.length === 0) return ["* (ไม่มีข้อมูล)"];
            return items.map(item => {
                const isDir = fs.statSync(path.join(dirPath, item)).isDirectory();
                return `* ${isDir ? '📁' : '📄'} ${item}`;
            });
        }
    } catch (error) {
        return ["* ❌ ไม่สามารถอ่านโฟลเดอร์ได้"];
    }
    return ["* ⚠️ ไม่พบโฟลเดอร์ในระบบ"];
}

const backendPkgPath = path.join(__dirname, 'package.json');
const frontendPkgPath = path.join(__dirname, '../frontend/package.json');
const mdFilePath = path.join(__dirname, '../SKILL.md');

const appJsxPath = path.join(__dirname, '../frontend/src/App.jsx');
const routesPath = path.join(__dirname, 'routes');
const componentsPath = path.join(__dirname, '../frontend/src/components');
const cronPath = path.join(__dirname, 'cron');
const utilsPath = path.join(__dirname, 'utils');
const scriptsPath = path.join(__dirname, 'scripts');

const backendDependencies = getDependencies(backendPkgPath).join('\n');
const frontendDependencies = getDependencies(frontendPkgPath).join('\n');
const frontendRoutes = getFrontendRoutes(appJsxPath).join('\n');
const backendEndpoints = getBackendEndpoints(routesPath).join('\n\n');
const frontendComponents = getItemsInDir(componentsPath).join('\n');
const cronJobs = getItemsInDir(cronPath).join('\n');
const backendUtils = getItemsInDir(utilsPath).join('\n');
const backendScripts = getItemsInDir(scriptsPath).join('\n');

const updateDate = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });

const markdownContent = `
# 🛠️ System Tech Stack & Comprehensive Overview

เอกสารนี้ถูกสร้างและอัปเดตอัตโนมัติจากโค้ดจริง (Code Analysis)
🕒 **อัปเดตล่าสุด:** ${updateDate}

## 🖥️ Frontend Architecture (React.js / Vite)

### 🗺️ Frontend Routes (\`App.jsx\`)
${frontendRoutes}

### 🧩 Components (\`frontend/src/components\`)
${frontendComponents}

### 📦 Frontend Dependencies
<details>
  <summary>คลิกเพื่อดู Dependencies ฝั่ง Frontend</summary>

${frontendDependencies}

</details>

## ⚙️ Backend Architecture (Node.js / Express)

### 🔌 API Endpoints (\`backend/routes\`)
${backendEndpoints}

### ⏱️ Cron Jobs (\`backend/cron\`)
${cronJobs}

### 🛠️ Utils & Services (\`backend/utils\`)
${backendUtils}

### 📜 Scripts (\`backend/scripts\`)
${backendScripts}

### 📦 Backend Dependencies
<details>
  <summary>คลิกเพื่อดู Dependencies ฝั่ง Backend</summary>

${backendDependencies}

</details>

## 🗄️ Database Architecture
* **MySQL** (เชื่อมต่อผ่าน mysql2 แบบ Connection Pool)
* ใช้ Environment Variables (\`.env\`) เพื่อจัดการค่า Connection

---

## 📖 หลักการทำงานและการไหลของข้อมูล (System Data Flow & Principles)

### 1. 🔐 ระบบ Authentication & Authorization
* **ตัวแปรหลัก (Variables):** \`JWT Token\`, \`user\` object (มีฟิลด์ \`roles\`, \`team_id\`, \`id\`)
* **การไหลของข้อมูล (Data Flow):** 
  - ผู้ใช้ล็อกอินผ่าน \`/api/auth/login\` ได้รับ JWT
  - **Frontend:** ใช้ \`AuthContext\` (\`App.jsx\`) เก็บ \`bou_token\` และ \`bou_user\` ลงใน \`localStorage\` ทุกหน้าจอจะถูกหุ้มด้วย \`<ProtectedRoute allowedRoles={[...]}\>\` เพื่อเช็คสิทธิ์ก่อนเรนเดอร์
  - **Backend:** ทุก API ที่เป็นความลับจะถูกป้องกันด้วย Middleware \`auth\` และ \`requireRole\` เพื่อถอดรหัส JWT และตรวจสอบว่าสิทธิ์ถึงหรือไม่

### 2. 🚛 กระบวนการจ่ายงานและปฏิบัติงาน (Dispatch & Job Execution)
* **ตารางหลัก (Tables):** \`jobs\`, \`ma_jobs\`, \`job_logs\`, \`job_completion_images\`
* **การไหลของข้อมูล (Data Flow):** 
  1. **นำเข้างาน:** Admin สร้างงาน (Post) หรือนำเข้าไฟล์ Excel (\`/jobs/bulk\`) งานจะเริ่มต้นที่สถานะ \`pending\`
  2. **จ่ายงาน (Assign):** 
     - **Manual:** เลือกงานและผูกกับ \`team_id\`
     - **Auto-Assign:** ใช้ Algorithm หาพิกัด (\`lat\`, \`lng\`) ที่ใกล้เคียงกันที่สุด (Nearest Neighbor/Haversine distance) ในการจัดเรียงคิว (\`seq\`)
  3. **การทำงานของช่าง (Tech Flow):**
     - กด "ออกเดินทาง" (Set Off) ➡️ สถานะเปลี่ยนเป็น \`in_progress\`
     - กด "ถึงหน้างาน" (Arrive) ➡️ บันทึก \`arrival_time\`
     - กด "ปิดงาน" (Complete) ➡️ บันทึกข้อมูลเข้าตาราง \`jobs\` เปลี่ยนสถานะเป็น \`completed\`
  4. **กระบวนการเสริมตอนปิดงาน:**
     - อัปโหลดรูปภาพหลักฐานการทำงาน
     - เก็บค่าผ่านทาง (Entry Fees)
     - **ตัดสต๊อกกระเป๋าช่างอัตโนมัติ:** หากมีการเลือก Serial Number ระบบจะทำงานผ่านฟังก์ชัน \`processUsedInventory()\` เพื่อตัดของออกจากกระเป๋าช่าง

### 3. 📦 ระบบจัดการคลังและกระเป๋าช่าง (Inventory Management)
* **ความสัมพันธ์ (ER Diagram):** \`Products\` (ประเภท) ➡️ \`Models\` (รุ่น) ➡️ \`Items\` (ชิ้น/S/N) ➡️ \`Logs\` (ประวัติ)
* **การไหลของข้อมูล (Data Flow):**
  - **Inbound:** Admin เพิ่มสินค้าเข้าคลัง (\`/api/inventory/receive\`) ของจะได้สถานะ \`in_stock\`
  - **Outbound:** Admin จ่ายของให้ช่าง (\`/api/inventory/dispatch\`) ของจะเปลี่ยน \`owner_id\` เป็นช่าง และสถานะเป็น \`dispatched\`
  - **Usage:** เมื่อช่างปิดงาน ของชิ้นนั้นจะเปลี่ยนสถานะเป็น \`used\` และบันทึกลง \`job_used_inventory\`

### 4. 📊 ระบบประสิทธิภาพและการเช็คอิน (Check-in, Oil & Performance)
* **การไหลของข้อมูล (Data Flow):**
  - **Check-in:** พนักงานสแกนหรือกดเช็คอิน บันทึกพิกัดและเวลาเข้าตาราง \`attendance\`
  - **Oil Management:** เก็บข้อมูลการเติมน้ำมัน เชื่อมกับระยะทางจาก \`jobs\` เพื่อคำนวณความคุ้มค่า (Efficiency Km/L) ผ่าน \`/api/oil/efficiency\`
  - **Dashboard/Stats:** ดึงข้อมูลจากหลายตาราง (งานที่สำเร็จ, งานที่เลื่อน, ค่าเข้าพื้นที่) มาแสดงผลที่ \`/api/stats/dashboard\`
`;

fs.writeFile(mdFilePath, markdownContent.trim(), (err) => {
    if (err) console.error('❌ เกิดข้อผิดพลาดในการสร้างไฟล์:', err);
    else console.log('✅ ระบบสแกนและอัปเดต SKILL.md อย่างละเอียดเรียบร้อยแล้ว!');
});