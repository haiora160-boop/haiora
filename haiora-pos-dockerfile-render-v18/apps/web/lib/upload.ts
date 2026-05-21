import { apiFetch, getApiUrl } from './api';

export type UploadFolder = 'avatars' | 'products' | 'general' | 'qrcodes';

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Không đọc được file ảnh'));
    reader.readAsDataURL(file);
  });
}

export async function uploadImage(file: File, token: string, folder: UploadFolder) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Vui lòng chọn file hình ảnh');
  }
  if (file.size > 4 * 1024 * 1024) {
    throw new Error('Ảnh tối đa 4MB');
  }

  const dataUrl = await readFileAsDataUrl(file);
  const result = await apiFetch<{ url?: string; path?: string; size: number }>(`/uploads/image`, {
    method: 'POST',
    token,
    body: JSON.stringify({ folder, fileName: file.name, dataUrl }),
  });
  // Ưu tiên path tương đối từ API rồi ghép với getApiUrl() ở phía trình duyệt.
  // Cách này tránh lỗi URL bị cố định localhost khi mở bằng IP LAN, tablet hoặc deploy Render.
  if (result.path) return `${getApiUrl()}${result.path}`;
  if (result.url) return result.url;
  throw new Error('Upload thành công nhưng API không trả về đường dẫn ảnh');
}
