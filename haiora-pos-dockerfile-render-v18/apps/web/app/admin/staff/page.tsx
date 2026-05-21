'use client';

import { useEffect, useState } from 'react';
import { DollarSign, KeyRound, Save, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { apiFetch } from '@/lib/api';
import { uploadImage } from '@/lib/upload';
import { useAuthStore } from '@/stores/auth-store';

type Staff = {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  role: string;
  status: string;
  employeeCode?: string | null;
  position?: string | null;
  salaryPerShift?: string | number | null;
  salaryPerHour?: string | number | null;
  commissionRate?: string | number | null;
  allowCancelBill?: boolean;
  allowDiscount?: boolean;
  allowEditPrice?: boolean;
  allowPayments?: boolean;
  branch?: { name: string } | null;
};

type Branch = { id: string; name: string };

const roles = [
  { value: 'MANAGER', label: 'Quản lý' },
  { value: 'CASHIER', label: 'Thu ngân' },
  { value: 'WAITER', label: 'Nhân viên order' },
  { value: 'KITCHEN', label: 'Bếp' },
  { value: 'BAR', label: 'Bar' },
  { value: 'ACCOUNTANT', label: 'Kế toán' },
];

export default function StaffAdminPage() {
  const { token, user } = useAuthStore();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: 'Admin@123456', role: 'WAITER', branchId: '', avatarUrl: '', employeeCode: '', position: '', salaryPerShift: '0', salaryPerHour: '0', commissionRate: '0', allowCancelBill: false, allowDiscount: false, allowEditPrice: false, allowPayments: true });

  async function reload() {
    if (!token) return;
    const [users, branchList] = await Promise.all([
      apiFetch<Staff[]>('/users', { token }),
      apiFetch<Branch[]>('/branches', { token }),
    ]);
    setStaff(users);
    setBranches(branchList);
    if (!form.branchId && (user?.branchId || branchList[0]?.id)) setForm((old) => ({ ...old, branchId: user?.branchId || branchList[0].id }));
  }

  useEffect(() => {
    reload().catch(console.error);
  }, [token]);

  async function handleAvatarUpload(file?: File) {
    if (!file || !token) return;
    try {
      setUploading(true);
      const url = await uploadImage(file, token, 'avatars');
      setForm((current) => ({ ...current, avatarUrl: url }));
      setMessage('Đã upload avatar nhân viên. Bấm Cấp tài khoản để lưu.');
    } catch (err: any) {
      setMessage(err.message || 'Không upload được avatar');
    } finally {
      setUploading(false);
    }
  }

  async function createStaff() {
    if (!token) return;
    try {
      await apiFetch('/users', { method: 'POST', token, body: JSON.stringify({ ...form, salaryPerShift: Number(form.salaryPerShift || 0), salaryPerHour: Number(form.salaryPerHour || 0), commissionRate: Number(form.commissionRate || 0) }) });
      setMessage('Đã cấp tài khoản và quyền đăng nhập.');
      setForm({ fullName: '', email: '', phone: '', password: 'Admin@123456', role: 'WAITER', branchId: form.branchId, avatarUrl: '', employeeCode: '', position: '', salaryPerShift: '0', salaryPerHour: '0', commissionRate: '0', allowCancelBill: false, allowDiscount: false, allowEditPrice: false, allowPayments: true });
      await reload();
    } catch (err: any) {
      setMessage(err.message || 'Không tạo được tài khoản');
    }
  }

  async function updateStaffAvatar(id: string, file?: File) {
    if (!file || !token) return;
    try {
      const avatarUrl = await uploadImage(file, token, 'avatars');
      await apiFetch(`/users/${id}`, { method: 'PATCH', token, body: JSON.stringify({ avatarUrl }) });
      setMessage('Đã cập nhật avatar tài khoản.');
      await reload();
    } catch (err: any) {
      setMessage(err.message || 'Không cập nhật được avatar');
    }
  }

  async function updateRole(id: string, role: string) {
    if (!token) return;
    await apiFetch(`/users/${id}`, { method: 'PATCH', token, body: JSON.stringify({ role }) });
    await reload();
  }

  async function toggleStatus(item: Staff) {
    if (!token) return;
    const status = item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await apiFetch(`/users/${item.id}`, { method: 'PATCH', token, body: JSON.stringify({ status }) });
    await reload();
  }


  async function updateSalary(item: Staff) {
    if (!token || user?.role !== 'OWNER') return;
    const salaryPerHour = window.prompt('Nhập lương theo giờ', String(item.salaryPerHour || 0));
    if (salaryPerHour === null) return;
    const salaryPerShift = window.prompt('Nhập lương theo ca (tùy chọn)', String(item.salaryPerShift || 0));
    if (salaryPerShift === null) return;
    const commissionRate = window.prompt('Nhập % hoa hồng', String(item.commissionRate || 0));
    if (commissionRate === null) return;
    try {
      await apiFetch(`/hr/salary/${item.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ salaryPerHour: Number(salaryPerHour || 0), salaryPerShift: Number(salaryPerShift || 0), commissionRate: Number(commissionRate || 0) }),
      });
      setMessage('Đã cập nhật lương/giờ, lương/ca và hoa hồng.');
      await reload();
    } catch (err: any) {
      setMessage(err.message || 'Không cập nhật được lương');
    }
  }

  async function deleteStaff(item: Staff) {
    if (!token || user?.role !== 'OWNER') return;
    if (!window.confirm(`Xóa tài khoản ${item.fullName}? Thao tác này sẽ ghi vào nhật ký hệ thống.`)) return;
    try {
      await apiFetch(`/users/${item.id}`, { method: 'DELETE', token });
      setMessage('Đã xóa tài khoản nhân viên.');
      await reload();
    } catch (err: any) {
      setMessage(err.message || 'Không xóa được tài khoản');
    }
  }

  return (
    <AppShell>
      <div className="mb-6">
        <p className="text-sm font-bold text-pink-600">Admin / Phân quyền</p>
        <h1 className="text-3xl font-black">Cấp tài khoản order, thu ngân, bếp</h1>
      </div>

      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <section className="rounded-[2rem] bg-white p-5 shadow-soft dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-pink-100 text-pink-600 dark:bg-pink-950/50"><UserPlus /></div>
            <div>
              <h2 className="font-black">Tạo tài khoản mới</h2>
              <p className="text-sm text-slate-500">Cấp quyền order/thu ngân/bếp theo chi nhánh.</p>
            </div>
          </div>

          <div className="space-y-3">
            <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Họ tên" className="w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none focus:border-pink-500 dark:border-slate-700 dark:bg-slate-800" />
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email đăng nhập" className="w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none focus:border-pink-500 dark:border-slate-700 dark:bg-slate-800" />
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Số điện thoại" className="w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none focus:border-pink-500 dark:border-slate-700 dark:bg-slate-800" />
            <div className="grid grid-cols-2 gap-3">
              <input value={form.employeeCode} onChange={(e) => setForm({ ...form, employeeCode: e.target.value })} placeholder="Mã NV" className="rounded-2xl border border-slate-200 bg-white p-3 outline-none focus:border-pink-500 dark:border-slate-700 dark:bg-slate-800" />
              <input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="Vị trí: Phục vụ/Thu ngân" className="rounded-2xl border border-slate-200 bg-white p-3 outline-none focus:border-pink-500 dark:border-slate-700 dark:bg-slate-800" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <input type="number" value={form.salaryPerHour} onChange={(e) => setForm({ ...form, salaryPerHour: e.target.value })} placeholder="Lương/giờ" className="rounded-2xl border border-slate-200 bg-white p-3 outline-none focus:border-pink-500 dark:border-slate-700 dark:bg-slate-800" />
              <input type="number" value={form.salaryPerShift} onChange={(e) => setForm({ ...form, salaryPerShift: e.target.value })} placeholder="Lương/ca" className="rounded-2xl border border-slate-200 bg-white p-3 outline-none focus:border-pink-500 dark:border-slate-700 dark:bg-slate-800" />
              <input type="number" value={form.commissionRate} onChange={(e) => setForm({ ...form, commissionRate: e.target.value })} placeholder="Hoa hồng %" className="rounded-2xl border border-slate-200 bg-white p-3 outline-none focus:border-pink-500 dark:border-slate-700 dark:bg-slate-800" />
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
              <KeyRound size={18} className="text-slate-400" />
              <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mật khẩu tạm" className="w-full bg-transparent outline-none" />
            </div>
            <div className="rounded-2xl border border-dashed border-pink-300 bg-pink-50/50 p-3 dark:border-pink-900 dark:bg-pink-950/20">
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 font-black text-pink-600 shadow-sm dark:bg-slate-800">
                <UserPlus size={18} /> {uploading ? 'Đang upload avatar...' : 'Upload avatar nhân viên'}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleAvatarUpload(e.target.files?.[0])} />
              </label>
              <input value={form.avatarUrl} onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })} placeholder="Hoặc dán link avatar nhân viên" className="mt-3 w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none focus:border-pink-500 dark:border-slate-700 dark:bg-slate-800" />
              {form.avatarUrl && <img src={form.avatarUrl} alt="avatar preview" className="mt-3 h-24 w-24 rounded-full object-cover ring-2 ring-pink-500" />}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="rounded-2xl border border-slate-200 bg-white p-3 outline-none focus:border-pink-500 dark:border-slate-700 dark:bg-slate-800">
                {roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
              </select>
              <select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })} className="rounded-2xl border border-slate-200 bg-white p-3 outline-none focus:border-pink-500 dark:border-slate-700 dark:bg-slate-800">
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-3 text-sm font-bold dark:bg-slate-800">
              <label className="flex items-center gap-2 text-emerald-700"><input type="checkbox" checked readOnly /> Thanh toán: tất cả tài khoản</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.allowDiscount} onChange={(e) => setForm({ ...form, allowDiscount: e.target.checked })} /> Giảm món/bill</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.allowEditPrice} onChange={(e) => setForm({ ...form, allowEditPrice: e.target.checked })} /> Sửa giá</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.allowCancelBill} onChange={(e) => setForm({ ...form, allowCancelBill: e.target.checked })} /> Hủy bill</label>
            </div>
            <button onClick={createStaff} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-pink-500 to-indigo-600 py-4 font-black text-white"><Save size={18} /> Cấp tài khoản</button>
            {message && <p className="rounded-2xl bg-blue-50 p-3 text-sm font-bold text-blue-700 dark:bg-blue-950/30">{message}</p>}
          </div>
        </section>

        <section className="rounded-[2rem] bg-white p-5 shadow-soft dark:bg-slate-900">
          <h2 className="mb-4 text-xl font-black">Danh sách tài khoản</h2>
          <div className="space-y-3">
            {staff.map((item) => (
              <div key={item.id} className="flex flex-col gap-3 rounded-3xl bg-slate-50 p-4 dark:bg-slate-800/70 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <label className="relative cursor-pointer" title="Bấm để upload avatar">
                    {item.avatarUrl ? <img src={item.avatarUrl} alt={item.fullName} className="h-14 w-14 rounded-full object-cover ring-2 ring-pink-500" /> : <div className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-pink-500 to-indigo-600 font-black text-white">{item.fullName[0]}</div>}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => updateStaffAvatar(item.id, e.target.files?.[0])} />
                  </label>
                  <div>
                    <p className="font-black">{item.fullName}</p>
                    <p className="text-sm text-slate-500">{item.email} · {item.branch?.name || 'Chưa gán chi nhánh'}</p>
                    <p className="text-xs font-bold text-slate-400">{item.employeeCode || 'Chưa mã NV'} · {item.position || item.role} · Lương/giờ: {Number(item.salaryPerHour || 0).toLocaleString('vi-VN')}đ · Lương/ca: {Number(item.salaryPerShift || 0).toLocaleString('vi-VN')}đ · HH: {Number(item.commissionRate || 0)}%</p>
                    <p className="text-xs font-bold text-slate-400">Quyền: Thanh toán mọi tài khoản · {item.allowDiscount ? 'Giảm ' : ''}{item.allowEditPrice ? 'Sửa giá ' : ''}{item.allowCancelBill ? 'Hủy bill ' : ''} · Trạng thái: {item.status}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select value={item.role} onChange={(e) => updateRole(item.id, e.target.value)} className="rounded-2xl bg-white px-3 py-2 text-sm font-bold dark:bg-slate-700">
                    <option value="OWNER">Chủ quán</option>
                    {roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                  </select>
                  {user?.role === 'OWNER' && <button onClick={() => updateSalary(item)} className="flex items-center gap-1 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-black text-white"><DollarSign size={15} /> Sửa lương</button>}
                  <button onClick={() => toggleStatus(item)} className="flex items-center gap-1 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white dark:bg-white dark:text-slate-950"><ShieldCheck size={15} /> {item.status === 'ACTIVE' ? 'Tạm khóa' : 'Mở khóa'}</button>
                  {user?.role === 'OWNER' && user.id !== item.id && <button onClick={() => deleteStaff(item)} className="flex items-center gap-1 rounded-2xl bg-red-600 px-4 py-2 text-sm font-black text-white"><Trash2 size={15} /> Xóa</button>}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
