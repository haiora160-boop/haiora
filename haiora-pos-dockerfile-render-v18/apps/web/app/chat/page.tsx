'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Hash, MessageCircle, RefreshCw, Search, Send, UserRound, Users } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { apiFetch } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth-store';

type ChatUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
  branchId?: string | null;
};

type ChatMessage = {
  id: string;
  tenantId: string;
  branchId?: string | null;
  senderId?: string | null;
  recipientId?: string | null;
  content: string;
  createdAt: string;
  sender?: { id: string; fullName: string; role: string; avatarUrl?: string | null } | null;
  recipient?: { id: string; fullName: string; role: string; avatarUrl?: string | null } | null;
};

function initials(name?: string) {
  return (name || 'U')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function roleLabel(role?: string) {
  const labels: Record<string, string> = {
    OWNER: 'Chủ quán',
    MANAGER: 'Quản lý',
    CASHIER: 'Thu ngân',
    WAITER: 'Phục vụ',
    KITCHEN: 'Bếp',
    BAR: 'Pha chế',
    ACCOUNTANT: 'Kế toán',
  };
  return labels[role || ''] || role || 'Nhân viên';
}

function Avatar({ user, size = 'md' }: { user?: { fullName?: string; avatarUrl?: string | null } | null; size?: 'sm' | 'md' }) {
  const className = size === 'sm' ? 'h-8 w-8 text-[11px]' : 'h-10 w-10 text-xs';
  if (user?.avatarUrl) return <img src={user.avatarUrl} alt="avatar" className={`${className} rounded-full object-cover`} />;
  return <div className={`${className} grid place-items-center rounded-full bg-slate-200 font-black text-slate-700 dark:bg-slate-800 dark:text-white`}>{initials(user?.fullName)}</div>;
}

export default function ChatPage() {
  const { token, user } = useAuthStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [contacts, setContacts] = useState<ChatUser[]>([]);
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('');
  const [mode, setMode] = useState<'branch' | 'private'>('branch');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [keyword, setKeyword] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const selectedContact = contacts.find((item) => item.id === selectedUserId) || null;

  const filteredContacts = useMemo(() => {
    const text = keyword.trim().toLowerCase();
    if (!text) return contacts;
    return contacts.filter((item) => `${item.fullName} ${item.email} ${roleLabel(item.role)}`.toLowerCase().includes(text));
  }, [contacts, keyword]);

  function messageBelongsToCurrentRoom(message: ChatMessage) {
    if (mode === 'branch') return !message.recipientId;
    if (!selectedUserId || !user?.id) return false;
    return (
      (message.senderId === user.id && message.recipientId === selectedUserId) ||
      (message.senderId === selectedUserId && message.recipientId === user.id)
    );
  }

  async function loadContacts() {
    if (!token) return;
    const data = await apiFetch<ChatUser[]>('/chat/contacts', { token });
    setContacts(data);
  }

  async function reload() {
    if (!token) return;
    try {
      const query = mode === 'private'
        ? `/chat/messages?mode=private&recipientId=${encodeURIComponent(selectedUserId)}`
        : '/chat/messages?mode=branch';
      if (mode === 'private' && !selectedUserId) {
        setMessages([]);
        setStatus('Chọn một nhân viên để bắt đầu chat riêng.');
        return;
      }
      const data = await apiFetch<ChatMessage[]>(query, { token });
      setMessages(data);
      setStatus('');
    } catch (error: any) {
      setStatus(error.message || 'Không tải được tin nhắn');
    }
  }

  useEffect(() => {
    loadContacts().catch(console.error);
  }, [token]);

  useEffect(() => {
    reload().catch(console.error);
  }, [token, mode, selectedUserId]);

  useEffect(() => {
    if (!user?.tenantId) return;
    const socket = getSocket();
    socket.emit('joinBranch', { tenantId: user.tenantId, branchId: user.branchId });
    socket.emit('joinUser', { userId: user.id });

    const addMessage = (message: ChatMessage) => {
      if (!messageBelongsToCurrentRoom(message)) return;
      setMessages((current) => (current.some((item) => item.id === message.id) ? current : [...current, message]));
    };

    socket.on('chat.message_created', addMessage);
    socket.on('chat.private_message_created', addMessage);
    return () => {
      socket.off('chat.message_created', addMessage);
      socket.off('chat.private_message_created', addMessage);
    };
  }, [user?.tenantId, user?.branchId, user?.id, mode, selectedUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function sendMessage() {
    if (!token || !content.trim()) return;
    if (mode === 'private' && !selectedUserId) {
      setStatus('Hãy chọn người nhận để gửi tin nhắn riêng.');
      return;
    }
    const text = content.trim();
    setContent('');
    try {
      const message = await apiFetch<ChatMessage>('/chat/messages', {
        method: 'POST',
        token,
        body: JSON.stringify({
          content: text,
          branchId: mode === 'branch' ? user?.branchId : null,
          recipientId: mode === 'private' ? selectedUserId : null,
        }),
      });
      setMessages((current) => (current.some((item) => item.id === message.id) ? current : [...current, message]));
      setStatus('');
    } catch (error: any) {
      setContent(text);
      setStatus(error.message || 'Không gửi được tin nhắn');
    }
  }

  const roomTitle = mode === 'private' && selectedContact ? `Chat riêng với ${selectedContact.fullName}` : 'Phòng chat chung chi nhánh';
  const roomHint = mode === 'private'
    ? 'Tin nhắn riêng chỉ hiển thị trong cuộc trò chuyện 1-1 giữa hai tài khoản.'
    : 'Tin nhắn chung dùng để trao đổi công việc trong workspace/chi nhánh.';

  return (
    <AppShell>
      <div className="grid h-[calc(100vh-96px)] gap-4 xl:grid-cols-[320px_1fr]">
        <aside className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 p-4 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--kv-primary)] text-white"><MessageCircle /></div>
              <div>
                <h1 className="text-lg font-black">Chat công việc</h1>
                <p className="text-xs font-semibold text-slate-500">Chat chung hoặc chat riêng 1-1.</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              <button onClick={() => setMode('branch')} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-black ${mode === 'branch' ? 'bg-white text-[var(--kv-primary)] shadow-sm dark:bg-slate-950' : 'text-slate-500'}`}>
                <Hash size={15} /> Chung
              </button>
              <button onClick={() => setMode('private')} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-black ${mode === 'private' ? 'bg-white text-[var(--kv-primary)] shadow-sm dark:bg-slate-950' : 'text-slate-500'}`}>
                <UserRound size={15} /> Riêng
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
              <Search size={16} className="text-slate-400" />
              <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm nhân viên..." className="w-full bg-transparent text-sm font-bold outline-none" />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <button
              onClick={() => { setMode('branch'); setSelectedUserId(''); }}
              className={`mb-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${mode === 'branch' ? 'bg-[var(--kv-primary)] text-white shadow-sm' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              <div className={`grid h-10 w-10 place-items-center rounded-full ${mode === 'branch' ? 'bg-white/20' : 'bg-blue-50 text-[var(--kv-primary)] dark:bg-slate-800'}`}><Users size={18} /></div>
              <div>
                <p className="font-black">Phòng chung</p>
                <p className={`text-xs font-semibold ${mode === 'branch' ? 'text-white/75' : 'text-slate-500'}`}>Tất cả nhân sự trong chi nhánh</p>
              </div>
            </button>

            <p className="px-3 py-2 text-[11px] font-black uppercase tracking-wider text-slate-400">Nhắn riêng</p>
            <div className="space-y-1">
              {filteredContacts.map((contact) => {
                const active = mode === 'private' && selectedUserId === contact.id;
                return (
                  <button
                    key={contact.id}
                    onClick={() => { setMode('private'); setSelectedUserId(contact.id); }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${active ? 'bg-[var(--kv-primary)] text-white shadow-sm' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  >
                    <Avatar user={contact} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-black">{contact.fullName}</p>
                      <p className={`truncate text-xs font-semibold ${active ? 'text-white/75' : 'text-slate-500'}`}>{roleLabel(contact.role)} · {contact.email}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <section className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
            <div className="flex items-center gap-3">
              {mode === 'private' ? <Avatar user={selectedContact} /> : <div className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--kv-primary)] text-white"><Hash /></div>}
              <div>
                <h2 className="text-xl font-black">{roomTitle}</h2>
                <p className="text-sm font-semibold text-slate-500">{roomHint}</p>
              </div>
            </div>
            <button onClick={reload} className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-black dark:bg-slate-800"><RefreshCw size={16} /> Tải lại</button>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950/40">
            {messages.map((message) => {
              const mine = message.senderId === user?.id;
              return (
                <div key={message.id} className={`flex gap-3 ${mine ? 'justify-end' : 'justify-start'}`}>
                  {!mine && <Avatar user={message.sender} size="sm" />}
                  <div className={`max-w-[78%] rounded-2xl px-4 py-3 shadow-sm ${mine ? 'bg-[var(--kv-primary)] text-white' : 'bg-white dark:bg-slate-900'}`}>
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-xs font-black opacity-80">
                      <span>{message.sender?.fullName || 'Hệ thống'}</span>
                      <span>·</span>
                      <span>{roleLabel(message.sender?.role)}</span>
                      {message.recipient && <><span>→</span><span>{message.recipient.fullName}</span></>}
                      <span>·</span>
                      <span>{new Date(message.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm font-semibold leading-relaxed">{message.content}</p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-slate-200 p-4 dark:border-slate-800">
            {status && <p className="mb-2 rounded-lg bg-red-50 p-2 text-sm font-bold text-red-700 dark:bg-red-950/30">{status}</p>}
            <div className="flex gap-2">
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage().catch(console.error);
                  }
                }}
                placeholder={mode === 'private' ? 'Nhập tin nhắn riêng...' : 'Nhập tin nhắn công việc trong phòng chung...'}
                className="min-h-[48px] flex-1 resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[var(--kv-primary)] dark:border-slate-700 dark:bg-slate-800"
              />
              <button onClick={() => sendMessage()} className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--kv-primary)] text-white"><Send size={20} /></button>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
