'use client';

import { useEffect, useRef } from 'react';

import { resetPreloadState } from '@/lib/imagePreloader';
import { clearPendingRequests } from '@/hooks/useProxyImage';

// 只有在隐藏超过该阈值后再次可见,才视为真正的"恢复",避免桌面端
// 短暂最小化/被其他窗口遮挡时触发 app-resumed,导致全站图片重新加载并卡住。
// 移动端降低阈值以确保快速切换时也能清理缓存
const RESUME_THRESHOLD_MS = 5_000; // 5秒，移动端更敏感

export function AppLifecycleWatcher() {
  const hiddenAtRef = useRef<number | null>(null);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now();
        return;
      }

      if (document.visibilityState !== 'visible') return;

      const hiddenAt = hiddenAtRef.current;
      hiddenAtRef.current = null;

      // App 恢复时，无论隐藏时长，都清理失效的请求缓存
      // （WebView 后台时 fetch/IPC 可能被挂起，恢复后需要重新发起）
      clearPendingRequests();

      // 仅在长时间隐藏后才清理预加载队列（避免桌面端短暂切换时全站重载）
      const shouldResetPreload = hiddenAt !== null && Date.now() - hiddenAt >= RESUME_THRESHOLD_MS;
      if (shouldResetPreload) {
        resetPreloadState();
      }

      // 总是发送事件，让各组件决定如何响应
      window.dispatchEvent(new CustomEvent('app-resumed'));
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return null;
}
