// Выпадающий список городов для всех полей «Город» (input[name=city]).
// Свой список (не <datalist>): одинаково работает на телефоне (iPhone, Android) и на компьютере.
// При вводе показывает подходящие города; любой другой город или посёлок можно ввести вручную.
// Порядок — примерно по численности населения (крупные сверху).
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

const MAX = 8;
const norm = (s) => s.toLowerCase().replace(/ё/g, 'е').trim();
const NORM = CITIES.map(norm);
const SEL = 'input[name="city"]';

let dd = null;      // сам список (один на страницу)
let cur = null;     // поле, для которого он открыт
let items = [];     // показанные города
let active = -1;    // выделенный стрелками

function match(q) {
  const n = norm(q);
  if (!n) return CITIES.slice(0, MAX);
  const starts = [], inside = [];
  NORM.forEach((c, i) => {
    if (c.startsWith(n) || c.split(/[\s-]/).some((w) => w.startsWith(n))) starts.push(CITIES[i]);
    else if (c.includes(n)) inside.push(CITIES[i]);
  });
  return starts.concat(inside).filter((c) => norm(c) !== n).slice(0, MAX);
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

function render() {
  items = match(cur.value);
  if (!items.length) return hide();
  active = -1;
  dd.innerHTML = items.map((c, i) => `<button type="button" class="city-opt" data-i="${i}" tabindex="-1">${c}</button>`).join('');
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

// Подключает список ко всем полям «Город», в том числе появившимся позже (страницы, окна).
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
    cur = e.target; prep(cur); render();
  });
  document.addEventListener('input', (e) => { if (e.target === cur) render(); });
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
