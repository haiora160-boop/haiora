'use client';

import { useEffect, useState } from 'react';
import { Camera, Save, UserCircle } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { apiFetch } from '@/lib/api';
import { uploadImage } from '@/lib/upload';
import { useAuthStore } from '@/stores/auth-store';

export default function ProfilePage() {
  const { token, user, updateUser } = useAuthStore();
  const [form, setForm] = useState({ fullName: '', phone: '', avatarUrl: '' });
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setForm({ fullName: user?.fullName || '', phone: user?.phone || '', avatarUrl: user?.avatarUrl || '' });
  }, [user?.id]);

  async function handleAvatarUpload(file?: File) {
    if (!file || !token) return;
    try {
      setUploading(true);
      const url = await uploadImage(file, token, 'avatars');
      setForm((current) => ({ ...current, avatarUrl: url }));
      setMessage('Đã upload avatar. Bấm Lưu hồ sơ để cập nhật tài khoản.');
    } catch (err: any) {
      setMessage(err.message || 'Không upload được avatar');
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!token) return;
    try {
      const updated = await apiFetch<typeof user>('/auth/profile', { method: 'PATCH', token, body: JSON.stringify(form) });
      if (updated) updateUser(updated);
      setMessage('Đã cập nhật hồ sơ và avatar.');
    } catch (err: any) {
      setMessage(err.message || 'Không cập nhật được hồ sơ');
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <div className="rounded-[2rem] bg-white p-6 shadow-soft dark:bg-slate-900">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="relative">
              {form.avatarUrl ? (
                <img src={form.avatarUrl} alt="avatar" className="h-32 w-32 rounded-full object-cover ring-4 ring-pink-500" />
              ) : (
                <div className="grid h-32 w-32 place-items-center rounded-full bg-gradient-to-br from-pink-500 to-indigo-600 text-4xl font-black text-white"><UserCircle size={54} /></div>
              )}
              <label className="absolute bottom-1 right-1 grid h-10 w-10 cursor-pointer place-items-center rounded-full bg-slate-950 text-white">
                <Camera size={18} />
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleAvatarUpload(e.target.files?.[0])} />
              </label>
            </div>
            <div>
              <p className="text-sm font-bold text-pink-600">Tài khoản cá nhân</p>
              <h1 className="text-3xl font-black">Cập nhật avatar & thông tin</h1>
              <p className="mt-2 text-slate-500">Mỗi tài khoản có thể tự cập nhật hình đại diện để giao diện giống mạng xã hội hơn.</p>
            </div>
          </div>

          <div className="mt-8 space-y-4">
            <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Họ tên" className="w-full rounded-2xl border border-slate-200 bg-white p-4 outline-none focus:border-pink-500 dark:border-slate-700 dark:bg-slate-800" />
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Số điện thoại" className="w-full rounded-2xl border border-slate-200 bg-white p-4 outline-none focus:border-pink-500 dark:border-slate-700 dark:bg-slate-800" />
            <input value={form.avatarUrl} onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })} placeholder={uploading ? 'Đang upload avatar...' : 'Link avatar hoặc upload bằng nút camera'} className="w-full rounded-2xl border border-slate-200 bg-white p-4 outline-none focus:border-pink-500 dark:border-slate-700 dark:bg-slate-800" />
            <div className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500 dark:bg-slate-800/70">
              Email đăng nhập: {user?.email} · Quyền: {user?.role}
            </div>
            <button onClick={save} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-pink-500 to-indigo-600 py-4 font-black text-white"><Save size={18} /> Lưu hồ sơ</button>
            {message && <p className="rounded-2xl bg-blue-50 p-4 font-bold text-blue-700 dark:bg-blue-950/30">{message}</p>}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
