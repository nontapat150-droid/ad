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
      { header: 'ชื่อพนักงาน', key: 'name', width: 25 },
    ];
    for (let i = 1; i <= daysInMonth; i++) {
      columns.push({ header: `วันที่ ${i} (เข้า)`, key: `day_${i}_in`, width: 12 });
      columns.push({ header: `วันที่ ${i} (ออก)`, key: `day_${i}_out`, width: 12 });
    }
    worksheet.columns = columns;

    // Formatting Header Row
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      
      const colKey = worksheet.getColumn(colNumber).key;
      if (colKey === 'name') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } }; // Dark Gray
      } else if (colKey && colKey.endsWith('_in')) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } }; // Emerald-500
      } else if (colKey && colKey.endsWith('_out')) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6366F1' } }; // Indigo-500
      }
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

    // Freeze first column and top row
    worksheet.views = [
      { state: 'frozen', xSplit: 1, ySplit: 1 }
    ];
  }

  // Generate buffer and save
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const filename = `ข้อมูลลงเวลา_${monthString}.xlsx`;
  saveAs(blob, filename);
};
