// Точка входа: шапка, меню, маршрутизация по #/адресам
import { sb, configured, state, loadMe, setOrg, refreshCounters, loadCategories, isAdmin, canManage, CONSENT_VERSION, actsAsProvider, actsAsCustomer, passwordRecovery, signOutSafe } from './api.js';
import { esc, status, initials, toast, modal, WORDMARK, plural } from './ui.js';
import { t, isEn, setLang } from './i18n.js';
import { initDrafts } from './drafts.js';
import { initCityList } from './cities.js';
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
  // звезда — отзывы (сердечко — только «Избранное»)
  star: '<path d="m12 3.2 2.7 5.5 6 .9-4.35 4.25 1 6L12 17l-5.35 2.85 1-6L3.3 9.6l6-.9Z"/>',
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


// ---------- тема: как в системе / светлая / тёмная (сама тема ставится скриптом в index.html) ----------
const THEMES = { auto: ['auto', t('Авто', 'Auto'), t('как в системе', 'system')], light: ['sun', t('Светлая', 'Light'), t('светлая', 'light')], dark: ['moon', t('Тёмная', 'Dark'), t('тёмная', 'dark')] };
const themeMode = () => (window.ruinTheme ? window.ruinTheme.mode() : 'auto');
function setTheme(m) {
  document.body.classList.add('theme-anim');
  window.ruinTheme?.set(m);
  setTimeout(() => document.body.classList.remove('theme-anim'), 350);
  refreshShell();
}
const themeBtn = () => {
  const [ic, , text] = THEMES[themeMode()] || THEMES.auto;
  return `<button class="icon-btn" id="themeBtn" type="button" title="${t('Тема', 'Theme')}: ${text}" aria-label="${t('Тема', 'Theme')}: ${text}">${icon(ic)}</button>`;
};

// Организации пользователя: подпись и роль (для меню под аватаром)
const orgName = (x) => (x.type === 'PERSON' ? t('Я (частное лицо)', 'Me (individual)') : x.name);
const ROLE = () => (isEn() ? { OWNER: 'owner', ADMIN: 'administrator', MANAGER: 'manager', APPROVER: 'approver', FINANCE: 'accountant', VIEWER: 'viewer' }
  : { OWNER: 'владелец', ADMIN: 'администратор', MANAGER: 'менеджер', APPROVER: 'согласующий', FINANCE: 'бухгалтер', VIEWER: 'наблюдатель' });
const CHECK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>';
const CHEVRON = '<svg class="me-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
const LOGOUT = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l-5-5 5-5M5 12h11"/></svg>';

// Меню под аватаром (v=73): переключение организации («действую от имени»), профиль, отзывы, аналитика, сотрудники, выход
function meMenu() {
  const o = state.org;
  const others = (state.counters || {}).other_orgs || {};
  const item = (href, ic, text) => `<a href="${href}" role="menuitem">${icon(ic)}<span>${text}</span></a>`;
  let html = '';
  if (o && state.orgs.length) {
    html += `<div class="mm-cap">${t('ДЕЙСТВУЮ ОТ ИМЕНИ', 'ACTING ON BEHALF OF')}</div>
      ${state.orgs.map((x) => `<button type="button" role="menuitemradio" aria-checked="${x.id === o.id}" class="mm-org ${x.id === o.id ? 'on' : ''}" data-org="${x.id}">
        <span class="mm-check">${x.id === o.id ? CHECK : ''}</span><span class="mm-name">${esc(orgName(x))}</span>
        ${others[x.id] ? `<span class="cnt" title="${t('Сделки ждут вашего действия', 'Deals await your action')}">${others[x.id]}</span>` : ''}</button>`).join('')}
      ${o.type !== 'PERSON' ? `<div class="mm-meta">${status('org', o.verification_status)}<span>${t('Ваша роль', 'Your role')}: <b>${ROLE()[o.role] || o.role}</b>${canManage(o) ? '' : t(' · только просмотр', ' · view only')}</span></div>` : ''}
      <div class="mm-sep"></div>`;
  }
  html += item('#/account', 'org', t('Профиль и организации', 'Profile and organisations'));
  if (o) {
    html += item('#/reviews', 'star', t('Отзывы', 'Reviews')) + item('#/analytics', 'grid', t('Аналитика', 'Analytics'));
    if (o.type !== 'PERSON') html += item('#/team', 'org', t('Сотрудники', 'Team'));
  }
  html += `<a href="#" data-onb role="menuitem">${icon('send')}<span>${t('Как пользоваться', 'How it works')}</span></a>
    <div class="mm-sep"></div><button type="button" class="mm-out" data-logout role="menuitem">${LOGOUT}<span>${t('Выйти', 'Log out')}</span></button>`;
  return html;
}

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
  ['admin', 'admin'], ['terms', 'static'], ['privacy', 'static'], ['consent', 'static'], ['help', 'static'], ['support', 'static']
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

const SEO_TITLE = document.querySelector('meta[name="ruin-route"]') ? document.title : null;
export function parseHash() {
  let h = location.hash.replace(/^#\/?/, '');
  // Страницы для поисковиков (/tehnika/…, /arenda/…) делает сервер (server/seo_gen.py): в них <meta name="ruin-route">
  // с нужным разделом сайта. Пока в адресе нет #/…, открываем этот раздел — пользователь видит обычную страницу сайта.
  if (!location.hash) { const m = document.querySelector('meta[name="ruin-route"]'); if (m) h = m.content; }
  const [path, query = ''] = h.split('?');
  return { path, query: Object.fromEntries(new URLSearchParams(query)) };
}
export const go = (hash) => { location.hash = hash; };

// ---------- счётчик техники в шапке (v=77, раньше был на баннере главной) ----------
// Число опубликованной техники; обновляется раз в 5 минут, при первом показе плавно досчитывает от 0.
let eqCount = null, eqCountAt = 0, countShown = 0;
const countWord = (n) => (isEn() ? (n === 1 ? 'machine' : 'machines') : plural(n, 'единица техники', 'единицы техники', 'единиц техники'));
function paintCount() {
  const el = document.getElementById('topCount');
  if (!el || eqCount == null) return;
  const from = countShown, to = eqCount;
  countShown = to;
  document.getElementById('topCountWord').textContent = countWord(to);
  if (from === to || matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = to; return; }
  const t0 = performance.now(), dur = 1100;
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
async function loadEqCount() {
  if (!configured || Date.now() - eqCountAt < 300000) return;
  eqCountAt = Date.now();
  try {
    const { count, error } = await sb.from('equipment').select('id', { count: 'exact', head: true }).eq('status', 'PUBLISHED');
    if (!error && typeof count === 'number') { eqCount = count; paintCount(); }
  } catch {}
}

// ---------- шапка ----------
function renderTop() {
  const c = state.counters || {};
  const u = state.user;
  document.getElementById('top').innerHTML = `
    <a class="brand" href="#/" aria-label="${t('RUIN — главная', 'RUIN — home')}">${WORDMARK}<div class="brand-tag">${t('ТЕХНИКА ДЛЯ БОЛЬШИХ ПЛАНОВ', 'MACHINERY FOR BIG PLANS')}</div></a>
    <form class="search" id="topSearch" role="search">${icon('search')}
      <input name="q" placeholder="${t('Найти технику: экскаватор, автокран, самосвал…', 'Find machinery: excavator, truck crane, dump truck…')}" aria-label="${t('Поиск техники', 'Search machinery')}">
      <button class="btn sm dark">${t('Найти', 'Search')}</button></form>
    <div class="top-actions">
      <a class="top-count" href="#/catalog" title="${t('Техника в каталоге RUIN — смотреть', 'Machinery in the RUIN catalogue — browse')}"><i class="live-dot" aria-hidden="true"></i>
        <b id="topCount">${countShown || '…'}</b><span id="topCountWord">${countShown ? countWord(countShown) : t('единиц техники', 'machines')}</span></a>
      <button class="lang-btn" id="langBtn" type="button" title="${t('Switch to English', 'Переключить на русский')}">${t('EN', 'RU')}</button>
      ${themeBtn()}
      ${u ? `
        <a class="icon-btn" href="#/favorites" title="${t('Избранное', 'Favourites')}">${icon('heart')}</a>
        <a class="icon-btn" href="#/messages" title="${t('Сообщения', 'Messages')}">${icon('chat')}${c.unread_messages ? `<span class="badge-count">${c.unread_messages}</span>` : ''}</a>
        <a class="icon-btn" href="#/notifications" title="${t('Уведомления', 'Notifications')}">${icon('bell')}${c.notifications ? `<span class="badge-count">${c.notifications}</span>` : ''}</a>
        <div class="me-wrap"><button type="button" class="me" id="meBtn" aria-haspopup="menu" aria-expanded="false" aria-controls="meMenu" title="${t('Профиль, организации, выход', 'Profile, organisations, log out')}">
          <span class="avatar">${esc(initials(state.profile?.full_name || u.email))}${Object.keys(c.other_orgs || {}).some((k) => c.other_orgs[k]) ? '<i class="me-dot"></i>' : ''}</span>
          <div><b>${esc(state.profile?.full_name || u.email)}</b><small>${state.org ? esc(orgName(state.org)) : t('Мой кабинет', 'My account')}</small></div>${CHEVRON}</button>
          <div class="me-menu hidden" id="meMenu" role="menu">${meMenu()}</div></div>`
      : `<a class="btn ghost sm" href="#/login">${t('Войти', 'Log in')}</a><a class="btn sm" href="#/register">${t('Регистрация', 'Sign up')}</a>`}
    </div>`;
  if (u) bindMeMenu();
  loadEqCount();
  document.getElementById('langBtn').onclick = () => setLang(isEn() ? 'ru' : 'en');
  document.getElementById('topSearch').onsubmit = (e) => {
    e.preventDefault();
    go('#/catalog?q=' + encodeURIComponent(e.target.q.value.trim()));
  };
  document.getElementById('themeBtn').onclick = () => {
    const order = ['auto', 'light', 'dark'];
    const next = order[(order.indexOf(themeMode()) + 1) % order.length];
    setTheme(next);
    toast(t('Тема: ', 'Theme: ') + THEMES[next][2]);
  };
}

// Меню под аватаром: открыть/закрыть, переключить организацию, выйти
let meOutsideBound = false;
function bindMeMenu() {
  const btn = document.getElementById('meBtn');
  const menu = document.getElementById('meMenu');
  if (!btn || !menu) return;
  const setOpen = (open) => { menu.classList.toggle('hidden', !open); btn.setAttribute('aria-expanded', String(open)); };
  btn.onclick = (e) => { e.stopPropagation(); setOpen(menu.classList.contains('hidden')); };
  menu.addEventListener('click', (e) => { if (e.target.closest('a,[data-logout]')) setOpen(false); });
  menu.querySelectorAll('[data-org]').forEach((b) => b.onclick = async () => {
    setOpen(false);
    if (b.dataset.org === state.org?.id) return;
    const waiting = (state.counters?.other_orgs || {})[b.dataset.org];
    setOrg(b.dataset.org);
    await refreshCounters();
    toast(t('Теперь вы действуете от имени: ', 'Now acting on behalf of: ') + orgName(state.org));
    // В организации ждут действия по сделкам — сразу открываем сделки
    if (waiting) {
      const x = state.counters || {};
      const to = x.deals_provider ? '#/deals?tab=provider' : '#/deals?tab=customer';
      if (location.hash === to) route(); else go(to);
    } else route();
  });
  menu.querySelector('[data-logout]')?.addEventListener('click', async () => {
    if (!await signOutSafe()) return;
    await loadMe(); refreshShell(); go('#/');
  });
  if (!meOutsideBound) {
    meOutsideBound = true;
    document.addEventListener('click', (e) => {
      const m = document.getElementById('meMenu');
      if (m && !m.classList.contains('hidden') && !e.target.closest('.me-wrap')) { m.classList.add('hidden'); document.getElementById('meBtn')?.setAttribute('aria-expanded', 'false'); }
    });
    document.addEventListener('keydown', (e) => {
      const m = document.getElementById('meMenu');
      if (e.key === 'Escape' && m && !m.classList.contains('hidden')) { m.classList.add('hidden'); document.getElementById('meBtn')?.setAttribute('aria-expanded', 'false'); document.getElementById('meBtn')?.focus(); }
    });
  }
}

// ---------- боковое меню ----------
// v=73: слева — только работа (каталог, заказы, сделки, техника). Сообщения, уведомления и тема — в шапке;
// организации, профиль, отзывы, аналитика, сотрудники, «Как пользоваться» — в меню под аватаром; поддержка — в подвале и у помощника.
function renderSide(active) {
  const c = state.counters || {};
  const o = state.org;
  // cnt — нужно ваше действие (жёлтый), wait — ждёт другую сторону (серый)
  const link = (href, ic, text, cnt, wait) =>
    `<a href="${href}" class="${active === href ? 'active' : ''}">${icon(ic)}<span>${text}</span>${cnt ? `<span class="cnt" title="${t('Нужно ваше действие', 'Needs your action')}">${cnt}</span>` : ''}${wait ? `<span class="cnt wait" title="${t('Ждёт другую сторону', 'Waiting for the other party')}">${wait}</span>` : ''}</a>`;
  let html = `<div class="navs"><nav class="nav">
    ${link('#/', 'home', t('Главная', 'Home'))}${link('#/catalog', 'grid', t('Каталог техники', 'Machinery catalogue'))}
    ${state.user && (!o || (canManage(o) && o.can_order)) ? link('#/orders/new', 'plus', t('Разместить заказ', 'Post an order')) : ''}</nav>`;
  if (state.user && o) {
    if (actsAsCustomer(o)) {
      html += `<div class="nav-group customer"><div class="nav-role">${icon('list', 16)}<span>${t('Я заказчик', 'I am a customer')}</span><small>${t('арендую технику', 'I rent machinery')}</small></div><nav class="nav">
        ${link('#/orders', 'list', t('Мои заказы', 'My orders'), c.orders_offers)}${link('#/deals?tab=customer', 'deal', t('Сделки', 'Deals'), c.deals_customer, c.deals_customer_wait)}</nav></div>`;
    }
    if (actsAsProvider(o)) {
      html += `<div class="nav-group provider"><div class="nav-role">${icon('truck', 16)}<span>${t('Я исполнитель', 'I am a provider')}</span><small>${t('сдаю технику', 'I rent out machinery')}</small></div><nav class="nav">
        ${!o.can_provide ? `<a href="#/account" class="role-off">${t('Роль исполнителя выключена — техника скрыта из каталога. Включить →', 'Provider role is off — machinery hidden from the catalogue. Turn on →')}</a>` : ''}
        ${link('#/crm', 'desk', t('Рабочий стол', 'Desk'), c.crm_due)}${link('#/fleet', 'truck', t('Моя техника', 'My machinery'), c.fleet_stale)}${link('#/park', 'gauge', t('Учёт парка', 'Fleet management'))}${o.can_provide ? link('#/feed', 'feed', t('Лента заказов', 'Order feed'), (c.feed_new || 0) + (c.dates_pending || 0)) : ''}
        ${link('#/offers', 'send', t('Мои предложения', 'My offers'), c.dates_pending)}${link('#/deals?tab=provider', 'deal', t('Сделки', 'Deals'), c.deals_provider, c.deals_provider_wait)}</nav></div>`;
    }
  }
  if (state.user && isAdmin()) html += `<nav class="nav">${link('#/admin', 'shield', t('Админка', 'Admin'), c.admin?.total)}</nav>`;
  html += `</div>`;
  document.getElementById('sidebar').innerHTML = html;
}

export function refreshShell() {
  const { path, query } = parseHash();
  const m = match(path);
  const top = path.split('/')[0];
  // Для сделок подсвечиваем кнопку в блоке нужной роли (заказчик или исполнитель)
  let saved = null;
  try { saved = sessionStorage.getItem('ruin.dealTab'); } catch {}
  const dealTab = query.tab || saved || (actsAsCustomer() ? 'customer' : 'provider');
  const activeMap = { '': '#/', catalog: '#/catalog', item: '#/catalog', orders: path === 'orders/new' ? '#/orders/new' : '#/orders',
    deals: '#/deals?tab=' + dealTab, fleet: '#/fleet', feed: '#/feed', offers: '#/offers', messages: '#/messages',
    notifications: '#/notifications', account: '#/account', admin: '#/admin', team: '#/team', analytics: '#/analytics', company: '#/catalog', reviews: '#/reviews', crm: '#/crm', park: '#/park', support: '#/support', help: '#/support' };
  renderTop();
  renderSide(activeMap[top] ?? (m ? '#/' + m.name : ''));
}

// ---------- маршрутизация ----------
let cleanup = null;
const PUBLIC = new Set(['home', 'catalog', 'item', 'auth', 'static', 'company']);

const FOOTER = `<footer class="foot"><span>© RUIN, ${new Date().getFullYear()}</span><a href="#" data-onb>${t('Как пользоваться', 'How it works')}</a><a href="#/help">${t('Помощь', 'Help')}</a><a href="#/support">${t('Поддержка', 'Support')}</a>
  <a href="#/terms">${t('Пользовательское соглашение', 'Terms of use')}</a><a href="#/privacy">${t('Политика обработки ПДн', 'Privacy policy')}</a><a href="#/consent">${t('Согласие на обработку ПДн', 'Personal data consent')}</a>
  <span>${t('Фото техники — Wikimedia Commons, свободные лицензии, авторы указаны на фото', 'Machinery photos — Wikimedia Commons, free licences, authors credited on photos')}</span></footer>`;

export async function route() {
  // Ссылки из писем Supabase приходят с токеном в адресе — ждём, пока библиотека его обработает
  if (/error_description=/.test(location.hash)) {
    // Ссылка из письма не сработала (устарела, уже использована или её «открыл» почтовый антивирус)
    const p = new URLSearchParams(location.hash.slice(1));
    const d = p.get('error_description') || '';
    const expired = p.get('error_code') === 'otp_expired' || /expired|invalid/i.test(d);
    history.replaceState(null, '', location.pathname + location.search);
    document.getElementById('app').innerHTML = `<div class="panel"><h2>${t('Ссылка из письма не сработала', 'The email link did not work')}</h2>
      <p>${expired ? t('Ссылка устарела или уже была использована. Так бывает, если письмо открыли повторно или почтовый сервис сам проверил ссылку.', 'The link has expired or was already used. This happens if the email was opened twice or your mail service checked the link.') : t('Ошибка: ', 'Error: ') + esc(d)}</p>
      <p class="muted">${t('Запросите новое письмо и откройте ссылку из него сразу, один раз.', 'Request a new email and open its link right away, once.')}</p>
      <div class="actions"><a class="btn" href="#/forgot">${t('Отправить письмо для смены пароля', 'Send a password reset email')}</a><a class="btn ghost" href="#/login">${t('Войти', 'Log in')}</a></div></div>`;
    return;
  }
  if (/access_token=/.test(location.hash)) {
    document.getElementById('app').innerHTML = `<div class="panel">${t('Входим…', 'Signing in…')}</div>`;
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
    app.innerHTML = `<div class="panel empty"><b>${t('Страница не найдена', 'Page not found')}</b>${t('Возможно, ссылка устарела.', 'The link may be outdated.')}<div><a class="btn" href="#/">${t('На главную', 'Go home')}</a></div></div>`;
    return;
  }
  if (!PUBLIC.has(m.mod) && !state.user) {
    go('#/login?next=' + encodeURIComponent(location.hash));
    return;
  }
  app.innerHTML = '<div class="skeleton" style="height:320px"></div>';
  // Главная — полный заголовок для поисковиков (как в index.html), остальные страницы — короткий
  document.title = m.mod === 'home' ? t('Аренда спецтехники в Москве и Санкт-Петербурге — экскаваторы, автокраны | RUIN', 'Construction machinery rental in Moscow and St Petersburg | RUIN')
    : t('RUIN — аренда спецтехники', 'RUIN — construction machinery rental');
  try {
    const page = await import(`./pages/${m.mod}.js`);
    cleanup = await page.render(app, m.params, query, m.pattern);
    // Страница для поисковиков (/arenda/…, /tehnika/…): оставляем её заголовок, пока пользователь не ушёл в другой раздел
    if (SEO_TITLE && !location.hash) document.title = SEO_TITLE;
    if (!app.querySelector('.foot')) app.insertAdjacentHTML('beforeend', FOOTER);
    if (m.mod !== 'static') askConsent();
    if (!['static', 'auth'].includes(m.mod)) tgPrompt(app);
  } catch (err) {
    console.error(err);
    app.innerHTML = `<div class="panel empty"><b>${t('Что-то пошло не так', 'Something went wrong')}</b>${esc(err.message)}<div><button class="btn ghost" data-reload>${t('Обновить', 'Reload')}</button></div></div>`;
  }
  window.scrollTo(0, 0);
}

// Приглашение подключить Telegram в один клик: плашка для тех, у кого нет мессенджера; сразу после регистрации — окно.
// «Не сейчас» скрывает на 14 дней.
let tgModalShown = false;
function tgPrompt(app) {
  if (!state.user || state.msgrLinked || state.needConsent) return;
  let off = 0, fresh = false;
  try { off = Number(localStorage.getItem('ruin.tgPromptOff')) || 0; fresh = sessionStorage.getItem('ruin.justRegistered') === '1'; } catch {}
  if (!fresh && Date.now() < off) return;
  const text = t('<b>Получайте уведомления в Telegram</b> — о новых бронях, сообщениях и сроках документов. Один клик: откроется окно Telegram, нажмите «Разрешить». Искать бота не нужно.',
    '<b>Get notifications in Telegram</b> — new bookings, messages and document deadlines. One click: a Telegram window opens, press “Allow”. No need to find a bot.');
  const later = () => { try { localStorage.setItem('ruin.tgPromptOff', String(Date.now() + 14 * 864e5)); sessionStorage.removeItem('ruin.justRegistered'); } catch {} };
  const connect = async (btn, done) => {
    try {
      const mod = await import('./tglogin.js');
      if (await mod.connectTelegram()) { toast(t('Telegram подключён — уведомления будут приходить туда', 'Telegram connected')); try { sessionStorage.removeItem('ruin.justRegistered'); } catch {} done(); }
    } catch (err) { toast(err.message, true); }
  };
  import('./tglogin.js').then((mod) => mod.prepareTelegram()).catch(() => {});
  if (fresh) {
    if (tgModalShown) return;
    tgModalShown = true;
    const m = modal(`<h2>${t('Аккаунт создан', 'Account created')} 🎉</h2><p>${text}</p>
      <div class="actions"><button class="btn" data-tgp type="button">${t('Подключить Telegram', 'Connect Telegram')}</button><button class="btn ghost" data-tgp-off type="button">${t('Позже', 'Later')}</button></div>
      <p class="small muted" style="margin:10px 0 0">${t('Без Telegram уведомления придут на почту.', 'Without Telegram, notifications go to your email.')}</p>`, { onClose: later });
    m.el.querySelector('[data-tgp]').onclick = (e) => connect(e.currentTarget, () => m.close());
    m.el.querySelector('[data-tgp-off]').onclick = () => m.close();
    return;
  }
  const bar = document.createElement('div');
  bar.className = 'banner info tg-prompt';
  bar.innerHTML = `<div style="flex:1">${text}</div><div class="actions"><button class="btn sm" data-tgp type="button">${t('Подключить', 'Connect')}</button><button class="btn ghost sm" data-tgp-off type="button">${t('Не сейчас', 'Not now')}</button></div>`;
  app.prepend(bar);
  bar.querySelector('[data-tgp]').onclick = (e) => connect(e.currentTarget, () => bar.remove());
  bar.querySelector('[data-tgp-off]').onclick = () => { later(); bar.remove(); };
}

// Пользователи, зарегистрированные до появления отдельного согласия (или до новой редакции), подтверждают его один раз
let consentOpen = false;
function askConsent() {
  if (!state.user || !state.needConsent || consentOpen) return;
  consentOpen = true;
  const m = modal(t(`<h2>Обновили документы</h2>
    <p>Мы оформили отдельное <a href="#/consent" target="_blank">согласие на обработку персональных данных</a>, обновили <a href="#/privacy" target="_blank">политику</a> и <a href="#/terms" target="_blank">пользовательское соглашение</a>. Чтобы продолжить работу, подтвердите согласие.</p>
    <form id="cf"><label class="check"><input type="checkbox" name="pd" required><span>Даю согласие на обработку персональных данных и принимаю пользовательское соглашение</span></label>
      <div class="actions"><button class="btn">Подтвердить</button><button class="btn ghost" type="button" data-out>Выйти из аккаунта</button></div></form>`,
    `<h2>Our documents have been updated</h2>
    <p>We have issued a separate <a href="#/consent" target="_blank">personal data processing consent</a> and updated the <a href="#/privacy" target="_blank">privacy policy</a> and <a href="#/terms" target="_blank">terms of use</a>. Please confirm your consent to continue.</p>
    <form id="cf"><label class="check"><input type="checkbox" name="pd" required><span>I consent to the processing of my personal data and accept the terms of use</span></label>
      <div class="actions"><button class="btn">Confirm</button><button class="btn ghost" type="button" data-out>Log out</button></div></form>`),
    { onClose: () => { consentOpen = false; } });
  m.el.querySelector('[data-out]').onclick = async () => { if (!await signOutSafe()) return; m.close(); await loadMe(); refreshShell(); go('#/'); };
  m.el.querySelector('#cf').onsubmit = async (e) => {
    e.preventDefault();
    const { error } = await sb.rpc('accept_consents', { p_version: CONSENT_VERSION });
    if (error) return toast(error.message, true);
    state.needConsent = false; m.close(); toast(t('Спасибо, согласие сохранено', 'Thank you, consent saved'));
  };
}

// ---------- запуск ----------
async function boot() {
  if (configured) {
    try {
      await Promise.all([loadMe(), loadCategories()]);
      await refreshCounters();
    } catch (err) { console.error(err); toast(t('Нет связи с сервером', 'No connection to the server'), true); }
    // Пришли по ссылке «Забыли пароль?» — сразу открываем форму нового пароля (сигнал библиотеки к этому моменту уже прошёл)
    if (passwordRecovery) history.replaceState(null, '', location.pathname + location.search.replace(/[?&](code|type)=[^&]*/g, '') + '#/reset');
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
  // Вместо onclick в разметке (их запрещает защита CSP): data-reload, data-print, data-hash
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-reload],[data-print],[data-hash]');
    if (!el) return;
    if (el.hasAttribute('data-reload')) location.reload();
    else if (el.hasAttribute('data-print')) window.print();
    else if (el.dataset.hash?.startsWith('#/') && !e.target.closest('a,button,input,select,label')) location.hash = el.dataset.hash;
  });
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
    const tg = ev.target;
    if (!isDate(tg)) return;
    const e = endOf(tg);
    if (e && limitEnd(tg, e)) {
      toast(t('Окончание не может быть раньше начала — поставили дату начала', 'End cannot be before start — set to the start date'));
      e.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    const s = startOf(tg);
    if (s && isDate(s) && s.value && tg.value && tg.value < s.value) {
      tg.value = s.value;
      toast(t('Окончание не может быть раньше начала — поставили дату начала', 'End cannot be before start — set to the start date'));
    }
  }, true);
  document.addEventListener('focusin', (ev) => { const tg = ev.target; if (isDate(tg)) { const s = startOf(tg); if (s) limitEnd(s, tg); } });
  initDrafts();
  initCityList(); // выпадающий список городов у всех полей «Город»
  // Бот-подсказчик поддержки — круглая кнопка в правом нижнем углу на всех страницах
  import('./support.js').then((m) => m.mountHelpBot()).catch((err) => console.error(err));
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
    b.setAttribute('aria-label', t('Показать пароль', 'Show password')); b.title = t('Показать пароль', 'Show password');
    b.onclick = () => {
      const show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      b.innerHTML = show ? EYE_OFF : EYE;
      const lbl = show ? t('Скрыть пароль', 'Hide password') : t('Показать пароль', 'Show password');
      b.setAttribute('aria-label', lbl); b.title = lbl;
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
