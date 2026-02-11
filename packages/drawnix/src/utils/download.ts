export type DownloadRequest = {
  url: string;
  filename?: string;
};

const extensionFromContentType = (contentType: string | null) => {
  const type = (contentType || '').split(';')[0].trim().toLowerCase();
  if (type === 'image/png') return 'png';
  if (type === 'image/jpeg') return 'jpg';
  if (type === 'image/webp') return 'webp';
  if (type === 'image/gif') return 'gif';
  if (type === 'video/mp4') return 'mp4';
  if (type === 'video/webm') return 'webm';
  return '';
};

const inferNameFromUrl = (url: string) => {
  try {
    const parsed = new URL(url, window.location.origin);
    const pathname = parsed.pathname;
    const last = pathname.split('/').filter(Boolean).pop() || '';
    if (!last) return '';
    if (last.includes('.')) return last;
    return '';
  } catch {
    return '';
  }
};

export const downloadUrl = async ({ url, filename }: DownloadRequest) => {
  if (!url) return;

  if (url.startsWith('data:')) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'download';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`下载失败: ${response.status} ${response.statusText}`);
  }

  const blob = await response.blob();
  const ext = extensionFromContentType(response.headers.get('content-type'));
  const inferred = inferNameFromUrl(url);
  const base = filename || inferred || 'download';
  const finalName = ext && !base.toLowerCase().endsWith(`.${ext}`) ? `${base}.${ext}` : base;

  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = finalName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

export const getProxyUrl = (type: 'image' | 'video', originalUrl: string) => {
  if (!originalUrl) return '';
  if (originalUrl.startsWith('data:')) return originalUrl;

  const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const base =
    type === 'image'
      ? isLocalDev
        ? 'http://localhost:3000/image-proxy'
        : '/image-proxy'
      : isLocalDev
        ? 'http://localhost:3000/video-proxy'
        : '/video-proxy';

  if (type === 'image' && (originalUrl.includes('/image-proxy?url=') || originalUrl.includes('http://localhost:3000/image-proxy?url='))) {
    return originalUrl;
  }
  if (type === 'video' && (originalUrl.includes('/video-proxy?url=') || originalUrl.includes('http://localhost:3000/video-proxy?url='))) {
    return originalUrl;
  }

  if (originalUrl.startsWith('http://') || originalUrl.startsWith('https://')) {
    return `${base}?url=${encodeURIComponent(originalUrl)}`;
  }
  return originalUrl;
};

