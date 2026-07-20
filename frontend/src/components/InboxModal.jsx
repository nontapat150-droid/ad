import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import Swal from 'sweetalert2';
import { AppSelectField } from './DispatchFilterFields';
import {
  notificationTypeLabel,
  resolveNotificationPath,
  notificationHasLink,
  notificationLinkHint,
} from '../utils/notificationUi';

export default function InboxModal({ open, onClose, onReadMessage }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('alerts'); // 'alerts' | 'inbox' | 'sent' | 'compose'
  const [messages, setMessages] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notifUnread, setNotifUnread] = useState(0);

  const [receiverId, setReceiverId] = useState('');
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    if (open) {
      if (activeTab === 'alerts') fetchNotifications();
      else if (activeTab === 'inbox') fetchInbox();
      else if (activeTab === 'sent') fetchSent();
      else if (activeTab === 'compose') fetchUsers();

      setError(null);
      setSuccessMsg(null);
    }
  }, [open, activeTab]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const [listRes, countRes] = await Promise.all([
        api.get('/notifications?limit=50'),
        api.get('/notifications/unread-count'),
      ]);
      setNotifications(Array.isArray(listRes.data) ? listRes.data : []);
      setNotifUnread(Number(countRes.data?.count) || 0);
    } catch (err) {
      setError('ไม่สามารถดึงการแจ้งเตือนได้');
    } finally {
      setLoading(false);
    }
  };

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
        message: messageText,
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
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, is_read: 1 } : m)));
      if (onReadMessage) onReadMessage();
    } catch (err) {
      console.error('Failed to mark read', err);
    }
  };

  const handleNotifRead = async (n) => {
    if (n.is_read) return;
    try {
      await api.put(`/notifications/${n.id}/read`);
      setNotifications((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x))
      );
      setNotifUnread((c) => Math.max(0, c - 1));
      if (onReadMessage) onReadMessage();
    } catch (err) {
      console.error('Failed to mark notification read', err);
    }
  };

  const handleNotifClick = async (n) => {
    await handleNotifRead(n);
    const path = resolveNotificationPath(n.data?.path);
    if (path) {
      onClose();
      navigate(path);
    }
  };

  const handleReadAllNotifs = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setNotifUnread(0);
      if (onReadMessage) onReadMessage();
    } catch (err) {
      console.error('Failed to read-all notifications', err);
    }
  };

  const handleDeleteNotif = async (e, id) => {
    e.stopPropagation();
    try {
      const result = await Swal.fire({
        title: 'ลบการแจ้งเตือน?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: 'ลบ',
        cancelButtonText: 'ยกเลิก',
      });
      if (!result.isConfirmed) return;
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (onReadMessage) onReadMessage();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ' });
    }
  };

  const formatDate = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleString('th-TH', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleReply = (e, msg) => {
    e.stopPropagation();
    if (!msg.is_read) handleMarkAsRead(msg.id, false);

    setReceiverId(msg.sender_id.toString());
    setMessageText('');
    setActiveTab('compose');
  };

  const handleDeleteMessage = async (e, id) => {
    e.stopPropagation();
    try {
      const result = await Swal.fire({
        title: 'ยืนยันการลบ?',
        text: 'คุณแน่ใจหรือไม่ว่าต้องการลบข้อความนี้?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: 'ใช่, ลบเลย!',
        cancelButtonText: 'ยกเลิก',
      });

      if (result.isConfirmed) {
        await api.delete(`/messages/${id}`);
        setMessages(messages.filter((m) => m.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete message', err);
      Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: 'ไม่สามารถลบข้อความได้' });
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end md:justify-center md:items-center p-0 md:p-4 animate-fade-in">
      <div
        className="absolute inset-0 bg-[#042C53]/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg h-[90vh] md:h-[600px] mt-auto md:mt-0 glass border border-white/50 md:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col transform transition-transform duration-300">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/30 bg-white/40 md:rounded-t-3xl rounded-t-3xl shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white shadow-md">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
            </div>
            <h2 className="text-[#042C53] font-bold text-lg">การแจ้งเตือน</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full glass border border-white/50 text-[#042C53] hover:bg-white/50 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="flex border-b border-white/30 px-2 pt-2 shrink-0 overflow-x-auto">
          {[
            { key: 'alerts', label: 'แจ้งเตือน', badge: notifUnread },
            { key: 'inbox', label: 'ข้อความ' },
            { key: 'sent', label: 'ส่งแล้ว' },
            { key: 'compose', label: 'เขียน' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 min-w-[72px] py-3 text-xs sm:text-sm font-semibold transition-all relative ${
                activeTab === tab.key
                  ? 'text-[#185FA5] border-b-2 border-[#185FA5]'
                  : 'text-slate-500 hover:text-[#378ADD]'
              }`}
            >
              {tab.label}
              {tab.badge > 0 && (
                <span className="absolute top-1.5 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold leading-4">
                  {tab.badge > 99 ? '99+' : tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar relative">
          {error && <div className="mb-4 p-3 rounded-xl bg-red-100/80 border border-red-200 text-red-600 text-sm font-medium">{error}</div>}
          {successMsg && <div className="mb-4 p-3 rounded-xl bg-emerald-100/80 border border-emerald-200 text-emerald-600 text-sm font-medium">{successMsg}</div>}

          {activeTab === 'alerts' && (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  ระบบแจ้งเหตุการณ์ · ไม่ซ้ำ
                </p>
                {notifUnread > 0 && (
                  <button
                    type="button"
                    onClick={handleReadAllNotifs}
                    className="text-[11px] font-bold text-[#185FA5] hover:underline"
                  >
                    อ่านทั้งหมด
                  </button>
                )}
              </div>
              {loading ? (
                <div className="flex justify-center py-10"><span className="loading loading-spinner text-brand-500"></span></div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 bg-white/50 rounded-full flex items-center justify-center text-2xl shadow-sm border border-white/60">🔔</div>
                  <p className="text-[#042C53] font-semibold">ยังไม่มีการแจ้งเตือน</p>
                  <p className="text-xs text-slate-500 mt-1">เมื่อมีงานหรือเหตุการณ์ที่เกี่ยวข้อง จะแสดงที่นี่</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((n) => {
                    const isUnread = !n.is_read;
                    const hasLink = notificationHasLink(n);
                    const linkHint = notificationLinkHint(n);
                    return (
                      <div
                        key={n.id}
                        onClick={() => handleNotifClick(n)}
                        className={`p-4 rounded-2xl border transition-all ${hasLink ? 'cursor-pointer' : 'cursor-default'} ${
                          isUnread
                            ? 'bg-white/90 border-[#A3E635]/50 shadow-md hover:shadow-lg'
                            : 'glass border-white/50 opacity-90 hover:shadow-md'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2 mb-1.5">
                          <div className="min-w-0">
                            <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide bg-[#E6F1FB] text-[#185FA5] border border-[#185FA5]/15 mb-1">
                              {notificationTypeLabel(n.type)}
                            </span>
                            <p className={`text-sm leading-snug ${isUnread ? 'font-bold text-[#042C53]' : 'font-semibold text-slate-700'}`}>
                              {n.title}
                            </p>
                          </div>
                          <span className="text-[10px] text-slate-500 font-medium shrink-0">{formatDate(n.created_at)}</span>
                        </div>
                        {n.body && (
                          <p className={`text-sm leading-relaxed whitespace-pre-line ${isUnread ? 'text-[#185FA5]' : 'text-slate-600'}`}>
                            {n.body}
                          </p>
                        )}
                        <div className="mt-3 flex justify-between items-center">
                          <button
                            type="button"
                            onClick={(e) => handleDeleteNotif(e, n.id)}
                            className="text-[11px] font-semibold text-rose-500 flex items-center gap-1 hover:text-rose-700 bg-white/50 px-2.5 py-1 rounded-lg border border-rose-500/20"
                          >
                            ลบ
                          </button>
                          <div className="flex items-center gap-2">
                            {hasLink && linkHint && (
                              <span className="text-[10px] font-semibold text-[#185FA5] bg-[#E6F1FB] px-2 py-1 rounded-md border border-[#185FA5]/15">
                                {linkHint} →
                              </span>
                            )}
                            {isUnread && (
                              <span className="text-[10px] font-semibold text-[#65a30d] bg-[#A3E635]/15 px-2 py-1 rounded-md border border-[#A3E635]/30">
                                ใหม่
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

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
                  {messages.map((msg) => {
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
                          {msg.message || msg.body || msg.title || ''}
                        </p>

                        <div className="mt-3 flex justify-between items-center">
                          <div className="flex gap-2">
                            {activeTab === 'inbox' && (
                              <button
                                onClick={(e) => handleReply(e, msg)}
                                className="text-[11px] font-semibold text-[#185FA5] flex items-center gap-1 hover:text-[#042C53] transition-colors bg-white/50 px-2.5 py-1 rounded-lg border border-[#185FA5]/20 hover:border-[#185FA5]/50 active:scale-95"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
                                ตอบกลับ
                              </button>
                            )}
                            <button
                              onClick={(e) => handleDeleteMessage(e, msg.id)}
                              className="text-[11px] font-semibold text-rose-500 flex items-center gap-1 hover:text-rose-700 transition-colors bg-white/50 px-2.5 py-1 rounded-lg border border-rose-500/20 hover:border-rose-500/50 active:scale-95"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              ลบ
                            </button>
                          </div>

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

          {activeTab === 'compose' && (
            <form onSubmit={handleSendMessage} className="flex flex-col h-full">
              <div className="mb-4">
                <AppSelectField
                  label="ส่งถึงใคร?"
                  value={receiverId}
                  onChange={setReceiverId}
                  options={users.map((u) => ({ value: String(u.id), label: `${u.full_name} (${u.role})` }))}
                  placeholder="เลือกผู้รับ"
                  searchable
                  allowClear={false}
                />
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
