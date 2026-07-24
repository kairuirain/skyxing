<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SkyXing - 博客平台</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <meta name="description" content="SkyXing - 自由创作，分享你的想法" />
  <script type="module" crossorigin src="/assets/index-DLdfuD6i.js"></script>
  <link rel="stylesheet" crossorigin href="/assets/index-C22Qi32c.css">
</head>
<body class="bg-gray-50 text-gray-900">
  <div id="root"></div>
  <script>
    // 在首屏渲染前根据主题偏好应用深色，避免闪烁。
    // 仅在用户“显式”设置过（存在 theme_set 标记）时才信任 theme 值，
    // 否则跟随系统偏好，避免旧版本自动写入的 light 锁死深色。
    (function () {
      try {
        function gc(n){ var m=document.cookie.match(new RegExp('(?:^|; )'+n+'=([^;]*)')); return m?m[1]:null; }
        function gls(n){ try { return localStorage.getItem(n); } catch(e){ return null; } }
        var cookieTheme = gc('theme'); var lsTheme = gls('theme');
        var mark = gc('theme_set') || gls('theme_set');
        var stored = cookieTheme || lsTheme;
        var t;
        if (stored === 'dark') t = 'dark';
        else if (stored === 'light' && mark) t = 'light';
        else t = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        if (t === 'dark') document.documentElement.classList.add('dark');
      } catch (e) {}
    })();
  </script>
<script defer src="https://static.cloudflareinsights.com/beacon.min.js/v4513226cdae34746b4dedf0b4dfa099e1781791509496" integrity="sha512-ZE9pZaUXND66v380QUtch/5sE9tPFh2zg45pR2PB0CVkCtOREv2AJKkSidISWkysEuQ0EH8faUU5du78bx87UQ==" data-cf-beacon='{"version":"2024.11.0","token":"91dbb93aafe44102809d169957007731","r":1,"server_timing":{"name":{"cfCacheStatus":true,"cfEdge":true,"cfExtPri":true,"cfL4":true,"cfOrigin":true,"cfSpeedBrain":true},"location_startswith":null}}' crossorigin="anonymous"></script>
</body>
</html>
