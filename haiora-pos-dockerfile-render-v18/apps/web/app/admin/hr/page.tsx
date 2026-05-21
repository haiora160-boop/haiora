'use client';

import { useEffect, useMemo, useState } from 'react';
import { BadgePercent, CalendarClock, CheckCircle2, Clock3, ShieldCheck, UserCheck } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

type Staff = { id: string; fullName: string; email: string; avatarUrl?: string | null; role: string; employeeCode?: string | null; commissionRate?: string | number | null; salaryPerShift?: string | number | null };
type Branch = { id: string; name: string };
type WorkShift = { id: string; name: string; startTime: string; endTime: string; color?: string | null };
type Attendance = { id: string; status: string; checkInAt: string; checkOutAt?: string | null; checkInNote?: string | null; user?: Staff; workShift?: WorkShift | null };
type Commission = { id: string; amount: string | number; baseAmount: string | number; rate: string | number; note?: string | null; createdAt: string; user?: Staff };
type RoleInfo = { role: string; label: string; permissions: string[] };

const formatMoney = (value: unknown) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;

export default function HrAdminPage() {
  const { token, user } = useAuthStore();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [workShifts, setWorkShifts] = useState<WorkShift[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [message, setMessage] = useState('');
  const [shiftForm, setShiftForm] = useState({ name: '', startTime: '07:00', endTime: '14:00', branchId: '' });
  const [checkForm, setCheckForm] = useState({ userId: '', workShiftId: '' });
  const [ruleForm, setRuleForm] = useState({ name: '', role: 'WAITER', value: '1' });

  async function reload() {
    if (!token) return;
    const [users, branchList, roleList, shiftList, attendanceList, commissionList] = await Promise.all([
      apiFetch<Staff[]>('/users', { token }),
      apiFetch<Branch[]>('/branches', { token }),
      apiFetch<RoleInfo[]>('/hr/roles', { token }),
      apiFetch<WorkShift[]>('/hr/work-shifts', { token }),
      apiFetch<Attendance[]>('/hr/attendance', { token }),
      apiFetch<Commission[]>('/hr/commissions', { token }),
    ]);
    setStaff(users);
    setBranches(branchList);
    setRoles(roleList);
    setWorkShifts(shiftList);
    setAttendance(attendanceList);
    setCommissions(commissionList);
    const branchId = user?.branchId || branchList[0]?.id || '';
    setShiftForm((current) => ({ ...current, branchId: current.branchId || branchId }));
    setCheckForm((current) => ({ ...current, userId: current.userId || users[0]?.id || '', workShiftId: current.workShiftId || shiftList[0]?.id || '' }));
  }

  useEffect(() => {
    reload().catch(console.error);
  }, [token]);

  const totals = useMemo(() => {
    const totalCommission = commissions.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const checkedIn = attendance.filter((item) => item.status === 'CHECKED_IN').length;
    return { totalCommission, checkedIn };
  }, [attendance, commissions]);

  async function createShift() {
    if (!token) return;
    try {
      await apiFetch('/hr/work-shifts', { method: 'POST', token, body: JSON.stringify(shiftForm) });
      setShiftForm((current) => ({ ...current, name: '' }));
      setMessage('Đã tạo ca làm mới.');
      await reload();
    } catch (error: any) {
      setMessage(error.message || 'Không tạo được ca làm');
    }
  }

  async function checkIn() {
    if (!token) return;
    try {
      await apiFetch('/hr/attendance/check-in', { method: 'POST', token, body: JSON.stringify(checkForm) });
      setMessage('Đã chấm công vào ca.');
      await reload();
    } catch (error: any) {
      setMessage(error.message || 'Không chấm công được');
    }
  }

  async function checkOut(id: string) {
    if (!token) return;
    try {
      await apiFetch(`/hr/attendance/${id}/check-out`, { method: 'POST', token, body: JSON.stringify({ note: 'Chấm ra từ admin HR' }) });
      setMessage('Đã chấm công ra.');
      await reload();
    } catch (error: any) {
      setMessage(error.message || 'Không chấm ra được');
    }
  }

  async function createCommissionRule() {
    if (!token || !user?.branchId) return;
    try {
      await apiFetch('/hr/commission-rules', { method: 'POST', token, body: JSON.stringify({ branchId: user.branchId, name: ruleForm.name || `Hoa hồng ${ruleForm.role}`, role: ruleForm.role, value: Number(ruleForm.value) }) });
      setRuleForm({ name: '', role: 'WAITER', value: '1' });
      setMessage('Đã tạo quy tắc hoa hồng.');
      await reload();
    } catch (error: any) {
      setMessage(error.message || 'Không tạo được hoa hồng');
    }
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="rounded-[2rem] bg-white p-6 shadow-soft dark:bg-slate-900">
          <p className="font-black text-pink-600">Quản lý nhân viên nâng cao</p>
          <h1 className="mt-1 text-3xl font-black">Phân quyền · Chấm công · Ca làm · Hoa hồng</h1>
          <p className="mt-2 text-sm font-semibold text-slate-500">Theo dõi ai đang làm, ai được quyền thu ngân/hủy bill/sửa giá, và tự ghi nhật ký thao tác.</p>
          {message && <p className="mt-4 rounded-2xl bg-blue-50 p-3 text-sm font-bold text-blue-700 dark:bg-blue-950/30">{message}</p>}
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-[1.7rem] bg-white p-5 shadow-soft dark:bg-slate-900"><UserCheck className="text-pink-600" /><p className="mt-3 text-sm font-bold text-slate-500">Nhân viên</p><p className="text-2xl font-black">{staff.length}</p></div>
          <div className="rounded-[1.7rem] bg-white p-5 shadow-soft dark:bg-slate-900"><Clock3 className="text-green-600" /><p className="mt-3 text-sm font-bold text-slate-500">Đang vào ca</p><p className="text-2xl font-black">{totals.checkedIn}</p></div>
          <div className="rounded-[1.7rem] bg-white p-5 shadow-soft dark:bg-slate-900"><CalendarClock className="text-indigo-600" /><p className="mt-3 text-sm font-bold text-slate-500">Ca làm</p><p className="text-2xl font-black">{workShifts.length}</p></div>
          <div className="rounded-[1.7rem] bg-white p-5 shadow-soft dark:bg-slate-900"><BadgePercent className="text-orange-600" /><p className="mt-3 text-sm font-bold text-slate-500">Hoa hồng ghi nhận</p><p className="text-2xl font-black">{formatMoney(totals.totalCommission)}</p></div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <section className="rounded-[2rem] bg-white p-5 shadow-soft dark:bg-slate-900">
            <h2 className="flex items-center gap-2 text-xl font-black"><ShieldCheck /> Phân quyền mẫu</h2>
            <div className="mt-4 space-y-3">
              {roles.map((item) => (
                <div key={item.role} className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800">
                  <p className="font-black">{item.label} <span className="text-xs text-slate-400">({item.role})</span></p>
                  <p className="mt-1 text-sm text-slate-500">{item.permissions.join(' · ')}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] bg-white p-5 shadow-soft dark:bg-slate-900">
            <h2 className="text-xl font-black">Ca làm</h2>
            <div className="mt-4 grid gap-2">
              <input value={shiftForm.name} onChange={(event) => setShiftForm({ ...shiftForm, name: event.target.value })} placeholder="Tên ca: Ca sáng" className="rounded-2xl bg-slate-100 p-3 font-bold outline-none dark:bg-slate-800" />
              <div className="grid grid-cols-2 gap-2">
                <input type="time" value={shiftForm.startTime} onChange={(event) => setShiftForm({ ...shiftForm, startTime: event.target.value })} className="rounded-2xl bg-slate-100 p-3 font-bold outline-none dark:bg-slate-800" />
                <input type="time" value={shiftForm.endTime} onChange={(event) => setShiftForm({ ...shiftForm, endTime: event.target.value })} className="rounded-2xl bg-slate-100 p-3 font-bold outline-none dark:bg-slate-800" />
              </div>
              <select value={shiftForm.branchId} onChange={(event) => setShiftForm({ ...shiftForm, branchId: event.target.value })} className="rounded-2xl bg-slate-100 p-3 font-bold outline-none dark:bg-slate-800">
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
              <button onClick={createShift} className="rounded-2xl bg-slate-950 py-3 font-black text-white dark:bg-white dark:text-slate-950">Tạo ca làm</button>
            </div>
            <div className="mt-4 space-y-2">
              {workShifts.map((shift) => <div key={shift.id} className="rounded-2xl bg-slate-50 p-3 font-bold dark:bg-slate-800">{shift.name} · {shift.startTime} - {shift.endTime}</div>)}
            </div>
          </section>

          <section className="rounded-[2rem] bg-white p-5 shadow-soft dark:bg-slate-900">
            <h2 className="text-xl font-black">Chấm công</h2>
            <div className="mt-4 grid gap-2">
              <select value={checkForm.userId} onChange={(event) => setCheckForm({ ...checkForm, userId: event.target.value })} className="rounded-2xl bg-slate-100 p-3 font-bold outline-none dark:bg-slate-800">
                {staff.map((item) => <option key={item.id} value={item.id}>{item.fullName} · {item.role}</option>)}
              </select>
              <select value={checkForm.workShiftId} onChange={(event) => setCheckForm({ ...checkForm, workShiftId: event.target.value })} className="rounded-2xl bg-slate-100 p-3 font-bold outline-none dark:bg-slate-800">
                {workShifts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <button onClick={checkIn} className="rounded-2xl bg-green-600 py-3 font-black text-white">Chấm vào</button>
            </div>
            <div className="mt-4 max-h-80 space-y-2 overflow-auto">
              {attendance.map((item) => (
                <div key={item.id} className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800">
                  <p className="font-black">{item.user?.fullName || 'Nhân viên'} · {item.workShift?.name || 'Ca chưa chọn'}</p>
                  <p className="text-xs font-bold text-slate-500">Vào: {new Date(item.checkInAt).toLocaleString('vi-VN')} {item.checkOutAt ? `· Ra: ${new Date(item.checkOutAt).toLocaleString('vi-VN')}` : ''}</p>
                  {item.status === 'CHECKED_IN' && <button onClick={() => checkOut(item.id)} className="mt-2 rounded-xl bg-pink-600 px-3 py-2 text-xs font-black text-white">Chấm ra</button>}
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="rounded-[2rem] bg-white p-5 shadow-soft dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-black">Hoa hồng</h2>
            <div className="flex flex-wrap gap-2">
              <input value={ruleForm.name} onChange={(event) => setRuleForm({ ...ruleForm, name: event.target.value })} placeholder="Tên quy tắc" className="rounded-2xl bg-slate-100 px-3 py-2 font-bold outline-none dark:bg-slate-800" />
              <select value={ruleForm.role} onChange={(event) => setRuleForm({ ...ruleForm, role: event.target.value })} className="rounded-2xl bg-slate-100 px-3 py-2 font-bold outline-none dark:bg-slate-800"><option value="WAITER">Phục vụ</option><option value="CASHIER">Thu ngân</option><option value="MANAGER">Quản lý</option></select>
              <input type="number" value={ruleForm.value} onChange={(event) => setRuleForm({ ...ruleForm, value: event.target.value })} className="w-28 rounded-2xl bg-slate-100 px-3 py-2 font-bold outline-none dark:bg-slate-800" />
              <button onClick={createCommissionRule} className="rounded-2xl bg-orange-600 px-4 py-2 font-black text-white">Tạo %</button>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {commissions.map((item) => <div key={item.id} className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800"><p className="font-black">{item.user?.fullName || 'Nhân viên'} · {formatMoney(item.amount)}</p><p className="text-sm text-slate-500">Nền: {formatMoney(item.baseAmount)} · Tỷ lệ: {Number(item.rate)}%</p><p className="mt-1 text-xs text-slate-400">{item.note}</p></div>)}
            {commissions.length === 0 && <p className="text-sm font-bold text-slate-500">Chưa phát sinh hoa hồng. Khi thanh toán bill, hệ thống sẽ tự ghi nhận theo tỷ lệ của tài khoản.</p>}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
