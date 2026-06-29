import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';

export const generateCheckinExcel = async (data, monthString) => {
  const { users, checkins } = data;
  
  const workbook = new ExcelJS.Workbook();
  
  // Get days in month
  const [year, month] = monthString.split('-');
  const daysInMonth = new Date(year, month, 0).getDate();
  
  // Map of raw roles to display names
  const roleGroups = {
    'technician': 'ช่างทั่วไป',
    'office_technician': 'ช่าง',
    'ma_technician': 'ทีม MA',
    'sales': 'เซล',
    'general': 'ช่างทั่วไป',
    'ma': 'ทีม MA',
    'manager': 'ผู้จัดการ'
  };

  // Group users by the mapped role name (so 'ma' and 'ma_technician' go to the same tab)
  const groupedUsers = users.reduce((acc, user) => {
    const rawRole = user.role || 'general';
    let roleName = roleGroups[rawRole] || rawRole.toUpperCase();
    if (rawRole === 'sales') roleName = 'เซล'; // enforce exact name
    
    if (!acc[roleName]) acc[roleName] = [];
    acc[roleName].push(user);
    return acc;
  }, {});

  // Add worksheet for each mapped role
  for (const [roleName, roleUsers] of Object.entries(groupedUsers)) {
    if (!roleUsers || roleUsers.length === 0) continue;
    
    // Excel worksheet names must be <= 31 chars and not contain certain symbols
    const worksheet = workbook.addWorksheet(roleName);
    
    // Set up columns for this worksheet
    const columns = [
      { key: 'name', width: 25 },
    ];
    for (let i = 1; i <= daysInMonth; i++) {
      columns.push({ key: `day_${i}_in`, width: 12 });
      columns.push({ key: `day_${i}_out`, width: 12 });
    }
    worksheet.columns = columns;

    // Set Header Row 1 (Dates)
    const headerRow1 = worksheet.getRow(1);
    headerRow1.getCell(1).value = 'ชื่อพนักงาน';
    for (let i = 1; i <= daysInMonth; i++) {
      headerRow1.getCell(i * 2).value = `วันที่ ${i}`;
      worksheet.mergeCells(1, i * 2, 1, (i * 2) + 1); // Merge "วันที่ X" across In and Out
    }
    worksheet.mergeCells(1, 1, 2, 1); // Merge "ชื่อพนักงาน" vertically

    // Set Header Row 2 (In/Out)
    const headerRow2 = worksheet.getRow(2);
    for (let i = 1; i <= daysInMonth; i++) {
      headerRow2.getCell(i * 2).value = 'เข้า';
      headerRow2.getCell((i * 2) + 1).value = 'ออก';
    }

    // Formatting Header Rows
    [headerRow1, headerRow2].forEach(row => {
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (!cell.value && cell.master === cell) return; // Skip completely empty trailing cells

        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        
        if (colNumber === 1) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } }; // Dark Gray
        } else if (colNumber % 2 === 0) { // Even columns (In)
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } }; // Emerald-500
        } else { // Odd columns > 1 (Out)
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6366F1' } }; // Indigo-500
        }
        
        // Add thin border to headers for neatness
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
        };
      });
    });

    // Add Users
    roleUsers.forEach(user => {
      const rowData = { name: user.full_name || user.username };
      const userCheckins = checkins.filter(c => c.user_id === user.id);
      
      const lateCells = [];
      
      for (let i = 1; i <= daysInMonth; i++) {
        // Find checkin for this day
        const dateStr = `${year}-${month}-${String(i).padStart(2, '0')}`;
        // Adjust for local timezone of the database vs JS Date
        const checkin = userCheckins.find(c => {
          if (!c.checkin_time) return false;
          const ct = new Date(c.checkin_time);
          const ctYear = ct.getFullYear();
          const ctMonth = String(ct.getMonth() + 1).padStart(2, '0');
          const ctDay = String(ct.getDate()).padStart(2, '0');
          return `${ctYear}-${ctMonth}-${ctDay}` === dateStr;
        });
        
        if (checkin) {
          const inTime = new Date(checkin.checkin_time);
          rowData[`day_${i}_in`] = format(inTime, 'HH:mm');
          
          if (checkin.is_late) {
            lateCells.push(`day_${i}_in`);
          }
          
          if (checkin.checkout_time) {
            const outTime = new Date(checkin.checkout_time);
            rowData[`day_${i}_out`] = format(outTime, 'HH:mm');
          } else {
            rowData[`day_${i}_out`] = '-';
          }
        } else {
          rowData[`day_${i}_in`] = '-';
          rowData[`day_${i}_out`] = '-';
        }
      }
      
      const addedRow = worksheet.addRow(rowData);
      addedRow.alignment = { horizontal: 'center', vertical: 'middle' };
      addedRow.getCell('name').alignment = { horizontal: 'left', vertical: 'middle' };
      
      // Highlight late cells
      lateCells.forEach(key => {
        const cell = addedRow.getCell(key);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF97316' } // Orange-500
        };
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
      });
      
      // Add borders
      addedRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };
      });
    });

    // Freeze first column and top 2 rows
    worksheet.views = [
      { state: 'frozen', xSplit: 1, ySplit: 2 }
    ];
  }

  // Generate buffer and save
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const filename = `ข้อมูลลงเวลา_${monthString}.xlsx`;
  saveAs(blob, filename);
};
