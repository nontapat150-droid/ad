import React, { useEffect, useState } from 'react';

export default function ManualModal({ isOpen, onClose, userRoles = [], pageName = 'dashboard' }) {
  // Determine primary role to display manual for
  const isSuperAdmin = userRoles.includes('super_admin');
  const isAdmin = userRoles.includes('admin') && !isSuperAdmin;
  const isSales = userRoles.includes('sales');
  const isTech = userRoles.includes('technician') || userRoles.includes('office_technician');
  const isMaTech = userRoles.includes('ma_technician');

  // Prevent scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen) return null;

  // Content for Dashboard Page
  const renderDashboardManual = () => {
    if (isSuperAdmin) {
      return (
        <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300">
          <p><strong>สวัสดี Super Admin,</strong> หน้าภาพรวมระบบ (Dashboard) ถูกออกแบบมาเพื่อให้คุณเห็นข้อมูลทุกอย่างในบริษัทแบบ Real-time</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>สถิติรายวัน:</strong> ดูยอดงานทั้งหมด, งานที่สำเร็จ, และงานที่รอดำเนินการของวันนี้</li>
            <li><strong>สถานะช่าง:</strong> ตรวจสอบว่าช่างคนไหนเข้างานแล้ว และคนไหนกำลังปฏิบัติงานอยู่บ้าง</li>
            <li><strong>การแจ้งเตือนระบบ:</strong> ดูปัญหาที่ถูกแจ้งเข้ามาจากผู้ใช้งานในระบบ</li>
            <li><strong>ปุ่มทางลัด:</strong> สามารถไปยังหน้าตั้งค่าระบบ, จัดการผู้ใช้, หรือจัดการงานได้อย่างรวดเร็ว</li>
          </ul>
        </div>
      );
    }
    if (isAdmin) {
      return (
        <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300">
          <p><strong>สวัสดี Admin,</strong> นี่คือหน้าจอหลักสำหรับตรวจสอบและจัดการงานประจำวัน</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>ยอดงานรวม:</strong> สรุปจำนวนงานของแต่ละแผนก เพื่อประเมินความหนาแน่นของงาน</li>
            <li><strong>ความเคลื่อนไหว:</strong> ดูการอัปเดตสถานะงานล่าสุดจากทีมช่างและเซลส์</li>
            <li><strong>การควบคุม:</strong> ใช้ปุ่มในแถบด้านข้างเพื่อไปจ่ายงานให้ช่าง หรือตรวจสอบสินค้าคงคลัง</li>
          </ul>
        </div>
      );
    }
    if (isSales) {
      return (
        <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300">
          <p><strong>สวัสดีทีมเซลส์,</strong> หน้านี้คือศูนย์รวมข้อมูลเพื่อติดตามความคืบหน้าของงานลูกค้า</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>งานที่เปิด:</strong> ตรวจสอบงานที่คุณเปิดไว้ว่าช่างดำเนินการถึงไหนแล้ว</li>
            <li><strong>เพิ่มงานใหม่:</strong> เข้าถึงเมนูเพิ่มงานได้อย่างรวดเร็ว เพื่อส่งงานต่อให้ช่างทันที</li>
            <li><strong>ประกาศ:</strong> ติดตามข่าวสารใหม่ๆ ของบริษัทที่อาจส่งผลต่อการขายหรือบริการ</li>
          </ul>
        </div>
      );
    }
    if (isTech || isMaTech) {
      return (
        <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300">
          <p><strong>สวัสดีทีมช่าง,</strong> หน้านี้จะช่วยให้คุณทำงานและลงเวลาง่ายขึ้นในแต่ละวัน</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>งานของฉันวันนี้:</strong> แสดงรายการงานทั้งหมดที่คุณต้องรับผิดชอบในวันนี้</li>
            <li><strong>การรับงาน:</strong> เมื่อถึงหน้างาน ให้กด <em>เช็คอิน</em> เพื่อเริ่มงาน และเมื่อเสร็จให้กด <em>อัปเดตสถานะ</em> เพื่อปิดงาน</li>
            <li><strong>บันทึกเบิกน้ำมัน:</strong> ดูประวัติและยอดการเบิกค่าน้ำมันของคุณในเดือนนี้ได้อย่างรวดเร็ว</li>
            <li><strong>ประกาศสำคัญ:</strong> อ่านประกาศจากบริษัทก่อนเริ่มงานทุกเช้า</li>
          </ul>
        </div>
      );
    }
    return (
      <div className="text-sm text-slate-500">
        ยังไม่มีคู่มือสำหรับบทบาทของคุณในหน้านี้
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col animate-slide-up">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-900/30 text-brand-600 flex items-center justify-center shadow-inner">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">คู่มือการใช้งาน</h2>
              <p className="text-xs text-brand-600 dark:text-brand-400 font-medium">สำหรับ{pageName === 'dashboard' ? 'หน้าภาพรวมระบบ' : 'หน้านี้'}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 md:p-8 max-h-[60vh] overflow-y-auto">
          {pageName === 'dashboard' && renderDashboardManual()}
          
          {/* Future expansion for other pages */}
          {pageName !== 'dashboard' && (
             <div className="text-sm text-slate-500 text-center py-8">
               กำลังจัดทำคู่มือสำหรับหน้านี้...
             </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl font-medium transition-colors shadow-sm active:scale-95"
          >
            เข้าใจแล้ว
          </button>
        </div>
      </div>
    </div>
  );
}
