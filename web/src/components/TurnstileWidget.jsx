import { useEffect, useRef } from 'react';

/**
 * Cloudflare Turnstile 人机验证组件（需求 7）
 * 自动加载 Turnstile 脚本并以显式模式渲染，验证通过后回调 token。
 * siteKey 为空时不渲染（后端未配置密钥时）。
 */
export default function TurnstileWidget({ siteKey, onVerify, onError }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return undefined;

    const render = () => {
      if (!window.turnstile || widgetIdRef.current != null) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token) => onVerify && onVerify(token || null),
        'expired-callback': () => onVerify && onVerify(null),
        'error-callback': () => onError && onError(),
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
  }, [siteKey, onVerify, onError]);

  if (!siteKey) return null;
  return <div ref={containerRef} className="cf-turnstile" />;
}
