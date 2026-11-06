/* Тема: auto (как в системе) / light / dark. Подключается в <head> до отрисовки, чтобы не было белой вспышки.
   Отдельным файлом, а не внутри index.html, — так требует защита CSP. */
(function () {
  var K = 'ruin.theme', mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  function mode() { try { return localStorage.getItem(K) || 'auto'; } catch (e) { return 'auto'; } }
  function apply() {
    var m = mode(), dark = m === 'dark' || (m === 'auto' && mq && mq.matches), r = document.documentElement;
    r.setAttribute('data-theme', dark ? 'dark' : 'light'); r.setAttribute('data-mode', m);
    var t = document.querySelector('meta[name=theme-color]'); if (t) t.content = dark ? '#0e1012' : '#f3f3f0';
  }
  apply();
  if (mq) { if (mq.addEventListener) mq.addEventListener('change', apply); else if (mq.addListener) mq.addListener(apply); }
  window.ruinTheme = { mode: mode, set: function (m) { try { localStorage.setItem(K, m); } catch (e) {} apply(); } };
})();
