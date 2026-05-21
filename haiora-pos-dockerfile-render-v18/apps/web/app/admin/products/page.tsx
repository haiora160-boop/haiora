'use client';

import { useEffect, useMemo, useState } from 'react';
import { ImagePlus, PackagePlus, Pencil, Save } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { apiFetch } from '@/lib/api';
import { uploadImage } from '@/lib/upload';
import { useAuthStore } from '@/stores/auth-store';

type Category = { id: string; name: string };
type Product = {
  id: string;
  name: string;
  sku?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  price: string | number;
  costPrice?: string | number | null;
  categoryId?: string | null;
  category?: Category | null;
  isActive: boolean;
};

const emptyForm = {
  name: '',
  sku: '',
  description: '',
  imageUrl: '',
  price: '0',
  costPrice: '',
  categoryId: '',
};

export default function ProductsAdminPage() {
  const { token } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const editingProduct = useMemo(() => products.find((item) => item.id === editingId), [products, editingId]);

  async function reload() {
    if (!token) return;
    const [productList, categoryList] = await Promise.all([
      apiFetch<Product[]>('/products', { token }),
      apiFetch<Category[]>('/categories', { token }),
    ]);
    setProducts(productList);
    setCategories(categoryList);
  }

  useEffect(() => {
    reload().catch(console.error);
  }, [token]);

  function startEdit(product: Product) {
    setEditingId(product.id);
    setForm({
      name: product.name,
      sku: product.sku || '',
      description: product.description || '',
      imageUrl: product.imageUrl || '',
      price: String(product.price || 0),
      costPrice: product.costPrice ? String(product.costPrice) : '',
      categoryId: product.category?.id || product.categoryId || '',
    });
  }

  function reset() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleProductImage(file?: File) {
    if (!file || !token) return;
    try {
      setUploading(true);
      const url = await uploadImage(file, token, 'products');
      setForm((current) => ({ ...current, imageUrl: url }));
      setMessage('Đã upload hình ảnh món. Bấm Lưu món để cập nhật.');
    } catch (err: any) {
      setMessage(err.message || 'Không upload được ảnh');
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (!token) return;
    try {
      const body = {
        name: form.name,
        sku: form.sku || undefined,
        description: form.description || undefined,
        imageUrl: form.imageUrl || undefined,
        price: Number(form.price || 0),
        costPrice: form.costPrice ? Number(form.costPrice) : undefined,
        categoryId: form.categoryId || undefined,
      };
      if (editingId) {
        await apiFetch(`/products/${editingId}`, { method: 'PATCH', token, body: JSON.stringify(body) });
        setMessage('Đã cập nhật món, giá và hình ảnh.');
      } else {
        await apiFetch('/products', { method: 'POST', token, body: JSON.stringify(body) });
        setMessage('Đã thêm món mới.');
      }
      reset();
      await reload();
    } catch (err: any) {
      setMessage(err.message || 'Không lưu được món');
    }
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-bold text-pink-600">Admin / Menu</p>
          <h1 className="text-3xl font-black">Cập nhật món, giá và hình ảnh</h1>
        </div>
        <button onClick={reset} className="rounded-2xl bg-slate-950 px-5 py-3 font-black text-white dark:bg-white dark:text-slate-950">+ Thêm món</button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <section className="rounded-[2rem] bg-white p-5 shadow-soft dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-pink-100 text-pink-600 dark:bg-pink-950/50"><PackagePlus /></div>
            <div>
              <h2 className="font-black">{editingProduct ? `Sửa: ${editingProduct.name}` : 'Thêm món mới'}</h2>
              <p className="text-sm text-slate-500">Upload ảnh thật hoặc dán link ảnh món.</p>
            </div>
          </div>

          <div className="space-y-3">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Tên món" className="w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none focus:border-pink-500 dark:border-slate-700 dark:bg-slate-800" />
            <div className="grid grid-cols-2 gap-3">
              <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="Mã SKU" className="rounded-2xl border border-slate-200 bg-white p-3 outline-none focus:border-pink-500 dark:border-slate-700 dark:bg-slate-800" />
              <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="rounded-2xl border border-slate-200 bg-white p-3 outline-none focus:border-pink-500 dark:border-slate-700 dark:bg-slate-800">
                <option value="">Chọn danh mục</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="Giá bán" type="number" className="rounded-2xl border border-slate-200 bg-white p-3 outline-none focus:border-pink-500 dark:border-slate-700 dark:bg-slate-800" />
              <input value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} placeholder="Giá vốn" type="number" className="rounded-2xl border border-slate-200 bg-white p-3 outline-none focus:border-pink-500 dark:border-slate-700 dark:bg-slate-800" />
            </div>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Mô tả món" className="h-24 w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none focus:border-pink-500 dark:border-slate-700 dark:bg-slate-800" />
            <div className="rounded-2xl border border-dashed border-pink-300 bg-pink-50/50 p-3 dark:border-pink-900 dark:bg-pink-950/20">
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 font-black text-pink-600 shadow-sm dark:bg-slate-800">
                <ImagePlus size={18} /> {uploading ? 'Đang upload...' : 'Upload hình món'}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleProductImage(e.target.files?.[0])} />
              </label>
              <div className="mt-3 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
                <ImagePlus size={18} className="text-slate-400" />
                <input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="Hoặc dán link hình ảnh món" className="w-full bg-transparent outline-none" />
              </div>
            </div>
            {form.imageUrl && (
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                <img
                  key={form.imageUrl}
                  src={form.imageUrl}
                  alt="preview"
                  className="h-48 w-full object-cover"
                  onError={() => setMessage('Ảnh đã upload nhưng trình duyệt chưa tải được preview. Hãy kiểm tra API /uploads hoặc chạy lại bản upload-fixed.')}
                />
              </div>
            )}
            <button onClick={submit} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-pink-500 to-indigo-600 py-4 font-black text-white"><Save size={18} /> Lưu món</button>
            {message && <p className="rounded-2xl bg-blue-50 p-3 text-sm font-bold text-blue-700 dark:bg-blue-950/30">{message}</p>}
          </div>
        </section>

        <section className="rounded-[2rem] bg-white p-5 shadow-soft dark:bg-slate-900">
          <h2 className="mb-4 text-xl font-black">Danh sách món</h2>
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {products.map((product) => (
              <div key={product.id} className="overflow-hidden rounded-[1.7rem] border border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60">
                {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-40 w-full object-cover" /> : <div className="grid h-40 place-items-center text-4xl">🍽️</div>}
                <div className="p-4">
                  <p className="font-black">{product.name}</p>
                  <p className="text-sm text-slate-500">{product.category?.name || 'Chưa phân loại'}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-lg font-black text-pink-600">{Number(product.price).toLocaleString('vi-VN')}đ</p>
                    <button onClick={() => startEdit(product)} className="flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-sm font-black shadow-sm dark:bg-slate-700"><Pencil size={15} /> Sửa</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
