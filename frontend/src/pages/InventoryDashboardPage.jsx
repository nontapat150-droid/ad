import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import InventoryStockPage from './InventoryStockPage';
import InventoryReceivePage from './InventoryReceivePage';
import InventoryDispatchPage from './InventoryDispatchPage';
import InventoryHistoryPage from './InventoryHistoryPage';

export default function InventoryDashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('stock');

  return (
    <div className="flex h-dvh font-sans overflow-hidden">
      <Sidebar 
        open={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        activeKey="inventory" 
      />

      <div className="flex-1 flex flex-col min-w-0 md:ml-[280px]">
        <header className="flex flex-col p-4 bg-white/60 backdrop-blur-md border-b border-white/50 shrink-0 gap-4">
          <div className="flex items-center">
            <button 
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 mr-4 rounded-xl text-[#185FA5] border border-white/50">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="font-bold text-[#042C53] text-xl flex items-center gap-2">
              <svg className="w-6 h-6 text-[#378ADD]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              ระบบคลังสินค้า (Inventory)
            </h1>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
            <button type="button" onClick={() => setActiveTab('stock')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'stock' ? 'bg-[#185FA5] text-white shadow-md' : 'glass text-[#042C53] hover:bg-[#E6F1FB]'}`}>สินค้าคงเหลือ (Stock)</button>
            <button type="button" onClick={() => setActiveTab('receive')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'receive' ? 'bg-[#185FA5] text-white shadow-md' : 'glass text-[#042C53] hover:bg-[#E6F1FB]'}`}>นำเข้า (Receive)</button>
            <button type="button" onClick={() => setActiveTab('dispatch')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'dispatch' ? 'bg-[#185FA5] text-white shadow-md' : 'glass text-[#042C53] hover:bg-[#E6F1FB]'}`}>เบิกจ่าย (Dispatch)</button>
            <button type="button" onClick={() => setActiveTab('history')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'history' ? 'bg-[#185FA5] text-white shadow-md' : 'glass text-[#042C53] hover:bg-[#E6F1FB]'}`}>ประวัติ (History)</button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 relative">
          {activeTab === 'stock' && <InventoryStockPage />}
          {activeTab === 'receive' && <InventoryReceivePage />}
          {activeTab === 'dispatch' && <InventoryDispatchPage />}
          {activeTab === 'history' && <InventoryHistoryPage />}
        </main>
      </div>
    </div>
  );
}
