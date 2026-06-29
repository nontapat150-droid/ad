import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';

export const generateCheckinExcel = async (data, monthString) => {
  const { users, checkins } = data;
  
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(`ข้อมูลลงเวลา ${monthString}`);

  // Get days in month
  const [year, month] = monthString.split('-');
  const daysInMonth = new Date(year, month, 0).getDate();
  
  // Set up columns
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
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F2937' } // Dark gray
  };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  
  // Group users by role
  const roleGroups = {
    'general': 'ช่าง Office',
    'ma': 'ทีม MA',
    'sales': 'เซลส์',
    'manager': 'ผู้จัดการ',
    'admin': 'แอดมิน'
  };

  const groupedUsers = users.reduce((acc, user) => {
    const r = user.role || 'general';
    if (!acc[r]) acc[r] = [];
    acc[r].push(user);
    return acc;
  }, {});

  // Add data rows
  for (const [roleKey, roleName] of Object.entries(roleGroups)) {
    if (!groupedUsers[roleKey] || groupedUsers[roleKey].length === 0) continue;
    
    // Add Role Header Row
    const roleRow = worksheet.addRow([`--- ${roleName} ---`]);
    roleRow.font = { bold: true, color: { argb: 'FF374151' } };
    roleRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF3F4F6' } // Light gray
    };
    worksheet.mergeCells(`A${roleRow.number}:${worksheet.getColumn(worksheet.columns.length).letter}${roleRow.number}`);
    
    // Add Users
    groupedUsers[roleKey].forEach(user => {
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
          // Assuming DB time matches local time roughly for formatting date
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
      // Align name to left
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
      
      // Add borders to all cells in this row
      addedRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };
      });
    });
  }
  
  // Freeze first column and top row
  worksheet.views = [
    { state: 'frozen', xSplit: 1, ySplit: 1 }
  ];

  // Generate buffer and save
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const filename = `ข้อมูลลงเวลา_${monthString}.xlsx`;
  saveAs(blob, filename);
};
