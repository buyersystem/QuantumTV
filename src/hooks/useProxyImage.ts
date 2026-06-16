import { invoke } from '@tauri-apps/api/core';
import { useEffect, useRef, useState } from 'react';

export interface ImageMetadata {
  title?: string;
  source_name?: string;
  year?: string;
  category?: string;
  rating?: number;
}

// 正在进行的请求，避免重复请求
const pendingRequests = new Map<string, Promise<Uint8Array>>();

export function clearPendingRequests(): void {
  pendingRequests.clear();
}

async function getImageData(
  originalUrl: string,
  metadata?: ImageMetadata,
): Promise<Uint8Array> {
  // 检查是否有正在进行的请求
  const pending = pendingRequests.get(originalUrl);
  if (pending) {
    return pending;
  }

  // 创建新请求（proxy_image 内部会自动处理 SQLite 缓存）
  const request = (async () => {
    try {
      const imageData = await invoke<number[]>('proxy_image', {
        url: originalUrl,
        title: metadata?.title || null,
        sourceName: metadata?.source_name || null,
        year: metadata?.year || null,
        category: metadata?.category || null,
        rating: metadata?.rating || null,
      });
      const data = new Uint8Array(imageData);
      pendingRequests.delete(originalUrl);
      return data;
    } catch (err) {
      console.error('Failed to load image:', err);
      pendingRequests.delete(originalUrl);
      throw err;
    }
  })();

  pendingRequests.set(originalUrl, request);
  return request;
}

const PLACEHOLDER =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3C/svg%3E';

export function useProxyImage(
  originalUrl: string,
  metadata?: ImageMetadata,
): {
  url: string;
  isLoading: boolean;
  error: Error | null;
} {
  const [url, setUrl] = useState(PLACEHOLDER);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [resumeKey, setResumeKey] = useState(0);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const handleResume = () => {
      // 清理失效的请求缓存（防止 AppLifecycleWatcher 阈值未触发的情况）
      clearPendingRequests();
      setResumeKey((k) => k + 1);
    };
    window.addEventListener('app-resumed', handleResume);
    return () => window.removeEventListener('app-resumed', handleResume);
  }, []);

  useEffect(() => {
    if (!originalUrl) {
      setUrl('');
      setIsLoading(false);
      setError(null);
      return;
    }

    // 判断是否需要代理
    // 1. doubanio.com 总是需要代理（防盗链）
    // 2. Tauri 环境中（tauri:// 协议），所有外部图片都需要代理
    // 3. https 页面加载 http 图片需要代理（混合内容）
    const isTauriProtocol =
      typeof window !== 'undefined' &&
      (window.location.protocol === 'tauri:' ||
        window.location.protocol.startsWith('tauri'));

    const needsProxy =
      originalUrl.includes('doubanio.com') ||
      isTauriProtocol ||
      (typeof window !== 'undefined' &&
        window.location.protocol === 'https:' &&
        originalUrl.startsWith('http://'));

    if (!needsProxy) {
      setUrl(originalUrl);
      setIsLoading(false);
      setError(null);
      return;
    }

    // 加载图片数据
    setIsLoading(true);
    setError(null);

    let cancelled = false;

    getImageData(originalUrl, metadata)
      .then((imageData) => {
        if (cancelled) return;

        // Android WebView 某些版本对 Blob URL 支持有问题，使用 data URL
        // 检测是否为移动端浏览器
        const isMobile =
          typeof window !== 'undefined' &&
          /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent,
          );

        if (isMobile && imageData.length < 500_000) {
          // 使用 data URL（移动端小图片）
          try {
            const base64 = btoa(String.fromCharCode(...Array.from(imageData)));
            const dataUrl = `data:image/jpeg;base64,${base64}`;
            setUrl(dataUrl);
            setIsLoading(false);
          } catch (err) {
            console.error('[useProxyImage] Failed to create data URL:', err);
            // Fallback to blob URL
            const blob = new Blob([imageData as any], { type: 'image/jpeg' });
            const blobUrl = URL.createObjectURL(blob);
            blobUrlRef.current = blobUrl;
            setUrl(blobUrl);
            setIsLoading(false);
          }
        } else {
          // 使用 Blob URL（桌面端或大图片）
          const blob = new Blob([imageData as any], { type: 'image/jpeg' });
          const newBlobUrl = URL.createObjectURL(blob);
          blobUrlRef.current = newBlobUrl;
          setUrl(newBlobUrl);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (cancelled) return;

        console.error('[useProxyImage] Failed to load image:', err);
        setError(err);
        setIsLoading(false);
        // Fallback 到原始 URL
        setUrl(originalUrl);
      });

    return () => {
      cancelled = true;

      // 组件卸载时释放当前实例创建的 URL
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [originalUrl, resumeKey]);

  return { url, isLoading, error };
}
