const fs = require('fs');
let content = fs.readFileSync('backend/routes/inventory.js', 'utf8');

content = content.replace(
  'SELECT il.id, il.action, il.quantity, il.created_at,\n                ii.sn, pm.model_name, p.name AS product_name',
  'SELECT il.id, il.action, il.quantity, il.created_at, il.note,\n                ii.sn, pm.model_name, p.name AS product_name'
);

content = content.replace(
  'SELECT il.id, il.action, il.quantity, il.created_at,\n                ii.sn, ii.status AS item_status',
  'SELECT il.id, il.action, il.quantity, il.created_at, il.note,\n                ii.sn, ii.status AS item_status'
);

content = content.replace(
  'SELECT id, access_no, status FROM jobs WHERE id = ?',
  'SELECT id, access_no, status, customer, install_device FROM jobs WHERE id = ?'
);

const oldLogic =           // Log the usage\r
          await conn.query(\r
            'INSERT INTO inventory_logs (item_id, from_user_id, action, quantity, note) VALUES (?, ?, \"used\", ?, ?)',\r
            [item_id, userId, quantity, \\\ใช้กับงาน \\\\\\]\r
          );\r
        }\r
    \r
        // 3. Update job status to completed if it's not already\r
        if (job.status !== 'completed') {\r
          await conn.query(\r
            'UPDATE jobs SET status = \"completed\" WHERE id = ?',\r
            [job_id]\r
          );\r
        };

const newLogic =           // Log the usage with customer name\r
          const customerText = job.customer ? \\\ (ลูกค้า: \\\)\\\ : '';\r
          const note = \\\ใช้กับงาน \\\\\\\\\;\r
          await conn.query(\r
            'INSERT INTO inventory_logs (item_id, from_user_id, action, quantity, note) VALUES (?, ?, \"used\", ?, ?)',\r
            [item_id, userId, quantity, note]\r
          );\r
\r
          // Build summary for the job's install_device field\r
          const equipmentName = invItem.sn \r
            ? \\\\\\ (SN: \\\)\\\ \r
            : \\\\\\ จำนวน \\\ ชิ้น\\\;\r
          usedItemsSummary.push(equipmentName);\r
        }\r
    \r
        // 3. Update job status to completed if it's not already, and append equipment to install_device\r
        const newEquipmentText = usedItemsSummary.join(', ');\r
        const updatedInstallDevice = job.install_device \r
          ? \\\\\\, \\\\\\ \r
          : newEquipmentText;\r
\r
        if (job.status !== 'completed') {\r
          await conn.query(\r
            \\\UPDATE jobs SET \r
              status = \"completed\", \r
              install_device = ?,\r
              finish_time = IFNULL(finish_time, NOW()),\r
              completed_at = IFNULL(completed_at, NOW()),\r
              completed_by = IFNULL(completed_by, ?)\r
             WHERE id = ?\\\,\r
            [updatedInstallDevice, userId, job_id]\r
          );\r
        } else {\r
          await conn.query(\r
            'UPDATE jobs SET install_device = ? WHERE id = ?',\r
            [updatedInstallDevice, job_id]\r
          );\r
        };

// Let's use regex to be safer for replacement of the old block
let newContent = content;
newContent = newContent.replace(/          \/\/ Log the usage[\s\S]*?if \(job\.status !== 'completed'\) {[\s\S]*?UPDATE jobs SET status = "completed" WHERE id = \?'[\s\S]*?\[job_id\][\s\S]*?\);[\s\S]*?}/, newLogic.replace(/\\/g, '').replace(/\\\$/g, '$'));

// Add usedItemsSummary init before loop
newContent = newContent.replace('// 2. Process each item', 'let usedItemsSummary = [];\n\n        // 2. Process each item');

// Add JOIN to SELECT inventory_items in use-equipment loop
newContent = newContent.replace(
  'SELECT * FROM inventory_items WHERE id = ? AND owner_id = ? AND status = "dispatched"',
  'SELECT ii.*, p.name AS product_name FROM inventory_items ii JOIN inventory_models m ON ii.model_id = m.id JOIN inventory_products p ON m.product_id = p.id WHERE ii.id = ? AND ii.owner_id = ? AND ii.status = "dispatched"'
);

fs.writeFileSync('backend/routes/inventory.js', newContent, 'utf8');
