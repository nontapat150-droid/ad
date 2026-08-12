import Swal from 'sweetalert2';

const SWAL_CONTAINER = 'swal-over-oil-modal';

function raiseSwal() {
  const el = document.querySelector(`.${SWAL_CONTAINER}`);
  if (el) el.style.zIndex = '200000';
}

function baseOpts(extra = {}) {
  return {
    customClass: { container: SWAL_CONTAINER, popup: 'rounded-2xl' },
    didOpen: raiseSwal,
    confirmButtonColor: '#185FA5',
    ...extra,
  };
}

/** Map API / network errors to a short Thai title + reason. */
export function explainOilError(err, action = 'บันทึก') {
  const status = err?.response?.status;
  const serverMsg = String(err?.response?.data?.error || err?.response?.data?.message || '').trim();
  const lower = serverMsg.toLowerCase();

  if (!err?.response) {
    if (err?.code === 'ECONNABORTED') {
      return {
        title: `${action}ไม่สำเร็จ`,
        reason: 'การเชื่อมต่อหมดเวลา กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง',
      };
    }
    return {
      title: `${action}ไม่สำเร็จ`,
      reason: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตหรือลองใหม่ภายหลัง',
    };
  }

  if (status === 401) {
    return { title: 'หมดสิทธิ์การใช้งาน', reason: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่แล้วลองอีกครั้ง' };
  }
  if (status === 403) {
    return { title: `${action}ไม่สำเร็จ`, reason: 'บัญชีของคุณไม่มีสิทธิ์ทำรายการนี้' };
  }
  if (status === 404) {
    return { title: `${action}ไม่สำเร็จ`, reason: 'ไม่พบรายการนี้ในระบบ อาจถูกลบไปแล้ว' };
  }
  if (status === 409 || lower.includes('ซ้ำ') || lower.includes('duplicate')) {
    return {
      title: `${action}ไม่สำเร็จ — พบรายการใกล้เคียง`,
      reason: serverMsg || 'มีรายการน้ำมันของทีมนี้ที่เลขไมล์หรือเวลาใกล้กันเกินไป กรุณาตรวจเลขไมล์/วันเวลาแล้วลองใหม่',
    };
  }
  if (status === 400 || lower.includes('missing') || lower.includes('required')) {
    return {
      title: 'ข้อมูลไม่ครบ',
      reason: serverMsg && !lower.includes('missing')
        ? serverMsg
        : 'กรุณากรอกทะเบียนรถ จำนวนลิตร เลขไมล์ และยอดเงินให้ครบก่อนบันทึก',
    };
  }
  if (status >= 500) {
    return {
      title: `${action}ไม่สำเร็จ`,
      reason: serverMsg && !/^server error/i.test(serverMsg)
        ? serverMsg
        : 'เซิร์ฟเวอร์มีปัญหาชั่วคราว กรุณาลองใหม่อีกครั้ง',
    };
  }

  return {
    title: `${action}ไม่สำเร็จ`,
    reason: serverMsg || err?.message || 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ กรุณาลองใหม่',
  };
}

export function showOilWarning(title, reason) {
  return Swal.fire({
    ...baseOpts({
      icon: 'warning',
      title,
      html: `<p class="text-sm text-slate-600 leading-relaxed text-left">${reason}</p>`,
      confirmButtonText: 'ตกลง',
    }),
  });
}

export function showOilSuccess({ title, detail, timer = 2200 } = {}) {
  return Swal.fire({
    ...baseOpts({
      icon: 'success',
      title: title || 'ทำรายการสำเร็จ',
      html: detail
        ? `<p class="text-sm text-slate-600 leading-relaxed text-left">${detail}</p>`
        : undefined,
      showConfirmButton: !timer,
      confirmButtonText: 'ตกลง',
      timer,
      timerProgressBar: Boolean(timer),
    }),
  });
}

export function showOilError(err, action = 'บันทึก') {
  const { title, reason } = explainOilError(err, action);
  return Swal.fire({
    ...baseOpts({
      icon: 'error',
      title,
      html: `
        <div class="text-left space-y-2">
          <p class="text-sm font-semibold text-rose-700">เหตุผล</p>
          <p class="text-sm text-slate-600 leading-relaxed">${reason}</p>
        </div>
      `,
      confirmButtonText: 'ปิด',
    }),
  });
}

export function formatOilSaveSummary({ licensePlate, mileage, liters, totalPrice, isEdit = false }) {
  const plate = String(licensePlate || '-').trim() || '-';
  const km = Number(mileage);
  const lit = Number(liters);
  const price = Number(totalPrice);
  const rows = [
    `<div><span class="text-slate-500">ทะเบียน</span> <b class="text-slate-800">${plate}</b></div>`,
    Number.isFinite(km) ? `<div><span class="text-slate-500">เลขไมล์</span> <b class="text-slate-800">${km.toLocaleString('th-TH')}</b></div>` : '',
    Number.isFinite(lit) ? `<div><span class="text-slate-500">ปริมาณ</span> <b class="text-slate-800">${lit.toLocaleString('th-TH')} ลิตร</b></div>` : '',
    Number.isFinite(price) ? `<div><span class="text-slate-500">ยอดรวม</span> <b class="text-slate-800">฿${price.toLocaleString('th-TH')}</b></div>` : '',
  ].filter(Boolean).join('');

  return `
    <p class="text-sm text-slate-600 mb-2 text-left">${isEdit ? 'บันทึกการแก้ไขรายการเติมน้ำมันเรียบร้อยแล้ว' : 'บันทึกรายการเติมน้ำมันเรียบร้อยแล้ว'}</p>
    <div class="rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm space-y-1 text-left">${rows}</div>
  `;
}
