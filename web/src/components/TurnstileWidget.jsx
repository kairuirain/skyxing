import { useEffect, useRef } from 'react';

/**
 * Cloudflare Turnstile 人机验证组件（需求 7）
 * 自动加载 Turnstile 脚本并以显式模式渲染，验证通过后回调 token。
 * siteKey 为空时不渲染（后端未配置密钥时）。
 */
export default function TurnstileWidget({ siteKey, onVerify, onError }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  // 用 ref 持有最新回调，避免父组件传入内联函数导致 effect 随每次渲染重跑、
  // 反复卸载/重建 widget（会触发 Turnstile 无限重新验证）。
  const onVerifyRef = useRef(onVerify);
  const onErrorRef = useRef(onError);
  onVerifyRef.current = onVerify;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!siteKey || !containerRef.current) return undefined;

    const render = () => {
      if (!window.turnstile || widgetIdRef.current != null) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token) => onVerifyRef.current && onVerifyRef.current(token || null),
        'expired-callback': () => onVerifyRef.current && onVerifyRef.current(null),
        'error-callback': () => onErrorRef.current && onErrorRef.current(),
      });
    };

    if (window.turnstile) {
      render();
    } else {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onload = render;
      document.body.appendChild(script);
    }

    return () => {
      if (widgetIdRef.current != null && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey]);

  if (!siteKey) return null;
  return <div ref={containerRef} className="cf-turnstile" />;
}
