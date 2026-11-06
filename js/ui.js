// Общие помощники интерфейса: экранирование, форматы (A5), статусы (A3), модальные окна, тосты

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Ссылка из данных пользователя: только http(s) и внутренние #/ — защита от javascript:-ссылок
export const safeUrl = (u) => esc(/^(https?:\/\/|#\/)/i.test(String(u ?? '').trim()) ? String(u).trim() : '#');

const nf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
export const money = (minor) => minor == null ? '—' : nf.format(Number(minor) / 100) + ' ₽';
export const toMinor = (rub) => Math.round(Number(String(rub).replace(/\s/g, '').replace(',', '.')) * 100);
export const fromMinor = (minor) => minor == null ? '' : String(Number(minor) / 100);

const dFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Moscow' });
const dtFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' });
export const date = (d) => d ? dFmt.format(typeof d === 'string' && d.length === 10 ? new Date(d + 'T12:00:00+03:00') : new Date(d)) : '—';
export const dateTime = (d) => d ? dtFmt.format(new Date(d)) + ' МСК' : '—';
export const period = (a, b) => {
  const days = Math.round((new Date(b) - new Date(a)) / 864e5) + 1;
  return `${date(a)} — ${date(b)} (${days} ${plural(days, 'день', 'дня', 'дней')})`;
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
  if (ms <= 0) return 'время вышло';
  const h = Math.floor(ms / 3600e3), m = Math.floor((ms % 3600e3) / 60e3);
  return h ? `${h} ч ${m} мин` : `${m} мин`;
};

export const UNIT = { HOUR: 'час', SHIFT: 'смена', DAY: 'сутки', NEGOTIABLE: '' };
export const priceText = (e) => e.price_unit === 'NEGOTIABLE' || e.price_minor == null
  ? 'Договорная' : `${money(e.price_minor)}<small> / ${UNIT[e.price_unit]}</small>`;

export const ORG_TYPE = { PERSON: 'Физлицо', LEGAL: 'Юрлицо', SOLE_PROP: 'ИП', SELF_EMPLOYED: 'Самозанятый' };
export const POLICY = {
  FLEXIBLE: 'Гибкие: бесплатная отмена за 24 ч до начала',
  MODERATE: 'Умеренные: бесплатная отмена за 72 ч до начала',
  STRICT: 'Строгие: бесплатная отмена за 7 суток до начала'
};
export const FORMAT = { WITH_OPERATOR: 'С оператором', WITHOUT_OPERATOR: 'Без оператора', ANY: 'Не важно' };

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
    DRAFT: ['gray', 'Черновик'], PUBLISHED: ['work', 'Ждёт предложений'], OFFERS_RECEIVED: ['work', 'Есть предложения'],
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
  bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><button class="x" aria-label="Закрыть">×</button>${html}</div>`;
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
export function askReason(title, text, label = 'Причина', btn = 'Подтвердить') {
  return new Promise((resolve) => {
    let done = false;
    const m = modal(`<h2>${esc(title)}</h2><p class="muted">${esc(text)}</p>
      <form><label class="f"><span>${esc(label)} <i>*</i></span><textarea class="inp" name="r" required maxlength="500"></textarea></label>
      <div class="actions"><button class="btn dark">${esc(btn)}</button><button type="button" class="btn ghost" data-c>Назад</button></div></form>`,
      { onClose: () => { if (!done) resolve(null); } });
    m.el.querySelector('[data-c]').onclick = () => m.close();
    m.el.querySelector('form').onsubmit = (e) => {
      e.preventDefault(); done = true;
      const v = e.target.r.value.trim(); m.close(); resolve(v);
    };
  });
}

export function confirmBox(title, text, btn = 'Подтвердить', danger = false) {
  return new Promise((resolve) => {
    let done = false;
    const m = modal(`<h2>${esc(title)}</h2><p>${text}</p>
      <div class="actions"><button class="btn ${danger ? 'danger' : 'dark'}" data-ok>${esc(btn)}</button>
      <button class="btn ghost" data-c>Отмена</button></div>`, { onClose: () => { if (!done) resolve(false); } });
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
  `<div class="panel empty"><b>Не удалось загрузить данные</b>${esc(err?.message || err)}<div><button class="btn ghost" onclick="location.reload()">Обновить страницу</button></div></div>`;

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
