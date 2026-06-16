import { useMemo } from 'react';

export interface ImageMetadata {
  title?: string;
  source_name?: string;
  year?: string;
  category?: string;
  rating?: number;
}

// 兼容旧导入：图片已改为通过自定义协议 imgcache:// 由 WebView 直接加载，
// 不再有 JS 层的请求缓存需要清理。保留空实现以避免破坏现有调用方。
export function clearPendingRequests(): void {
  // no-op
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

// 判断是否需要走代理（与历史行为保持一致）：
// 1. doubanio.com 有防盗链，始终代理
// 2. tauri:// 协议（macOS/Linux 桌面端）下外部图片需代理
// 3. https 页面加载 http 图片（混合内容）需代理
function needsProxy(originalUrl: string): boolean {
  if (originalUrl.includes('doubanio.com')) return true;
  if (typeof window === 'undefined') return false;

  const protocol = window.location.protocol;
  const isTauriProtocol =
    protocol === 'tauri:' || protocol.startsWith('tauri');
  if (isTauriProtocol) return true;
  if (protocol === 'https:' && originalUrl.startsWith('http://')) return true;

  return false;
}

// 构造自定义协议 URL。
// Tauri 2.x 自定义协议在不同平台的默认格式：
// - Android/Windows: https://<scheme>.localhost（启用 useHttpsScheme 后）
// - macOS/Linux/iOS: <scheme>://localhost
//
// 检测方式：看页面本身的 protocol，Android 是 https://tauri.localhost（启用后）
function buildProxyUrl(originalUrl: string, metadata?: ImageMetadata): string {
  const params = new URLSearchParams();
  params.set('url', originalUrl);
  if (metadata?.title) params.set('title', metadata.title);
  if (metadata?.source_name) params.set('source_name', metadata.source_name);
  if (metadata?.year) params.set('year', metadata.year);
  if (metadata?.category) params.set('category', metadata.category);
  if (metadata?.rating != null) params.set('rating', String(metadata.rating));

  if (typeof window !== 'undefined') {
    const pageProtocol = window.location.protocol;
    // Android/Windows 启用 useHttpsScheme 后页面是 https://tauri.localhost
    if (pageProtocol === 'https:') {
      return `https://imgcache.localhost/?${params.toString()}`;
    } else if (pageProtocol === 'http:') {
      // 旧版或未启用 https 的 Android/Windows
      return `http://imgcache.localhost/?${params.toString()}`;
    } else {
      // macOS/Linux/iOS: tauri://localhost 页面，自定义协议用 imgcache://
      return `imgcache://localhost/?${params.toString()}`;
    }
  }

  // SSR fallback
  return `https://imgcache.localhost/?${params.toString()}`;
}

/**
 * 返回可直接用于 <img src> 的图片地址。
 *
 * 需要代理的图片走自定义协议 imgcache://，由 WebView 原生加载并按需重取
 * （恢复后台、blob 失效等场景均由 WebView 自行处理，前端无需重载）。
 * URL 是 originalUrl 的纯函数，因此同步计算、无 loading 态、无 IPC。
 */
export function useProxyImage(
  originalUrl: string,
  metadata?: ImageMetadata,
): {
  url: string;
  isLoading: boolean;
  error: Error | null;
} {
  const url = useMemo(() => {
    if (!originalUrl) return '';
    const tauri = isTauriRuntime();
    const proxy = needsProxy(originalUrl);

    // 调试日志：release 构建也会输出到 logcat
    console.log('[useProxyImage]', {
      url: originalUrl.substring(0, 60),
      tauri,
      proxy,
      protocol: typeof window !== 'undefined' ? window.location.protocol : 'ssr',
    });

    // 纯浏览器环境没有自定义协议，直接使用原图（与旧实现的兜底一致）
    if (!tauri) return originalUrl;
    if (!proxy) return originalUrl;

    const proxyUrl = buildProxyUrl(originalUrl, metadata);
    console.log('[useProxyImage] built:', proxyUrl.substring(0, 80));
    return proxyUrl;
    // metadata 在每次渲染都会重建对象，仅以 originalUrl 作为依赖（与旧实现一致）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalUrl]);

  return { url, isLoading: false, error: null };
}
