// Выпадающие списки для полей с ручным вводом (не <datalist>): одинаково работают на телефоне (iPhone, Android) и на компьютере.
// При вводе показывают подходящие варианты; любое другое значение можно вписать вручную.
// Поля: input[name="city"] — города; input[data-dd="…"] — другой справочник (20.11.2026):
//   district — районы по городу из той же формы; svc — виды работ ТО; opt:<код> — варианты характеристики;
//   свои источники страницы регистрируют через registerSource (например, марки и модели в карточке техники).
import { LO_TOWNS, SPB_TOWNS, districtsFor, SERVICE_TITLES, SPEC_OPTIONS } from './catalog-data.js';

// Порядок — примерно по численности населения (крупные сверху); после Москвы и Петербурга — пригороды СПб и города Ленобласти
export const CITIES = [
  'Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург', 'Казань', 'Красноярск', 'Нижний Новгород',
  'Челябинск', 'Уфа', 'Самара', 'Ростов-на-Дону', 'Краснодар', 'Омск', 'Воронеж', 'Пермь', 'Волгоград',
  'Саратов', 'Тюмень', 'Тольятти', 'Махачкала', 'Барнаул', 'Ижевск', 'Хабаровск', 'Ульяновск', 'Иркутск',
  'Владивосток', 'Ярославль', 'Ставрополь', 'Томск', 'Кемерово', 'Набережные Челны', 'Оренбург',
  'Новокузнецк', 'Балашиха', 'Рязань', 'Чебоксары', 'Пенза', 'Липецк', 'Калининград', 'Астрахань', 'Тула',
  'Киров', 'Сочи', 'Курск', 'Улан-Удэ', 'Тверь', 'Магнитогорск', 'Сургут', 'Брянск', 'Якутск', 'Иваново',
  'Владимир', 'Грозный', 'Чита', 'Нижний Тагил', 'Калуга', 'Белгород', 'Волжский', 'Подольск', 'Вологда',
  'Смоленск', 'Саранск', 'Курган', 'Череповец', 'Архангельск', 'Владикавказ', 'Орёл', 'Мурманск', 'Химки',
  'Тамбов', 'Стерлитамак', 'Петрозаводск', 'Кострома', 'Мытищи', 'Нижневартовск', 'Новороссийск',
  'Йошкар-Ола', 'Люберцы', 'Таганрог', 'Комсомольск-на-Амуре', 'Сыктывкар', 'Нальчик', 'Шахты',
  'Нижнекамск', 'Братск', 'Дзержинск', 'Орск', 'Благовещенск', 'Энгельс', 'Ангарск', 'Королёв',
  'Великий Новгород', 'Старый Оскол', 'Красногорск', 'Псков', 'Бийск', 'Прокопьевск', 'Балаково',
  'Рыбинск', 'Южно-Сахалинск', 'Армавир', 'Одинцово', 'Северодвинск', 'Абакан', 'Петропавловск-Камчатский',
  'Норильск', 'Сызрань', 'Волгодонск', 'Новочеркасск', 'Каменск-Уральский', 'Златоуст', 'Электросталь',
  'Альметьевск', 'Салават', 'Миасс', 'Находка', 'Копейск', 'Пятигорск', 'Хасавюрт', 'Рубцовск',
  'Березники', 'Коломна', 'Майкоп', 'Ковров', 'Уссурийск', 'Новый Уренгой', 'Ноябрьск', 'Нефтеюганск',
  'Ханты-Мансийск', 'Тобольск', 'Магадан'
];
const ALL_CITIES = [...CITIES.slice(0, 2), ...SPB_TOWNS, ...LO_TOWNS, ...CITIES.slice(2)];

const norm = (s) => String(s ?? '').toLowerCase().replace(/ё/g, 'е').trim();
const SEL = 'input[name="city"], input[data-dd]';

// Источники: функция (поле) → массив вариантов; limit — сколько показывать без ввода
const SOURCES = {
  city: { get: () => ALL_CITIES, limit: 8 },
  district: { get: (inp) => districtsFor(inp.form?.querySelector('[name="city"]')?.value) },
  svc: { get: () => SERVICE_TITLES },
};
export function registerSource(name, get, limit) { SOURCES[name] = { get, limit }; }
const sourceOf = (inp) => {
  const k = inp.dataset.dd || (inp.name === 'city' ? 'city' : '');
  if (k.startsWith('opt:')) return { get: () => SPEC_OPTIONS[k.slice(4)] || [] };
  return SOURCES[k] || null;
};

let dd = null;      // сам список (один на страницу)
let cur = null;     // поле, для которого он открыт
let items = [];     // показанные варианты
let active = -1;    // выделенный стрелками

function match(all, q, limit) {
  const n = norm(q);
  if (!n) return all.slice(0, limit || 80);
  const starts = [], inside = [];
  all.forEach((c) => {
    const s = norm(c);
    if (s.startsWith(n) || s.split(/[\s\-()]/).some((w) => w.startsWith(n))) starts.push(c);
    else if (s.includes(n)) inside.push(c);
  });
  return starts.concat(inside).slice(0, 80);
}

function place() {
  if (!cur || !dd) return;
  const r = cur.getBoundingClientRect();
  const vv = window.visualViewport;
  const viewH = vv ? vv.height + vv.offsetTop : window.innerHeight; // учитываем экранную клавиатуру телефона
  const below = viewH - r.bottom - 8, above = r.top - 8;
  const up = below < 160 && above > below;
  const room = Math.max(120, Math.min(300, up ? above : below));
  const vw = document.documentElement.clientWidth;
  const w = Math.min(Math.max(r.width, 200), vw - 16);
  dd.style.width = w + 'px';
  dd.style.left = Math.max(8, Math.min(r.left, vw - 8 - w)) + 'px'; // не вылезать за правый край экрана
  dd.style.maxHeight = room + 'px';
  dd.style.top = up ? '' : (r.bottom + 4) + 'px';
  dd.style.bottom = up ? (window.innerHeight - r.top + 4) + 'px' : '';
}

const escHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// showAll — при открытии поля, где уже выбрано значение из списка, показываем весь список, а не только совпадения
function render(showAll) {
  const src = sourceOf(cur);
  const all = src ? (src.get(cur) || []).map(String) : [];
  if (!all.length) return hide();
  const exact = all.some((c) => norm(c) === norm(cur.value));
  items = match(all, showAll && exact ? '' : cur.value, src.limit);
  active = -1;
  const typed = cur.value.trim();
  if (!items.length) {
    // ничего не нашлось — подсказка, что своё значение можно оставить
    if (!typed) return hide();
    dd.innerHTML = `<div class="city-hint">Нет в списке — оставьте «${escHtml(typed)}» как ввели</div>`;
  } else {
    dd.innerHTML = items.map((c, i) => `<button type="button" class="city-opt ${norm(c) === norm(typed) ? 'on' : ''}" data-i="${i}" tabindex="-1">${escHtml(c)}</button>`).join('');
  }
  dd.hidden = false;
  cur.setAttribute('aria-expanded', 'true');
  place();
}

function hide() {
  if (dd) { dd.hidden = true; dd.innerHTML = ''; }
  if (cur) cur.setAttribute('aria-expanded', 'false');
  items = []; active = -1;
}

function pick(i) {
  if (!cur || !items[i]) return;
  cur.value = items[i];
  cur.dispatchEvent(new Event('input', { bubbles: true }));
  cur.dispatchEvent(new Event('change', { bubbles: true }));
  cur.dispatchEvent(new CustomEvent('dd-pick', { bubbles: true, detail: items[i] }));
  hide();
}

function highlight(i) {
  const opts = dd.querySelectorAll('.city-opt');
  if (!opts.length) return;
  active = (i + opts.length) % opts.length;
  opts.forEach((o, k) => o.classList.toggle('on', k === active));
  opts[active].scrollIntoView({ block: 'nearest' });
}

function prep(inp) {
  if (inp.dataset.cityDd) return;
  inp.dataset.cityDd = '1';
  inp.setAttribute('autocomplete', 'off'); // подсказки браузера не перекрывают список
  inp.setAttribute('role', 'combobox');
  inp.setAttribute('aria-autocomplete', 'list');
  inp.setAttribute('aria-expanded', 'false');
}

// Подключает списки ко всем подходящим полям, в том числе появившимся позже (страницы, окна).
export function initCityList() {
  dd = document.createElement('div');
  dd.className = 'city-dd';
  dd.setAttribute('role', 'listbox');
  dd.hidden = true;
  document.body.appendChild(dd);

  // pointerdown + preventDefault — поле не теряет фокус, клавиатура на телефоне не прыгает
  dd.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.city-opt');
    e.preventDefault();
    if (b) pick(Number(b.dataset.i));
  });

  document.addEventListener('focusin', (e) => {
    if (!e.target.matches?.(SEL)) return;
    cur = e.target; prep(cur); render(true);
  });
  // повторное нажатие на поле в фокусе (телефон) — снова открыть список
  document.addEventListener('click', (e) => { if (e.target === cur && dd.hidden) render(true); });
  document.addEventListener('input', (e) => { if (e.target === cur) render(false); });
  document.addEventListener('focusout', (e) => { if (e.target === cur) setTimeout(() => { if (document.activeElement !== cur) hide(); }, 120); });
  document.addEventListener('keydown', (e) => {
    if (e.target !== cur || dd.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); highlight(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); highlight(active - 1); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(active); }
    else if (e.key === 'Escape') hide();
  });
  const re = () => { if (!dd.hidden) place(); };
  window.addEventListener('scroll', re, true);
  window.addEventListener('resize', re);
  window.visualViewport?.addEventListener('resize', re);
  window.visualViewport?.addEventListener('scroll', re);
  window.addEventListener('hashchange', hide);
  document.querySelectorAll(SEL).forEach(prep);
}
