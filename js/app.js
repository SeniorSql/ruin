// Точка входа: шапка, меню, маршрутизация по #/адресам
import { sb, configured, state, loadMe, setOrg, refreshCounters, loadCategories, isAdmin, canManage } from './api.js';
import { esc, status, initials, toast } from './ui.js';
import { initDrafts } from './drafts.js';
import { maybeShowOnboarding, showOnboarding } from './onboarding.js';
const ICON = {
  home: '<path d="m3 10 9-7 9 7v10H3zM9 20v-6h6v6"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  list: '<path d="M5 3h14v18H5zM8 8h8M8 12h8M8 16h5"/>',
  deal: '<path d="M4 7h15l-3-3M20 17H5l3 3"/>',
  truck: '<path d="M3 16h18M5 16l2-7h8l4 7M7 19a2 2 0 1 0 0-.1M17 19a2 2 0 1 0 0-.1M8 9l2-4h5l2 4"/>',
  feed: '<path d="M4 6h16M4 12h16M4 18h10"/><circle cx="19" cy="18" r="2"/>',
  send: '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>',
  chat: '<path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l1.7-3A7.5 7.5 0 1 1 20 11.5Z"/>',
  bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>',
  org: '<path d="M4 21V5l8-3 8 3v16M2 21h20M8 9h2m4 0h2m-8 4h2m4 0h2m-5 8v-4h3v4"/>',
  heart: '<path d="M20.8 8.8c0 5.1-8.8 11-8.8 11s-8.8-5.9-8.8-11A4.7 4.7 0 0 1 12 6.4a4.7 4.7 0 0 1 8.8 2.4Z"/>',
  shield: '<path d="m12 3 8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/><path d="m8 12 2.5 2.5L16 9"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  desk: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16M5 8h2M11 8h2M17 8h2M11 12h2"/>',
  gauge: '<path d="M3.5 17a9 9 0 1 1 17 0"/><path d="m12 13 4-5"/><circle cx="12" cy="13" r="1.4"/><path d="M6 21h12"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>',
  auto: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17Z" fill="currentColor"/>'
};
export const icon = (name, size = 18) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;

const LOGO = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 3h20c9 0 15 5 15 13 0 6-3 10-9 12l9 15H30l-8-14h-4v14H8V3Zm10 9v9h9c4 0 6-1 6-5s-2-4-6-4h-9Z" fill="currentColor"/><path d="M8 3h10v9H8z" style="fill:var(--accent)"/><path d="M8 39h10v4H8z" style="fill:var(--accent)"/></svg>';

// ---------- тема: как в системе / светлая / тёмная (сама тема ставится скриптом в index.html) ----------
const THEMES = { auto: ['auto', 'Авто', 'как в системе'], light: ['sun', 'Светлая', 'светлая'], dark: ['moon', 'Тёмная', 'тёмная'] };
const themeMode = () => (window.ruinTheme ? window.ruinTheme.mode() : 'auto');
function setTheme(m) {
  document.body.classList.add('theme-anim');
  window.ruinTheme?.set(m);
  setTimeout(() => document.body.classList.remove('theme-anim'), 350);
  refreshShell();
}
const themeBtn = () => {
  const [ic, , text] = THEMES[themeMode()] || THEMES.auto;
  return `<button class="icon-btn" id="themeBtn" type="button" title="Тема: ${text}. Нажмите, чтобы сменить" aria-label="Тема: ${text}">${icon(ic)}</button>`;
};
const themeSeg = () => `<div class="nav-caption">ТЕМА</div><div class="theme-seg" role="group" aria-label="Тема оформления">${Object.entries(THEMES).map(([k, [ic, label]]) =>
  `<button type="button" data-theme-set="${k}" class="${themeMode() === k ? 'on' : ''}" aria-pressed="${themeMode() === k}">${icon(ic, 14)}${label}</button>`).join('')}</div>`;

// Маршруты: шаблон → модуль страницы
const ROUTES = [
  ['', 'home'], ['catalog', 'catalog'], ['item/:id', 'item'],
  ['login', 'auth'], ['register', 'auth'], ['forgot', 'auth'], ['reset', 'auth'],
  ['account', 'account'],
  ['fleet', 'fleet'], ['fleet/new', 'fleet'], ['fleet/:id', 'fleet'],
  ['orders', 'orders'], ['orders/new', 'orders'], ['orders/:id', 'orders'],
  ['feed', 'feed'], ['feed/:id', 'feed'], ['offers', 'feed'],
  ['deals', 'deals'], ['deals/:id', 'deals'], ['deals/:id/doc/:type', 'docs'],
  ['company/:id', 'company'], ['team', 'team'], ['crm', 'crm'], ['park', 'park'], ['analytics', 'analytics'], ['reviews', 'reviews'],
  ['messages', 'messages'], ['messages/:id', 'messages'],
  ['notifications', 'notifications'], ['favorites', 'favorites'],
  ['admin', 'admin'], ['terms', 'static'], ['privacy', 'static'], ['help', 'static']
];

function match(path) {
  const parts = path.split('/').filter(Boolean);
  for (const [pattern, mod] of ROUTES) {
    const pp = pattern.split('/').filter(Boolean);
    if (pp.length !== parts.length) continue;
    const params = {};
    if (pp.every((p, i) => p.startsWith(':') ? (params[p.slice(1)] = decodeURIComponent(parts[i]), true) : p === parts[i])) {
      return { mod, params, name: pp[0] || 'home', pattern };
    }
  }
  return null;
}

export function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = h.split('?');
  return { path, query: Object.fromEntries(new URLSearchParams(query)) };
}
export const go = (hash) => { location.hash = hash; };

// ---------- шапка ----------
function renderTop() {
  const c = state.counters || {};
  const u = state.user;
  document.getElementById('top').innerHTML = `
    <a class="brand" href="#/" aria-label="RUIN — главная">${LOGO}<div><div class="brand-name">RUIN<span>.</span></div><div class="brand-tag">ТЕХНИКА ДЛЯ БОЛЬШИХ ПЛАНОВ</div></div></a>
    <form class="search" id="topSearch" role="search">${icon('search')}
      <input name="q" placeholder="Найти технику: экскаватор, автокран, самосвал…" aria-label="Поиск техники">
      <button class="btn sm dark">Найти</button></form>
    <div class="top-actions">
      ${themeBtn()}
      ${u ? `
        <a class="icon-btn" href="#/favorites" title="Избранное">${icon('heart')}</a>
        <a class="icon-btn" href="#/messages" title="Сообщения">${icon('chat')}${c.unread_messages ? `<span class="badge-count">${c.unread_messages}</span>` : ''}</a>
        <a class="icon-btn" href="#/notifications" title="Уведомления">${icon('bell')}${c.notifications ? `<span class="badge-count">${c.notifications}</span>` : ''}</a>
        <a class="me" href="#/account"><span class="avatar">${esc(initials(state.profile?.full_name || u.email))}</span>
          <div><b>${esc(state.profile?.full_name || u.email)}</b><small>Мой кабинет</small></div></a>`
      : `<a class="btn ghost sm" href="#/login">Войти</a><a class="btn sm" href="#/register">Регистрация</a>`}
    </div>`;
  document.getElementById('topSearch').onsubmit = (e) => {
    e.preventDefault();
    go('#/catalog?q=' + encodeURIComponent(e.target.q.value.trim()));
  };
  document.getElementById('themeBtn').onclick = () => {
    const order = ['auto', 'light', 'dark'];
    const next = order[(order.indexOf(themeMode()) + 1) % order.length];
    setTheme(next);
    toast('Тема: ' + THEMES[next][2]);
  };
}

// ---------- боковое меню ----------
function renderSide(active) {
  const c = state.counters || {};
  const o = state.org;
  // cnt — нужно ваше действие (жёлтый), wait — ждёт другую сторону (серый)
  const link = (href, ic, text, cnt, wait) =>
    `<a href="${href}" class="${active === href ? 'active' : ''}">${icon(ic)}<span>${text}</span>${cnt ? `<span class="cnt" title="Нужно ваше действие">${cnt}</span>` : ''}${wait ? `<span class="cnt wait" title="Ждёт другую сторону">${wait}</span>` : ''}</a>`;
  const others = c.other_orgs || {};
  const orgName = (x) => (x.type === 'PERSON' ? 'Я (частное лицо)' : x.name);
  let html = '';
  if (state.user && o) {
    html += `<div class="context"><small>ДЕЙСТВУЮ ОТ ИМЕНИ</small>
      <select id="ctxSel" aria-label="Рабочий контекст">${state.orgs.map((x) =>
        `<option value="${x.id}" ${x.id === o.id ? 'selected' : ''}>${esc(orgName(x))}${others[x.id] ? ` — ждёт действий: ${others[x.id]}` : ''}</option>`).join('')}</select>
      ${o.type !== 'PERSON' ? `<div class="ctx-status">${status('org', o.verification_status)}</div>` : ''}
      ${o.type !== 'PERSON' ? `<div class="ctx-role">Ваша роль: <b>${{ OWNER: 'владелец', ADMIN: 'администратор', MANAGER: 'менеджер', APPROVER: 'согласующий', FINANCE: 'бухгалтер', VIEWER: 'наблюдатель' }[o.role] || o.role}</b>${canManage(o) ? '' : ' · только просмотр'}</div>` : ''}</div>`;
    // Действия, которые ждут вас в других ваших организациях
    html += state.orgs.filter((x) => others[x.id]).map((x) =>
      `<button class="ctx-alert" data-switch="${x.id}"><b>${esc(orgName(x))}</b>: ${others[x.id]} ${others[x.id] === 1 ? 'сделка ждёт' : 'сделки ждут'} вашего действия <span>Перейти →</span></button>`).join('');
  }
  html += `<div class="navs"><div class="nav-caption">МАРКЕТПЛЕЙС</div><nav class="nav">
    ${link('#/', 'home', 'Главная')}${link('#/catalog', 'grid', 'Каталог техники')}
    ${state.user && (!o || canManage(o)) ? link('#/orders/new', 'plus', 'Разместить заказ') : ''}</nav>`;
  if (state.user && o) {
    if (o.can_order) {
      html += `<div class="nav-group customer"><div class="nav-role">${icon('list', 16)}<span>Я заказчик</span><small>арендую технику</small></div><nav class="nav">
        ${link('#/orders', 'list', 'Мои заказы', c.orders_offers)}${link('#/deals?tab=customer', 'deal', 'Сделки', c.deals_customer, c.deals_customer_wait)}</nav></div>`;
    }
    if (o.can_provide) {
      html += `<div class="nav-group provider"><div class="nav-role">${icon('truck', 16)}<span>Я исполнитель</span><small>сдаю технику</small></div><nav class="nav">
        ${link('#/crm', 'desk', 'Рабочий стол', c.crm_due)}${link('#/fleet', 'truck', 'Моя техника')}${link('#/park', 'gauge', 'Учёт парка')}${link('#/feed', 'feed', 'Лента заказов', c.feed_new)}
        ${link('#/offers', 'send', 'Мои предложения')}${link('#/deals?tab=provider', 'deal', 'Сделки', c.deals_provider, c.deals_provider_wait)}</nav></div>`;
    }
    html += `<div class="nav-caption">АККАУНТ</div><nav class="nav">
      ${link('#/messages', 'chat', 'Сообщения', c.unread_messages)}${link('#/notifications', 'bell', 'Уведомления', c.notifications)}
      ${link('#/reviews', 'heart', 'Отзывы')}${link('#/analytics', 'grid', 'Аналитика')}${o.type !== 'PERSON' ? link('#/team', 'org', 'Сотрудники') : ''}
      ${link('#/account', 'org', 'Профиль и организации')}${isAdmin() ? link('#/admin', 'shield', 'Админка', c.admin?.total) : ''}
      <a href="#" data-onb>${icon('send')}<span>Как пользоваться</span></a></nav>`;
  }
  html += `</div>`;
  html += themeSeg();
  if (state.user && o && !o.can_provide) {
    html += `<div class="side-note"><b>Есть своя техника?</b>Создайте организацию исполнителя и получайте заказы. <a href="#/account">Начать →</a></div>`;
  } else if (!state.user) {
    html += `<div class="side-note"><b>Техника рядом — проще, чем кажется</b>Сравнивайте предложения проверенных исполнителей и бронируйте онлайн.</div>`;
  }
  const side = document.getElementById('sidebar');
  side.innerHTML = html;
  side.querySelectorAll('[data-theme-set]').forEach((b) => b.onclick = () => setTheme(b.dataset.themeSet));
  const sel = side.querySelector('#ctxSel');
  if (sel) sel.onchange = async () => {
    setOrg(sel.value);
    await refreshCounters();
    toast('Теперь вы действуете от имени: ' + sel.options[sel.selectedIndex].text.split(' — ')[0]);
    route();
  };
  side.querySelectorAll('[data-switch]').forEach((b) => b.onclick = async () => {
    setOrg(b.dataset.switch);
    await refreshCounters();
    const x = state.counters;
    toast('Теперь вы действуете от имени: ' + orgName(state.org));
    go(x.deals_provider ? '#/deals?tab=provider' : '#/deals?tab=customer');
    if (location.hash.startsWith('#/deals')) route();
  });
}

export function refreshShell() {
  const { path, query } = parseHash();
  const m = match(path);
  const top = path.split('/')[0];
  // Для сделок подсвечиваем кнопку в блоке нужной роли (заказчик или исполнитель)
  let saved = null;
  try { saved = sessionStorage.getItem('ruin.dealTab'); } catch {}
  const dealTab = query.tab || saved || (state.org?.can_order ? 'customer' : 'provider');
  const activeMap = { '': '#/', catalog: '#/catalog', item: '#/catalog', orders: path === 'orders/new' ? '#/orders/new' : '#/orders',
    deals: '#/deals?tab=' + dealTab, fleet: '#/fleet', feed: '#/feed', offers: '#/offers', messages: '#/messages',
    notifications: '#/notifications', account: '#/account', admin: '#/admin', team: '#/team', analytics: '#/analytics', company: '#/catalog', reviews: '#/reviews', crm: '#/crm', park: '#/park' };
  renderTop();
  renderSide(activeMap[top] ?? (m ? '#/' + m.name : ''));
}

// ---------- маршрутизация ----------
let cleanup = null;
const PUBLIC = new Set(['home', 'catalog', 'item', 'auth', 'static', 'company']);

const FOOTER = `<footer class="foot"><span>© RUIN, ${new Date().getFullYear()}</span><a href="#" data-onb>Как пользоваться</a><a href="#/help">Помощь</a>
  <a href="#/terms">Пользовательское соглашение</a><a href="#/privacy">Персональные данные</a>
  <span>Фото техники — Wikimedia Commons, свободные лицензии, авторы указаны на фото</span></footer>`;

export async function route() {
  // Ссылки из писем Supabase приходят с токеном в адресе — ждём, пока библиотека его обработает
  if (/error_description=/.test(location.hash)) {
    // Ссылка из письма не сработала (устарела, уже использована или её «открыл» почтовый антивирус)
    const p = new URLSearchParams(location.hash.slice(1));
    const d = p.get('error_description') || '';
    const expired = p.get('error_code') === 'otp_expired' || /expired|invalid/i.test(d);
    history.replaceState(null, '', location.pathname + location.search);
    document.getElementById('app').innerHTML = `<div class="panel"><h2>Ссылка из письма не сработала</h2>
      <p>${expired ? 'Ссылка устарела или уже была использована. Так бывает, если письмо открыли повторно или почтовый сервис сам проверил ссылку.' : 'Ошибка: ' + esc(d)}</p>
      <p class="muted">Запросите новое письмо и откройте ссылку из него сразу, один раз.</p>
      <div class="actions"><a class="btn" href="#/forgot">Отправить письмо для смены пароля</a><a class="btn ghost" href="#/login">Войти</a></div></div>`;
    return;
  }
  if (/access_token=/.test(location.hash)) {
    document.getElementById('app').innerHTML = '<div class="panel">Входим…</div>';
    // Библиотека сама заберёт ключ из адреса; если это смена пароля — откроется #/reset, иначе идём на главную
    setTimeout(() => {
      if (location.hash.startsWith('#/reset')) return;
      if (location.hash === '#/') route(); else go('#/');
    }, 2500);
    return;
  }
  const { path, query } = parseHash();
  const m = match(path);
  const app = document.getElementById('app');
  if (typeof cleanup === 'function') { try { cleanup(); } catch {} }
  cleanup = null;
  refreshShell();
  if (!configured) {
    app.innerHTML = `<div class="panel"><h2>Сайт ещё не подключён к базе данных</h2>
      <p>Откройте файл <b>config.js</b> и вставьте адрес проекта Supabase и ключ anon. Инструкция — в файле <b>README.md</b>.</p></div>`;
    return;
  }
  if (!m) {
    app.innerHTML = `<div class="panel empty"><b>Страница не найдена</b>Возможно, ссылка устарела.<div><a class="btn" href="#/">На главную</a></div></div>`;
    return;
  }
  if (!PUBLIC.has(m.mod) && !state.user) {
    go('#/login?next=' + encodeURIComponent(location.hash));
    return;
  }
  app.innerHTML = '<div class="skeleton" style="height:320px"></div>';
  document.title = 'RUIN — аренда спецтехники';
  try {
    const page = await import(`./pages/${m.mod}.js`);
    cleanup = await page.render(app, m.params, query, m.pattern);
    if (!app.querySelector('.foot')) app.insertAdjacentHTML('beforeend', FOOTER);
  } catch (err) {
    console.error(err);
    app.innerHTML = `<div class="panel empty"><b>Что-то пошло не так</b>${esc(err.message)}<div><button class="btn ghost" onclick="location.reload()">Обновить</button></div></div>`;
  }
  window.scrollTo(0, 0);
}

// ---------- запуск ----------
async function boot() {
  if (configured) {
    try {
      await Promise.all([loadMe(), loadCategories()]);
      await refreshCounters();
    } catch (err) { console.error(err); toast('Нет связи с сервером', true); }
    // Внутри этого обработчика нельзя ждать другие запросы к Supabase: библиотека держит блокировку сессии,
    // и запросы зависают (формы перестают работать после продления токена). Поэтому работа выносится в setTimeout.
    sb.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') { setTimeout(() => go('#/reset'), 0); return; }
      const changed = (session?.user?.id || null) !== (state.user?.id || null);
      if (event === 'SIGNED_OUT' || event === 'USER_UPDATED' || (event === 'SIGNED_IN' && changed)) {
        setTimeout(async () => {
          await loadMe(); await refreshCounters();
          if (changed) { refreshShell(); maybeShowOnboarding(); }
        }, 0);
      }
    });
    // После долгого простоя вкладки проверяем сессию заранее, чтобы первый запрос формы не упал
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && state.user) sb.auth.getSession().catch(() => {});
    });
    // Счётчики уведомлений и сообщений обновляются раз в 30 секунд
    setInterval(async () => {
      if (!state.user || document.hidden) return;
      const before = JSON.stringify(state.counters);
      await refreshCounters();
      if (JSON.stringify(state.counters) !== before) refreshShell();
    }, 30000);
  }
  window.addEventListener('hashchange', route);
  // Прокрутка тачпадом/колёсиком над числовым полем не должна менять число — уводим фокус, страница прокручивается
  document.addEventListener('wheel', (e) => {
    const el = e.target;
    if (el instanceof HTMLInputElement && el.type === 'number' && document.activeElement === el) el.blur();
  }, { passive: true });
  // Целочисленные поля (суммы в рублях, год, километры): точку, запятую, минус и «e» набрать нельзя.
  // Поля с дробным шагом (часы, моточасы) не трогаем.
  const intField = (el) => el instanceof HTMLInputElement && el.type === 'number' && (!el.step || el.step === '1');
  document.addEventListener('keydown', (e) => {
    if (intField(e.target) && ['.', ',', 'e', 'E', '-', '+'].includes(e.key)) e.preventDefault();
  });
  document.addEventListener('paste', (e) => {
    if (!intField(e.target)) return;
    e.preventDefault();
    const digits = (e.clipboardData?.getData('text') || '').split(/[.,]/)[0].replace(/\D/g, '');
    e.target.value = digits;
    e.target.dispatchEvent(new Event('input', { bubbles: true }));
  });
  document.addEventListener('focusin', (e) => { if (intField(e.target)) e.target.setAttribute('inputmode', 'numeric'); });
  // Пары дат «начало — окончание» в любой форме: окончание нельзя выбрать раньше начала
  const PAIR = { start: 'end', from: 'to', s: 'e' };
  const isDate = (el) => el instanceof HTMLInputElement && el.type === 'date' && el.form;
  const endOf = (el) => (PAIR[el.name] ? el.form.elements[PAIR[el.name]] : null);
  const startOf = (el) => { const k = Object.keys(PAIR).find((x) => PAIR[x] === el.name); return k ? el.form.elements[k] : null; };
  const limitEnd = (s, e) => {
    if (!isDate(s) || !isDate(e)) return false;
    if (e.dataset.baseMin === undefined) e.dataset.baseMin = e.min || '';
    const base = e.dataset.baseMin;
    e.min = s.value && s.value > base ? s.value : base;
    if (s.value && e.value && e.value < s.value) { e.value = s.value; return true; }
    return false;
  };
  document.addEventListener('change', (ev) => {
    const t = ev.target;
    if (!isDate(t)) return;
    const e = endOf(t);
    if (e && limitEnd(t, e)) {
      toast('Окончание не может быть раньше начала — поставили дату начала');
      e.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    const s = startOf(t);
    if (s && isDate(s) && s.value && t.value && t.value < s.value) {
      t.value = s.value;
      toast('Окончание не может быть раньше начала — поставили дату начала');
    }
  }, true);
  document.addEventListener('focusin', (ev) => { const t = ev.target; if (isDate(t)) { const s = startOf(t); if (s) limitEnd(s, t); } });
  initDrafts();
  // «Глазик» у всех полей пароля: показать / скрыть введённое
  const EYE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A10.9 10.9 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a10 10 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  const addEyes = (root) => root.querySelectorAll?.('input[type=password]:not([data-eye])').forEach((inp) => {
    inp.dataset.eye = '1';
    const wrap = document.createElement('span');
    wrap.className = 'pw-wrap';
    inp.parentNode.insertBefore(wrap, inp);
    wrap.appendChild(inp);
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'pw-eye'; b.innerHTML = EYE;
    b.setAttribute('aria-label', 'Показать пароль'); b.title = 'Показать пароль';
    b.onclick = () => {
      const show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      b.innerHTML = show ? EYE_OFF : EYE;
      const t = show ? 'Скрыть пароль' : 'Показать пароль';
      b.setAttribute('aria-label', t); b.title = t;
      inp.focus();
    };
    wrap.appendChild(b);
  });
  addEyes(document);
  new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => n.nodeType === 1 && addEyes(n)))).observe(document.body, { childList: true, subtree: true });
  // «Как пользоваться» — открыть знакомство с сайтом заново
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-onb]');
    if (!a) return;
    e.preventDefault();
    showOnboarding();
  });
  await route();
  maybeShowOnboarding();
}
boot();
