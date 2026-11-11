// Общие помощники интерфейса: экранирование, форматы (A5), статусы (A3), модальные окна, тосты
import { t, isEn } from './i18n.js';

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Логотип-надпись «RUIN.»: жёлтый квадрат в углу R и жёлтая точка (буквы рисуются фигурами — не зависят от шрифта)
export const WORDMARK = `<svg class="wordmark" viewBox="0 0 186 50" role="img" aria-label="RUIN."><rect x="0" y="0" width="12" height="12" fill="#f5c400"/><g fill="currentColor"><rect x="0" y="13" width="12" height="37"/><path fill-rule="evenodd" d="M13 0H31C41 0 47 6.5 47 16C47 23.5 42.5 28.8 35.5 30.6L48 50H34.5L23 32H12V13H13ZM13 11V21H30C34 21 36 19 36 16C36 13 34 11 30 11Z"/><path d="M54 0H66V30C66 36 70 39 76 39C82 39 86 36 86 30V0H98V30C98 43 89 50 76 50C63 50 54 43 54 30Z"/><rect x="106" y="0" width="12" height="50"/><path d="M126 0H137L155 29V0H167V50H156L138 21V50H126Z"/></g><rect x="174" y="38" width="12" height="12" fill="#f5c400"/></svg>`;

// Ссылка из данных пользователя: только http(s) и внутренние #/ — защита от javascript:-ссылок
export const safeUrl = (u) => esc(/^(https?:\/\/|#\/)/i.test(String(u ?? '').trim()) ? String(u).trim() : '#');

const nf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
export const money = (minor) => minor == null ? '—' : nf.format(Number(minor) / 100) + ' ₽';
export const toMinor = (rub) => Math.round(Number(String(rub).replace(/\s/g, '').replace(',', '.')) * 100);
export const fromMinor = (minor) => minor == null ? '' : String(Number(minor) / 100);
// Доставка в предложении исполнителя (SQL 25): аренда и доставка отдельно. У старых предложений — только итог.
export const DELIVERY_MODE = { PAID: 'Платная — оплачивает заказчик', INCLUDED: 'Включена в стоимость аренды', PICKUP: 'Не нужна — заказчик забирает сам' };
export function offerParts(f) {
  const b = f?.breakdown || {};
  if (!b.delivery_mode) return { mode: null, rent: null, delivery: null, text: 'не указана отдельно — уточните у исполнителя (см. комментарий)' };
  return { mode: b.delivery_mode, rent: b.rent, delivery: b.delivery || 0,
    text: b.delivery_mode === 'PAID' ? `${money(b.delivery)} — оплачивает заказчик` : DELIVERY_MODE[b.delivery_mode] };
}

const dFmt = new Intl.DateTimeFormat(isEn() ? 'en-GB' : 'ru-RU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Moscow' });
const dtFmt = new Intl.DateTimeFormat(isEn() ? 'en-GB' : 'ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' });
export const date = (d) => d ? dFmt.format(typeof d === 'string' && d.length === 10 ? new Date(d + 'T12:00:00+03:00') : new Date(d)) : '—';
export const dateTime = (d) => d ? dtFmt.format(new Date(d)) + t(' МСК', ' MSK') : '—';
export const period = (a, b) => {
  const days = Math.round((new Date(b) - new Date(a)) / 864e5) + 1;
  return `${date(a)} — ${date(b)} (${days} ${t(plural(days, 'день', 'дня', 'дней'), days === 1 ? 'day' : 'days')})`;
};
export function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
// Дата «сегодня» по Москве в формате YYYY-MM-DD
export function mskToday(addDays = 0) {
  const d = new Date(Date.now() + 3 * 3600e3 + addDays * 864e5);
  return d.toISOString().slice(0, 10);
}
export const timeLeft = (iso) => {
  const ms = new Date(iso) - Date.now();
  if (ms <= 0) return t('время вышло', 'time is up');
  const h = Math.floor(ms / 3600e3), m = Math.floor((ms % 3600e3) / 60e3);
  return h ? `${h} ${t('ч', 'h')} ${m} ${t('мин', 'min')}` : `${m} ${t('мин', 'min')}`;
};

export const UNIT = isEn() ? { HOUR: 'hour', SHIFT: 'shift', DAY: 'day', NEGOTIABLE: '' } : { HOUR: 'час', SHIFT: 'смена', DAY: 'сутки', NEGOTIABLE: '' };
export const priceText = (e) => e.price_unit === 'NEGOTIABLE' || e.price_minor == null
  ? t('Договорная', 'Negotiable') : `${money(e.price_minor)}<small> / ${UNIT[e.price_unit]}</small>`;

export const ORG_TYPE = isEn() ? { PERSON: 'Individual', LEGAL: 'Company', SOLE_PROP: 'Sole proprietor', SELF_EMPLOYED: 'Self-employed' } : { PERSON: 'Физлицо', LEGAL: 'Юрлицо', SOLE_PROP: 'ИП', SELF_EMPLOYED: 'Самозанятый' };
// Условия отмены (с 11.11.2026 — два варианта). Коды в базе прежние: FLEXIBLE = бесплатно,
// STRICT = по согласованию; старый MODERATE показывается как «по согласованию».
export const POLICY = isEn() ? {
  FLEXIBLE: 'Free cancellation — any time before work starts',
  MODERATE: 'By agreement — the parties agree on cancellation terms and costs between themselves',
  STRICT: 'By agreement — the parties agree on cancellation terms and costs between themselves'
} : {
  FLEXIBLE: 'Бесплатная отмена — в любое время до начала работ',
  MODERATE: 'По согласованию сторон — порядок и стоимость отмены стороны согласуют между собой',
  STRICT: 'По согласованию сторон — порядок и стоимость отмены стороны согласуют между собой'
};
// Что можно выбрать в карточке техники
export const POLICY_CHOICES = ['FLEXIBLE', 'STRICT'];
export const policyChoice = (p) => (p === 'MODERATE' ? 'STRICT' : p || 'FLEXIBLE');
export const FORMAT = isEn() ? { WITH_OPERATOR: 'With operator', WITHOUT_OPERATOR: 'Without operator', ANY: 'Any' } : { WITH_OPERATOR: 'С оператором', WITHOUT_OPERATOR: 'Без оператора', ANY: 'Не важно' };

// Единый справочник подписей статусов (D99): [класс, подпись]
const S = {
  org: {
    DRAFT: ['gray', 'Не проверена'], PENDING_REVIEW: ['wait', 'На проверке'], VERIFIED: ['ok', 'Проверена'],
    REQUIRES_UPDATE: ['warn', 'Нужно исправить'], REJECTED: ['err', 'Отклонена'], SUSPENDED: ['err', 'Приостановлена']
  },
  equipment: {
    DRAFT: ['gray', 'Черновик'], PENDING_MODERATION: ['wait', 'На модерации'], PUBLISHED: ['ok', 'Опубликована'],
    REJECTED: ['err', 'Отклонена'], HIDDEN: ['closed', 'Скрыта'], ARCHIVED: ['closed', 'В архиве']
  },
  order: {
    DRAFT: ['gray', 'Черновик'], PUBLISHED: ['work', 'Ждёт предложений'], OFFERS_RECEIVED: ['offers', 'Есть предложения'],
    NEGOTIATION: ['wait', 'Ждёт подтверждения'], CONVERTED_TO_DEAL: ['ok', 'Сделка заключена'],
    EXPIRED: ['closed', 'Истёк'], CANCELLED: ['closed', 'Отменён']
  },
  offer: {
    SUBMITTED: ['work', 'Отправлено'], SELECTED: ['wait', 'Выбрано, ждёт подтверждения'], ACCEPTED: ['ok', 'Принято'],
    DECLINED: ['err', 'Отклонено'], WITHDRAWN: ['closed', 'Отозвано'], EXPIRED: ['closed', 'Истекло'],
    UNAVAILABLE: ['warn', 'Техника занята'], LOST: ['closed', 'Выбрано другое']
  },
  deal: {
    AWAITING_CONFIRMATION: ['wait', 'Ожидает подтверждения'], CONFIRMED: ['ok', 'Подтверждена'],
    IN_PROGRESS: ['work', 'В работе'], COMPLETION_PENDING: ['wait', 'Ожидает подтверждения завершения'],
    COMPLETED: ['ok', 'Завершена'], CANCELLED: ['closed', 'Отменена']
  },
  booking: {
    HOLD: ['wait', 'Бронь (ждёт)'], CONFIRMED: ['ok', 'Занято'], ACTIVE: ['work', 'В работе'],
    COMPLETED: ['closed', 'Завершено'], RELEASED: ['closed', 'Снято'], EXPIRED: ['closed', 'Истекло']
  }
};
// Английские подписи статусов
const S_EN = {
  org: { DRAFT: 'Not verified', PENDING_REVIEW: 'Under review', VERIFIED: 'Verified', REQUIRES_UPDATE: 'Needs changes', REJECTED: 'Rejected', SUSPENDED: 'Suspended' },
  equipment: { DRAFT: 'Draft', PENDING_MODERATION: 'In moderation', PUBLISHED: 'Published', REJECTED: 'Rejected', HIDDEN: 'Hidden', ARCHIVED: 'Archived' },
  order: { DRAFT: 'Draft', PUBLISHED: 'Awaiting offers', OFFERS_RECEIVED: 'Offers received', NEGOTIATION: 'Awaiting confirmation', CONVERTED_TO_DEAL: 'Deal made', EXPIRED: 'Expired', CANCELLED: 'Cancelled' },
  offer: { SUBMITTED: 'Sent', SELECTED: 'Selected, awaiting confirmation', ACCEPTED: 'Accepted', DECLINED: 'Declined', WITHDRAWN: 'Withdrawn', EXPIRED: 'Expired', UNAVAILABLE: 'Machine busy', LOST: 'Another offer chosen' },
  deal: { AWAITING_CONFIRMATION: 'Awaiting confirmation', CONFIRMED: 'Confirmed', IN_PROGRESS: 'In progress', COMPLETION_PENDING: 'Awaiting completion', COMPLETED: 'Completed', CANCELLED: 'Cancelled' },
  booking: { HOLD: 'Hold (pending)', CONFIRMED: 'Booked', ACTIVE: 'In progress', COMPLETED: 'Completed', RELEASED: 'Released', EXPIRED: 'Expired' }
};
if (isEn()) for (const k in S) for (const c in S[k]) if (S_EN[k]?.[c]) S[k][c] = [S[k][c][0], S_EN[k][c]];

export const status = (kind, code) => {
  const [cls, label] = (S[kind] && S[kind][code]) || ['gray', code];
  return `<span class="st ${cls}">${esc(label)}</span>`;
};
export const statusLabel = (kind, code) => ((S[kind] && S[kind][code]) || [0, code])[1];

// Подписи характеристик (B3)
export const SPEC_LABELS = {
  operating_weight_kg: ['Эксплуатационная масса', 'кг'], bucket_volume_m3: ['Объём ковша', 'м³'],
  max_dig_depth_m: ['Глубина копания', 'м'], engine_power_kw: ['Мощность двигателя', 'кВт'],
  undercarriage: ['Ходовая', ''], load_capacity_kg: ['Грузоподъёмность', 'кг'], blade_width_m: ['Ширина отвала', 'м'],
  blade_length_m: ['Длина отвала', 'м'], drum_width_mm: ['Ширина вальца', 'мм'], roller_type: ['Тип катка', ''],
  paving_width_m: ['Ширина укладки', 'м'], milling_width_mm: ['Ширина фрезерования', 'мм'],
  milling_depth_mm: ['Глубина фрезерования', 'мм'], load_capacity_t: ['Грузоподъёмность', 'т'],
  boom_length_m: ['Длина стрелы', 'м'], max_lift_height_m: ['Высота подъёма', 'м'], axles: ['Осей', ''],
  jib_length_m: ['Вылет стрелы', 'м'], hook_height_m: ['Высота крюка', 'м'], working_height_m: ['Рабочая высота', 'м'],
  platform_load_kg: ['Грузоподъёмность люльки', 'кг'], chassis: ['Шасси', ''], payload_t: ['Грузоподъёмность', 'т'],
  body_volume_m3: ['Объём кузова', 'м³'], axle_formula: ['Колёсная формула', ''], drilling_depth_m: ['Глубина бурения', 'м'],
  drilling_diameter_mm: ['Диаметр бурения', 'мм'], drill_type: ['Тип бурения', ''], drum_volume_m3: ['Объём барабана', 'м³'],
  weight_kg: ['Масса', 'кг'], description_specs: ['Характеристики', '']
};
if (isEn()) Object.assign(SPEC_LABELS, {
  operating_weight_kg: ['Operating weight', 'kg'], bucket_volume_m3: ['Bucket capacity', 'm³'], max_dig_depth_m: ['Digging depth', 'm'],
  engine_power_kw: ['Engine power', 'kW'], undercarriage: ['Undercarriage', ''], load_capacity_kg: ['Load capacity', 'kg'],
  blade_width_m: ['Blade width', 'm'], blade_length_m: ['Blade length', 'm'], drum_width_mm: ['Drum width', 'mm'], roller_type: ['Roller type', ''],
  paving_width_m: ['Paving width', 'm'], milling_width_mm: ['Milling width', 'mm'], milling_depth_mm: ['Milling depth', 'mm'],
  load_capacity_t: ['Lifting capacity', 't'], boom_length_m: ['Boom length', 'm'], max_lift_height_m: ['Lift height', 'm'], axles: ['Axles', ''],
  jib_length_m: ['Jib reach', 'm'], hook_height_m: ['Hook height', 'm'], working_height_m: ['Working height', 'm'],
  platform_load_kg: ['Platform capacity', 'kg'], chassis: ['Chassis', ''], payload_t: ['Payload', 't'], body_volume_m3: ['Body volume', 'm³'],
  axle_formula: ['Wheel arrangement', ''], drilling_depth_m: ['Drilling depth', 'm'], drilling_diameter_mm: ['Drilling diameter', 'mm'],
  drill_type: ['Drilling type', ''], drum_volume_m3: ['Drum volume', 'm³'], weight_kg: ['Weight', 'kg'], description_specs: ['Specifications', '']
});
// Обязательные характеристики по категориям (B3)
export const CATEGORY_SPECS = {
  excavators: ['operating_weight_kg', 'bucket_volume_m3', 'max_dig_depth_m', 'engine_power_kw', 'undercarriage'],
  mini_excavators: ['operating_weight_kg', 'bucket_volume_m3', 'max_dig_depth_m', 'engine_power_kw', 'undercarriage'],
  backhoe_loaders: ['operating_weight_kg', 'bucket_volume_m3', 'max_dig_depth_m', 'engine_power_kw'],
  wheel_loaders: ['load_capacity_kg', 'bucket_volume_m3', 'engine_power_kw'],
  mini_loaders: ['load_capacity_kg', 'bucket_volume_m3', 'engine_power_kw'],
  telehandlers: ['load_capacity_kg', 'working_height_m', 'engine_power_kw'],
  bulldozers: ['operating_weight_kg', 'blade_width_m', 'engine_power_kw'],
  graders: ['operating_weight_kg', 'blade_length_m', 'engine_power_kw'],
  rollers: ['operating_weight_kg', 'drum_width_mm', 'roller_type'],
  pavers: ['paving_width_m', 'engine_power_kw', 'undercarriage'],
  truck_cranes: ['load_capacity_t', 'boom_length_m', 'max_lift_height_m', 'axles'],
  aerial_platforms: ['working_height_m', 'platform_load_kg', 'chassis'],
  dump_trucks: ['payload_t', 'body_volume_m3', 'axle_formula'],
  manipulators: ['load_capacity_t', 'boom_length_m', 'axle_formula'],
  drilling_rigs: ['drilling_depth_m', 'drilling_diameter_mm', 'drill_type'],
  concrete: ['boom_length_m', 'drum_volume_m3'],
  other: ['weight_kg', 'description_specs']
};
export const specValue = (code, v) => {
  const u = (SPEC_LABELS[code] || [])[1];
  const val = typeof v === 'number' ? nf.format(v) : v;
  return u ? `${val} ${u}` : val;
};

// ---------- тосты ----------
let toastTimer;
export function toast(text, isErr = false) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.classList.toggle('err', isErr);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), isErr ? 5000 : 2800);
}

// ---------- модальное окно ----------
export function modal(html, { onClose } = {}) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><button class="x" aria-label="${t('Закрыть', 'Close')}">×</button>${html}</div>`;
  const close = () => { bg.remove(); document.removeEventListener('keydown', onKey); onClose && onClose(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  bg.addEventListener('click', (e) => { if (e.target === bg) close(); });
  bg.querySelector('.x').addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  document.body.appendChild(bg);
  const first = bg.querySelector('input,select,textarea,button:not(.x)');
  first && first.focus();
  return { el: bg.querySelector('.modal'), close };
}

// Окно с полем «причина» — для отмен, отклонений и т.п.
export function askReason(title, text, label = t('Причина', 'Reason'), btn = t('Подтвердить', 'Confirm')) {
  return new Promise((resolve) => {
    let done = false;
    const m = modal(`<h2>${esc(title)}</h2><p class="muted">${esc(text)}</p>
      <form><label class="f"><span>${esc(label)} <i>*</i></span><textarea class="inp" name="r" required maxlength="500"></textarea></label>
      <div class="actions"><button class="btn dark">${esc(btn)}</button><button type="button" class="btn ghost" data-c>${t('Назад', 'Back')}</button></div></form>`,
      { onClose: () => { if (!done) resolve(null); } });
    m.el.querySelector('[data-c]').onclick = () => m.close();
    m.el.querySelector('form').onsubmit = (e) => {
      e.preventDefault(); done = true;
      const v = e.target.r.value.trim(); m.close(); resolve(v);
    };
  });
}

export function confirmBox(title, text, btn = t('Подтвердить', 'Confirm'), danger = false) {
  return new Promise((resolve) => {
    let done = false;
    const m = modal(`<h2>${esc(title)}</h2><p>${text}</p>
      <div class="actions"><button class="btn ${danger ? 'danger' : 'dark'}" data-ok>${esc(btn)}</button>
      <button class="btn ghost" data-c>${t('Отмена', 'Cancel')}</button></div>`, { onClose: () => { if (!done) resolve(false); } });
    m.el.querySelector('[data-ok]').onclick = () => { done = true; m.close(); resolve(true); };
    m.el.querySelector('[data-c]').onclick = () => m.close();
  });
}

// Кнопка с индикатором загрузки: блокирует повторные нажатия (идемпотентность на клиенте)
export async function busy(btn, fn) {
  if (!btn || btn.disabled) return;
  const html = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span>' + html;
  try { return await fn(); }
  finally { btn.disabled = false; btn.innerHTML = html; }
}

export const skeleton = (n = 6, h = 260) =>
  `<div class="products">${Array.from({ length: n }, () => `<div class="skeleton" style="height:${h}px"></div>`).join('')}</div>`;

export const emptyState = (title, text, actionHtml = '') =>
  `<div class="panel empty"><b>${esc(title)}</b>${esc(text)}${actionHtml ? `<div>${actionHtml}</div>` : ''}</div>`;

export const errorState = (err) =>
  `<div class="panel empty"><b>${t('Не удалось загрузить данные', 'Could not load data')}</b>${esc(err?.message || err)}<div><button class="btn ghost" data-reload>${t('Обновить страницу', 'Reload page')}</button></div></div>`;

export const initials = (name) => (name || '?').replace(/[«»"()]/g, '').replace(/^(ООО|ИП|АО|ПАО|ЗАО)\s+/i, '')
  .split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export function photoOf(e, i = 0) {
  const p = (e.photos || [])[i];
  return p ? (typeof p === 'string' ? { url: p } : p) : null;
}

export const qs = (obj) => {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => { if (v !== '' && v != null && v !== false) p.set(k, v); });
  const s = p.toString();
  return s ? '?' + s : '';
};

// Маленький генератор ключа идемпотентности
export const idemKey = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
