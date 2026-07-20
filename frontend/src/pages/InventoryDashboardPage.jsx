import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import InventoryStockPage from './InventoryStockPage';
import InventoryReceivePage from './InventoryReceivePage';
import InventoryDispatchPage from './InventoryDispatchPage';
import InventoryHistoryPage from './InventoryHistoryPage';
import InventoryReturnPage from './InventoryReturnPage';
import NotificationBell from '../components/NotificationBell';
import ThemeToggle from '../components/ThemeToggle';
import ManualModal from '../components/ManualModal';
import ManualHelpButton from '../components/ManualHelpButton';
import { useAuth } from '../context/AuthContext';

export default function InventoryDashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('stock');
  const [showManualModal, setShowManualModal] = useState(false);
  const { user } = useAuth();
  const userRoles = user?.roles || [user?.role];

  return (
    <div className="flex h-screen bg-[#F9FAFB] text-[#1F2937] font-sans overflow-hidden selection:bg-[#A3E635] selection:text-[#1F2937]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} activeKey="inventory" />

      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0 md:ml-[280px]">
        <header className="bg-white shadow-sm border-b border-[#E5E7EB] flex-shrink-0 z-10">
          <div className="max-w-7xl mx-auto px-4 lg:px-8 h-20 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => setSidebarOpen(true)} className="md:hidden w-11 h-11 flex items-center justify-center rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB] text-[#1F2937] hover:bg-[#F3F4F6] transition-colors active:scale-95">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-black text-[#1F2937] tracking-tight">ระบบคลังสินค้า</h1>
                <p className="text-sm font-medium text-[#9CA3AF] hidden sm:block">จัดการสต๊อกสินค้าและอะไหล่</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ManualHelpButton onClick={() => setShowManualModal(true)} />
              <ThemeToggle />
              <NotificationBell />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-2 rounded-2xl border border-[#E5E7EB] shadow-sm">
              <div className="flex bg-[#F3F4F6] p-1.5 rounded-xl w-full overflow-x-auto hide-scrollbar">
                <button onClick={() => setActiveTab('stock')} className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'stock' ? 'bg-white shadow-sm text-[#1F2937]' : 'text-[#6B7280] hover:text-[#4B5563]'}`}>สินค้าคงเหลือ</button>
                <button onClick={() => setActiveTab('receive')} className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'receive' ? 'bg-white shadow-sm text-[#1F2937]' : 'text-[#6B7280] hover:text-[#4B5563]'}`}>นำเข้าสินค้า</button>
                <button onClick={() => setActiveTab('dispatch')} className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'dispatch' ? 'bg-white shadow-sm text-[#1F2937]' : 'text-[#6B7280] hover:text-[#4B5563]'}`}>เบิกจ่ายสินค้า</button>
                <button onClick={() => setActiveTab('return')} className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'return' ? 'bg-white shadow-sm text-[#1F2937]' : 'text-[#6B7280] hover:text-[#4B5563]'}`}>คืนสินค้า</button>
                <button onClick={() => setActiveTab('history')} className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'history' ? 'bg-white shadow-sm text-[#1F2937]' : 'text-[#6B7280] hover:text-[#4B5563]'}`}>ประวัติรายการ</button>
              </div>
            </div>

            <div className="animate-[slideUp_0.3s_ease-out]">
              {activeTab === 'stock' && <InventoryStockPage />}
              {activeTab === 'receive' && <InventoryReceivePage />}
              {activeTab === 'dispatch' && <InventoryDispatchPage />}
              {activeTab === 'return' && <InventoryReturnPage />}
              {activeTab === 'history' && <InventoryHistoryPage />}
            </div>
          </div>
        </main>
      </div>

      <ManualModal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
        userRoles={userRoles}
        pageName="inventory"
      />
    </div>
  );
}
