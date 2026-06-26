import { useState, useEffect } from 'react';
import api from '../api/axios';

export default function InboxModal({ open, onClose, onReadMessage }) {
  const [activeTab, setActiveTab] = useState('inbox'); // 'inbox' | 'sent' | 'compose'
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Compose state
  const [receiverId, setReceiverId] = useState('');
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    if (open) {
      if (activeTab === 'inbox') fetchInbox();
      else if (activeTab === 'sent') fetchSent();
      else if (activeTab === 'compose') fetchUsers();
      
      setError(null);
      setSuccessMsg(null);
    }
  }, [open, activeTab]);

  const fetchInbox = async () => {
    try {
      setLoading(true);
      const res = await api.get('/messages/inbox');
      setMessages(res.data);
    } catch (err) {
      setError('ไม่สามารถดึงข้อความเข้าได้');
    } finally {
      setLoading(false);
    }
  };

  const fetchSent = async () => {
    try {
      setLoading(true);
      const res = await api.get('/messages/sent');
      setMessages(res.data);
    } catch (err) {
      setError('ไม่สามารถดึงข้อความที่ส่งได้');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/messages/users');
      setUsers(res.data);
    } catch (err) {
      setError('ไม่สามารถดึงรายชื่อผู้ใช้ได้');
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!receiverId || !messageText.trim()) {
      setError('กรุณาเลือกผู้รับและพิมพ์ข้อความ');
      return;
    }
    
    try {
      setSending(true);
      setError(null);
      await api.post('/messages/send', {
        receiver_id: receiverId,
        message: messageText
      });
      setSuccessMsg('ส่งข้อความสำเร็จ!');
      setMessageText('');
      setReceiverId('');
      setTimeout(() => setActiveTab('sent'), 1500);
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการส่งข้อความ');
    } finally {
      setSending(false);
    }
  };

  const handleMarkAsRead = async (msgId, isRead) => {
    if (isRead) return;
    try {
      await api.put(`/messages/${msgId}/read`);
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, is_read: 1 } : m));
      if (onReadMessage) onReadMessage();
    } catch (err) {
      console.error('Failed to mark read', err);
    }
  };

  const formatDate = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleString('th-TH', { 
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
    });
  };

  const handleReply = (e, msg) => {
    e.stopPropagation();
    if (!msg.is_read) handleMarkAsRead(msg.id, false);
    
    setReceiverId(msg.sender_id.toString());
    setMessageText('');
    setActiveTab('compose');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end md:justify-center md:items-center p-0 md:p-4 animate-fade-in">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-[#042C53]/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal / Drawer */}
      <div className="relative w-full max-w-lg h-[90vh] md:h-[600px] mt-auto md:mt-0 glass border border-white/50 md:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col transform transition-transform duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/30 bg-white/40 md:rounded-t-3xl rounded-t-3xl shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white shadow-md">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-[#042C53] font-bold text-lg">กล่องจดหมาย</h2>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full glass border border-white/50 text-[#042C53] hover:bg-white/50 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/30 px-4 pt-2 shrink-0">
          <button 
            onClick={() => setActiveTab('inbox')}
            className={`flex-1 py-3 text-sm font-semibold transition-all ${activeTab === 'inbox' ? 'text-[#185FA5] border-b-2 border-[#185FA5]' : 'text-slate-500 hover:text-[#378ADD]'}`}
          >
            ข้อความเข้า
          </button>
          <button 
            onClick={() => setActiveTab('sent')}
            className={`flex-1 py-3 text-sm font-semibold transition-all ${activeTab === 'sent' ? 'text-[#185FA5] border-b-2 border-[#185FA5]' : 'text-slate-500 hover:text-[#378ADD]'}`}
          >
            ส่งแล้ว
          </button>
          <button 
            onClick={() => setActiveTab('compose')}
            className={`flex-1 py-3 text-sm font-semibold transition-all ${activeTab === 'compose' ? 'text-[#185FA5] border-b-2 border-[#185FA5]' : 'text-slate-500 hover:text-[#378ADD]'}`}
          >
            ส่งข้อความ
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar relative">
          
          {error && <div className="mb-4 p-3 rounded-xl bg-red-100/80 border border-red-200 text-red-600 text-sm font-medium">{error}</div>}
          {successMsg && <div className="mb-4 p-3 rounded-xl bg-emerald-100/80 border border-emerald-200 text-emerald-600 text-sm font-medium">{successMsg}</div>}

          {/* Inbox & Sent List */}
          {(activeTab === 'inbox' || activeTab === 'sent') && (
            <>
              {loading ? (
                <div className="flex justify-center py-10"><span className="loading loading-spinner text-brand-500"></span></div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 bg-white/50 rounded-full flex items-center justify-center text-2xl shadow-sm border border-white/60">📭</div>
                  <p className="text-[#042C53] font-semibold">ไม่มีข้อความ</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map(msg => {
                    const isUnread = activeTab === 'inbox' && !msg.is_read;
                    return (
                      <div 
                        key={msg.id} 
                        onClick={() => activeTab === 'inbox' && handleMarkAsRead(msg.id, msg.is_read)}
                        className={`p-4 rounded-2xl border transition-all ${
                          isUnread 
                            ? 'bg-white/80 border-[#378ADD]/30 shadow-md cursor-pointer hover:shadow-lg' 
                            : 'glass border-white/50 opacity-90 cursor-default hover:shadow-md'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <p className={`text-sm ${isUnread ? 'font-bold text-[#042C53]' : 'font-semibold text-slate-700'}`}>
                            {activeTab === 'inbox' ? `จาก: ${msg.sender_name}` : `ส่งถึง: ${msg.receiver_name}`}
                          </p>
                          <span className="text-[10px] text-slate-500 font-medium shrink-0 ml-2">{formatDate(msg.created_at)}</span>
                        </div>
                        <p className={`text-sm leading-relaxed ${isUnread ? 'text-[#185FA5] font-medium' : 'text-slate-600'}`}>
                          {msg.message}
                        </p>
                        
                        <div className="mt-3 flex justify-between items-center">
                          {activeTab === 'inbox' ? (
                            <button 
                              onClick={(e) => handleReply(e, msg)}
                              className="text-[11px] font-semibold text-[#185FA5] flex items-center gap-1 hover:text-[#042C53] transition-colors bg-white/50 px-2.5 py-1 rounded-lg border border-[#185FA5]/20 hover:border-[#185FA5]/50 active:scale-95"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
                              ตอบกลับ
                            </button>
                          ) : <div />}
                          
                          {isUnread && (
                            <span className="text-[10px] font-semibold text-[#378ADD] bg-[#E6F1FB] px-2 py-1 rounded-md">
                              ข้อความใหม่
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Compose Form */}
          {activeTab === 'compose' && (
            <form onSubmit={handleSendMessage} className="flex flex-col h-full">
              <div className="mb-4">
                <label className="block text-sm font-semibold text-[#042C53] mb-2">ส่งถึงใคร?</label>
                <select 
                  className="w-full px-4 py-3 rounded-xl glass border border-white/60 focus:border-[#378ADD] focus:ring-2 focus:ring-[#378ADD]/20 outline-none text-[#042C53] transition-all bg-white/50"
                  value={receiverId}
                  onChange={(e) => setReceiverId(e.target.value)}
                  required
                >
                  <option value="">-- เลือกผู้รับ --</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4 flex-1 flex flex-col">
                <label className="block text-sm font-semibold text-[#042C53] mb-2">ข้อความ</label>
                <textarea 
                  className="w-full flex-1 min-h-[150px] px-4 py-3 rounded-xl glass border border-white/60 focus:border-[#378ADD] focus:ring-2 focus:ring-[#378ADD]/20 outline-none text-[#042C53] transition-all bg-white/50 resize-none"
                  placeholder="พิมพ์ข้อความที่ต้องการส่ง..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  required
                ></textarea>
              </div>

              <button 
                type="submit" 
                disabled={sending}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-brand-400 to-brand-600 text-white font-bold shadow-lg shadow-brand-500/30 hover:shadow-brand-500/50 hover:scale-[1.01] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
              >
                {sending ? (
                  <span className="loading loading-spinner w-5 h-5"></span>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                    ส่งข้อความ
                  </>
                )}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
