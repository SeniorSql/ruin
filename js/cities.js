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

let pickedAt = 0;    // время выбора: гасим «досланное» телефоном нажатие и не открываем список заново
const touch = () => window.matchMedia?.('(pointer: coarse)').matches;

function pick(i) {
  if (!cur || !items[i]) return;
  const inp = cur;
  pickedAt = Date.now();
  inp.value = items[i];
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  inp.dispatchEvent(new Event('change', { bubbles: true }));
  inp.dispatchEvent(new CustomEvent('dd-pick', { bubbles: true, detail: items[i] }));
  hide();
  // Телефон: после выбора поле «сворачивается» — снимаем фокус, экранная клавиатура закрывается (20.11.2026)
  if (touch()) inp.blur();
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

// ---------- Телефон: окно выбора снизу экрана (20.11.2026) ----------
// Всплывающий список под полем на телефоне мешал: касание для прокрутки сразу выбирало пункт, список уходил под клавиатуру.
// Поэтому на сенсорном экране поле открывает окно: поиск сверху, крупные пункты, выбор обычным нажатием (прокрутка не выбирает),
// «Оставить как ввели» — для своего значения. Если для поля нет списка (например, районы неизвестного города) — обычный ввод.
let sheet = null;
const labelOf = (inp) => (inp.closest('label')?.querySelector('span')?.textContent || inp.getAttribute('aria-label') || inp.placeholder || 'Выберите').replace(/\*/g, '').trim();

function closeSheet() { if (sheet) { sheet.remove(); sheet = null; document.body.classList.remove('dd-sheet-open'); } }

// Окно занимает только видимую часть экрана: когда открыта клавиатура, оно стоит над ней, а не под ней (21.11.2026)
function fitSheet() {
  if (!sheet) return;
  const vv = window.visualViewport;
  sheet.style.top = (vv ? vv.offsetTop : 0) + 'px';
  sheet.style.height = (vv ? vv.height : window.innerHeight) + 'px';
}

// Чем коснулись в последний раз: палец/стилус — окно выбора, мышь — обычный список под полем
let lastPtr = '', lastPtrAt = 0;
const fingerNow = () => (Date.now() - lastPtrAt < 1500 ? lastPtr !== 'mouse' : touch());

function applyValue(inp, v) {
  inp.value = v;
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  inp.dispatchEvent(new Event('change', { bubbles: true }));
  inp.dispatchEvent(new CustomEvent('dd-pick', { bubbles: true, detail: v }));
}

function openSheet(inp) {
  const src = sourceOf(inp);
  const all = src ? (src.get(inp) || []).map(String) : [];
  if (!all.length) return false;
  closeSheet(); hide();
  sheet = document.createElement('div');
  sheet.className = 'dd-sheet-bg';
  sheet.innerHTML = `<div class="dd-sheet" role="dialog" aria-modal="true" aria-label="${escHtml(labelOf(inp))}">
    <div class="dd-sh-head"><b>${escHtml(labelOf(inp))}</b><button type="button" class="dd-sh-x">Закрыть</button></div>
    <input class="inp dd-sh-q" type="search" placeholder="Поиск или свой вариант" autocomplete="off" enterkeyhint="done">
    <div class="dd-sh-list" role="listbox"></div></div>`;
  document.body.appendChild(sheet);
  document.body.classList.add('dd-sheet-open');
  fitSheet();
  const q = sheet.querySelector('.dd-sh-q'), list = sheet.querySelector('.dd-sh-list');
  const curVal = inp.value.trim();
  const draw = () => {
    const typed = q.value.trim();
    const items = match(all, typed, 200);
    const custom = typed && !all.some((c) => norm(c) === norm(typed));
    list.innerHTML = (custom ? `<button type="button" class="dd-sh-opt dd-sh-custom" data-v="${escHtml(typed)}">Оставить «${escHtml(typed)}»</button>` : '')
      + items.map((c) => `<button type="button" class="dd-sh-opt ${norm(c) === norm(curVal) ? 'on' : ''}" data-v="${escHtml(c)}">${escHtml(c)}</button>`).join('')
      + (!items.length && !custom ? '<div class="city-hint">Ничего не нашлось</div>' : '');
  };
  draw();
  q.addEventListener('input', draw);
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (q.value.trim()) { applyValue(inp, q.value.trim()); closeSheet(); } } });
  list.addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    applyValue(inp, b.dataset.v); closeSheet();
  });
  sheet.querySelector('.dd-sh-x').onclick = closeSheet;
  sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });
  // уже выбранное значение — в зоне видимости
  list.querySelector('.on')?.scrollIntoView({ block: 'center' });
  return true;
}

// Подключает списки ко всем подходящим полям, в том числе появившимся позже (страницы, окна).
export function initCityList() {
  // Телефон: окно выбора открывается только по НАЖАТИЮ на поле (фокус), а не в момент касания —
  // иначе прокрутка страницы, начатая пальцем на поле, открывала список (21.11.2026).
  // При касании только запоминаем, чем коснулись, и выключаем экранную клавиатуру у поля, если для него есть список.
  document.addEventListener('pointerdown', (e) => {
    lastPtr = e.pointerType || ''; lastPtrAt = Date.now();
    const inp = e.target.closest?.(SEL);
    if (!inp) return;
    if (e.pointerType === 'mouse') { inp.inputMode = ''; return; }
    prep(inp);
    const src = sourceOf(inp);
    inp.inputMode = src && (src.get(inp) || []).length ? 'none' : '';
  }, true);
  window.addEventListener('hashchange', closeSheet);
  window.visualViewport?.addEventListener('resize', fitSheet);
  window.visualViewport?.addEventListener('scroll', fitSheet);
  window.addEventListener('resize', fitSheet);
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
    // палец/стилус (или телефон без касания, например «Далее» на клавиатуре) — окно выбора; поле в фокусе не остаётся
    if (fingerNow() && !e.target.disabled && !e.target.readOnly && openSheet(e.target)) { e.target.blur(); return; }
    cur = e.target; prep(cur); render(true);
  });
  // Телефон после касания досылает click в ту же точку — он попал бы в элемент под закрытым списком. Гасим его.
  document.addEventListener('click', (e) => {
    if (Date.now() - pickedAt < 450) { e.preventDefault(); e.stopPropagation(); pickedAt = 0; }
  }, true);
  // повторное нажатие на поле в фокусе (телефон) — снова открыть список
  document.addEventListener('click', (e) => { if (e.target === cur && dd.hidden) render(true); });
  document.addEventListener('input', (e) => { if (e.target === cur && Date.now() - pickedAt > 50) render(false); });
  document.addEventListener('focusin', (e) => { if (Date.now() - pickedAt < 450 && e.target !== cur && e.target.matches?.('input,select,textarea')) e.target.blur(); });
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
