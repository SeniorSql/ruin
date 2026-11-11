// Путевые листы и справка по сделке (11.11.2026). Графы — по бланкам постановления Госкомстата РФ от 28.11.1997 № 78
// (Excel-бланки audit-it.ru): ЭСМ-2, ЭСМ-7, № 3 спец., № 4-П. Унифицированные формы с 2013 г. не обязательны;
// к путевым листам добавлен блок обязательных сведений по приказу Минтранса России от 28.09.2022 № 390.
// Данные берутся из сделки, «Моего парка» (рег. номер, машинист — видит исполнитель), актов передачи и записей смен.
// Недостающее дописывается в форме над документом (хранится только в этом браузере). Скачивание: PDF и Word.
import { esc, money, toast } from './ui.js';
import { toHtml, buildDocx } from './contract.js';

export const FORMS = {
  ESM2: 'ЭСМ-2 — путевой лист строительной машины',
  SPEC3: '№ 3 спец. — путевой лист специального автомобиля',
  P4: '№ 4-П — путевой лист грузового автомобиля (повременный)',
  ESM7: 'ЭСМ-7 — справка для расчетов за выполненные работы (услуги)'
};
// Форма по умолчанию по категории техники
const SPEC_CATS = ['truck_cranes', 'aerial_platforms', 'manipulators', 'concrete'];
export const defaultForm = (cat) => (cat === 'dump_trucks' ? 'P4' : SPEC_CATS.includes(cat) ? 'SPEC3' : 'ESM2');

const L = (s, n = 14) => (s && String(s).trim() ? String(s).trim() : '_'.repeat(n));
// ДД.ММ.ГГГГ из ISO-даты (slice(0, 5) даёт ДД.ММ для граф «Числа месяца»)
const ddmm = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const days = (a, b) => { const r = []; for (let d = new Date(a + 'T00:00:00Z'); d <= new Date(b + 'T00:00:00Z') && r.length < 62; d.setUTCDate(d.getUTCDate() + 1)) r.push(d.toISOString().slice(0, 10)); return r; };
const hrs = (n) => (n ? String(Math.round(n * 100) / 100).replace('.', ',') : '');
const rub = (minor) => (minor ? (minor / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');
const party = (o, c) => [o?.name, o?.city ? 'г. ' + o.city : '', c?.phone].filter(Boolean).join(', ');

function defaults(d, x) {
  const e = d.equipment || {};
  const rate = e.price_minor && e.price_unit === 'HOUR' ? e.price_minor
    : e.price_minor && (e.price_unit === 'SHIFT' || e.price_unit === 'DAY') && e.shift_hours ? Math.round(e.price_minor / e.shift_hours) : 0;
  return {
    form: defaultForm(x.cat), num: d.number || '', series: '', okpoOrg: '', okpoCust: '',
    driver: x.operator?.full_name || '', tab: '', license: x.operator?.license_no || '', licClass: '', snils: '', garage: '',
    reg: x.reg || '', machine: `${e.title || ''}${e.brand ? ` (${e.brand} ${e.model || ''})` : ''}`.trim(),
    site: x.address || '', timeOut: '08:00', timeIn: '17:00', fuel: 'ДТ', workKind: '', soobsh: 'городское',
    rate: rate ? (rate / 100).toFixed(2).replace('.', ',') : '', vat: '', foreman: ''
  };
}

// Блок обязательных сведений по приказу Минтранса № 390 (для путевых листов)
function mintrans(v, d, x, day) {
  const p = d.prov || {};
  return [
    { t: 'h', text: 'Сведения по приказу Минтранса России от 28.09.2022 № 390' },
    { t: 'p', text: `Срок действия путевого листа: ${ddmm(day)}` },
    { t: 'p', text: `Лицо, оформившее путевой лист: ${L(p.name, 20)}, адрес: ${L(p.city ? 'г. ' + p.city : '', 16)}, тел.: ${L(x.provPhone, 12)}, ${p.type === 'SOLE_PROP' ? 'ОГРНИП' : 'ОГРН'}: ${L(p.ogrn, 13)}` },
    { t: 'p', text: `Транспортное средство (тип, марка, модель): ${L(v.machine, 20)}; гос. рег. знак: ${L(v.reg, 10)}` },
    { t: 'p', text: `Предрейсовый (предсменный) контроль техсостояния: дата ${ddmm(day)}, время ${L('', 5)}, «выпуск на линию разрешен» ______________ /${L('', 14)}/` },
    { t: 'p', text: `Выпуск на линию: ${ddmm(day)} ${L(v.timeOut, 5)}, одометр/моточасы ${L('', 8)}; возвращение: ${ddmm(day)} ${L(v.timeIn, 5)}, одометр/моточасы ${L('', 8)} (отметки ставит уполномоченное лицо)` },
    { t: 'p', text: `Водитель (машинист): ${L(v.driver, 24)}; СНИЛС ${L(v.snils, 14)}; удостоверение ${L(v.license, 16)}` },
    { t: 'p', text: `Предрейсовый (предсменный) медосмотр: дата ${ddmm(day)}, время ${L('', 5)}, «прошел предсменный медицинский осмотр, к исполнению трудовых обязанностей допущен» ______________ /${L('', 14)}/` },
    { t: 'p', text: `Послерейсовый медосмотр (если обязателен): дата ${L('', 8)}, время ${L('', 5)}, «прошел послерейсовый медицинский осмотр» ______________` },
    { t: 'p', text: 'Вид перевозки: передвижение и работа специальных транспортных средств (аренда с экипажем — по договору)' },
    { t: 'p', text: `Вид сообщения: ${L(v.soobsh, 12)}` }
  ];
}

function head(title, sub, v, d) {
  return [
    { t: 'right', text: `Типовая межотраслевая форма ${title}\nУтверждена постановлением Госкомстата России от 28.11.97 № 78` },
    { t: 'title', text: sub },
    { t: 'p', text: `Организация: ${L(party(d.prov), 30)}   по ОКПО ${L(v.okpoOrg, 8)}` }
  ];
}

// ---------- ЭСМ-2: один лист на период до 10 дней, строка на каждый день ----------
function esm2(v, d, x) {
  const B = []; const all = days(d.start_date, d.end_date);
  for (let i = 0; i < all.length; i += 10) {
    const part = all.slice(i, i + 10);
    if (B.length) B.push({ t: 'break' });
    B.push(...head('№ ЭСМ-2', `ПУТЕВОЙ ЛИСТ № ${L(v.num, 6)}${all.length > 10 ? '-' + (i / 10 + 1) : ''}\nстроительной машины`, v, d));
    B.push({ t: 'p', text: `Дата составления: ${ddmm(part[0])}` });
    B.push({ t: 'p', text: `Заказчик: ${L(party(d.cust, x.custContact), 30)}   по ОКПО ${L(v.okpoCust, 8)}` });
    B.push({ t: 'p', text: `Машина: ${L(v.machine, 24)}   Государственный номерной знак: ${L(v.reg, 10)}` });
    B.push({ t: 'p', text: `Машинист: ${L(v.driver, 24)}   Табельный номер: ${L(v.tab, 6)}   Период работы: с ${ddmm(part[0])} по ${ddmm(part[part.length - 1])}` });
    B.push({ t: 'table', head: ['Числа месяца', 'Наименование и адрес объекта', 'Подпись диспетчера', 'Выезд из гаража: время, ч. мин.', 'Выезд: показания спидометра, км', 'Машину принял машинист (подпись)', 'Машина технически исправна. Выезд разрешен (подпись механика)', 'Возвращение в гараж: время, ч. мин.', 'Возвращение: показания спидометра, км', 'Машину сдал машинист (подпись)', 'Машину принял механик (подпись)', 'Топливо: вид, марка', 'Наличие при выезде, л', 'Выдано, л', 'Остаток при возвращении, л', 'Подпись заправщика (машиниста)'],
      rows: part.map((day) => [ddmm(day).slice(0, 5), v.site, '', v.timeOut, '', '', '', v.timeIn, '', '', '', v.fuel, day === d.start_date && x.fuelStart != null ? `${x.fuelStart}%` : '', '', day === d.end_date && x.fuelEnd != null ? `${x.fuelEnd}%` : '', '']) });
    B.push({ t: 'p', text: `Ответственный за перемещение груза: у владельца машины ${L('', 16)}; у заказчика ${L('', 16)}. Такелажники (стропальщики): ${L('', 16)}, № удостоверения ${L('', 8)}. Расход топлива: по норме ${L('', 6)}, фактически ${L('', 6)}` });
    // Оборотная сторона
    B.push({ t: 'h', text: 'Оборотная сторона формы № ЭСМ-2 (заполняется заказчиком / владельцем машины)' });
    const rows = part.map((day) => {
      const w = x.work.filter((s) => s.work_date === day);
      const h = w.filter((s) => s.kind === 'WORK').reduce((a, s) => a + Number(s.hours), 0);
      const dt = w.filter((s) => s.kind === 'DOWNTIME');
      const dh = dt.reduce((a, s) => a + Number(s.hours), 0);
      const rate = Math.round(parseFloat(String(v.rate).replace(',', '.')) * 100) || 0;
      return [ddmm(day).slice(0, 5), '', v.site, '', v.workKind, '', hrs(h), h && rate ? rub(h * rate) : '', dt.length ? (DT[dt[0].reason] || '') : '', dt.length ? (dt[0].reason === 'CUSTOMER_FAULT' ? 'заказчик' : dt[0].reason === 'PROVIDER_FAULT' ? 'исполнитель' : '') : '', hrs(dh), '', '', '', '', ''];
    });
    B.push({ t: 'table', head: ['Числа месяца', 'Начало / окончание работы, ч. мин.', 'Объект: наименование и адрес', 'Объект: код', 'Код вида работы', 'Код этапа работы', 'Отработано часов', 'Стоимость работы, руб. коп.', 'Простои: код причины', 'Простои: код виновника', 'Простои: часы', 'Подпись и штамп заказчика', 'Пробег, км', 'Стоянка на линии, ч', 'Прочие: код вида оплаты', 'Прочие: часы'], rows });
    B.push({ t: 'p', text: `Стоимость одного машино-часа, руб. коп.: ${L(v.rate, 8)}` });
    B.push({ t: 'p', text: `Претензии к работе машиниста: ${L('', 40)}` });
    B.push({ t: 'signs', l: `Машинист ________ /${L(v.driver, 14)}/\nПрораб ________ /${L(v.foreman, 14)}/`, r: 'Расчет произвел ________ /______________/\nРуководитель подразделения ________ /______________/' });
    B.push(...mintrans(v, d, x, part[0]));
  }
  return B;
}
const DT = { CUSTOMER_FAULT: 'по вине заказчика', PROVIDER_FAULT: 'по вине исполнителя', WEATHER: 'погода', OTHER: 'другое' };

// ---------- Общие части путевых листов автомобилей (3-спец, 4-П), по листу на день ----------
function autoHead(v, d, day, title, sub) {
  return [
    ...head(title, `ПУТЕВОЙ ЛИСТ ${sub} № ${L(v.num, 6)}-${ddmm(day).slice(0, 5).replace('.', '')}   серия ${L(v.series, 4)}   от ${ddmm(day)}`, v, d),
    { t: 'p', text: `Режим работы: ${L('', 10)}   Колонна: ${L('', 6)}   Бригада: ${L('', 6)}` },
    { t: 'p', text: `Марка автомобиля: ${L(v.machine, 24)}   Гос. номерной знак: ${L(v.reg, 10)}   Гаражный номер: ${L(v.garage, 6)}` },
    { t: 'p', text: `Водитель: ${L(v.driver, 24)}   Табельный номер: ${L(v.tab, 6)}   Удостоверение № ${L(v.license, 12)}   Класс ${L(v.licClass, 4)}` },
    { t: 'p', text: `Прицеп: ${L('', 14)}   Гос. номерной знак: ${L('', 10)}   Гаражный номер: ${L('', 6)}` },
    { t: 'h', text: 'Работа водителя и автомобиля' },
    { t: 'table', head: ['Операция', 'Время по графику, ч. мин.', 'Нулевой пробег, км', 'Показание спидометра, км', 'Время фактическое (число, месяц, ч. мин.)'],
      rows: [['Выезд из гаража', v.timeOut, '', '', `${ddmm(day).slice(0, 5)} ${'_'.repeat(5)}`], ['Возвращение в гараж', v.timeIn, '', '', `${ddmm(day).slice(0, 5)} ${'_'.repeat(5)}`]] },
    { t: 'h', text: 'Движение горючего, л' },
    { t: 'table', head: ['Горючее: марка', 'Код', 'Выдано', 'Остаток при выезде', 'Остаток при возвращении', 'Сдано', 'Коэффициент изменения нормы', 'Время работы спецоборудования, ч. мин.', 'Время работы двигателя, ч. мин.'],
      rows: [[v.fuel, '', '', '', '', '', '', '', '']] },
    { t: 'p', text: 'Подписи: заправщика ________   механика ________   диспетчера ________' }
  ];
}
function autoMarks() {
  return [
    { t: 'p', text: 'Водительское удостоверение проверил, задание выдал, выдать горючего ________ литров. Диспетчер ________ /______________/' },
    { t: 'p', text: 'Водитель по состоянию здоровья к управлению допущен ________ /______________/' },
    { t: 'p', text: 'Автомобиль технически исправен, выезд разрешен. Механик ________ /______________/   Автомобиль принял. Водитель ________ /______________/' },
    { t: 'p', text: 'При возвращении автомобиль исправен / неисправен (ненужное зачеркнуть). Сдал водитель ________   Принял механик ________' },
    { t: 'p', text: `Особые отметки: ${'_'.repeat(40)}` }
  ];
}

function spec3(v, d, x) {
  const B = [];
  for (const day of days(d.start_date, d.end_date)) {
    if (B.length) B.push({ t: 'break' });
    B.push(...autoHead(v, d, day, '№ 3 спец.', 'специального автомобиля'));
    B.push({ t: 'h', text: 'Задание водителю' });
    B.push({ t: 'table', head: ['В чье распоряжение (наименование и адрес заказчика)', 'Время прибытия, ч. мин.', 'Время убытия, ч. мин.', 'Вид работы'],
      rows: [[`${party(d.cust, x.custContact)}; объект: ${v.site}`, v.timeOut, v.timeIn, v.workKind]] });
    B.push(...autoMarks());
    B.push({ t: 'h', text: 'Оборотная сторона формы № 3 спец. — Отметка о выполнении задания (заполняется заказчиком)' });
    B.push({ t: 'table', head: ['Маршрут движения или объект работы', 'Вид работы: наименование', 'Вид работы: код', 'Время прибытия, ч. мин.', 'Время убытия, ч. мин.', 'Спидометр при прибытии', 'Спидометр при убытии', 'Заказчик: должность, подпись, расшифровка, штамп'],
      rows: [[v.site, v.workKind, '', '', '', '', '', '']] });
    B.push({ t: 'h', text: 'Сведения о выполненной работе (заполняется организацией)' });
    const w = x.work.filter((s) => s.work_date === day && s.kind === 'WORK').reduce((a, s) => a + Number(s.hours), 0);
    const rate = Math.round(parseFloat(String(v.rate).replace(',', '.')) * 100) || 0;
    B.push({ t: 'table', head: ['Вид работы: наименование', 'Код', 'Время оплачиваемое, ч. мин.', 'Тариф, руб. коп.', 'Всего к оплате, руб. коп.'], rows: [[v.workKind, '', hrs(w), v.rate, w && rate ? rub(w * rate) : '']] });
    B.push({ t: 'table', head: ['Простои на линии: наименование', 'Код', 'Начало (дата, ч. мин.)', 'Окончание (дата, ч. мин.)', 'Подпись ответственного лица'], rows: [['', '', '', '', '']] });
    B.push({ t: 'table', head: ['Расход горючего по норме, л', 'Расход фактически, л', 'Время в наряде, ч. мин.', 'Пробег всего, км', 'В т.ч. простои по техническим причинам', 'Зарплата: код', 'Зарплата: сумма, руб. коп.'], rows: [['', '', '', '', '', '', '']] });
    B.push({ t: 'p', text: 'Ответственный за безопасное перемещение груза: у владельца автомобиля ______________; у заказчика ______________. Такелажники (стропальщики): ______________, № удостоверения ________' });
    B.push({ t: 'p', text: 'Таксировщик ________ /______________/' });
    B.push(...mintrans(v, d, x, day));
  }
  return B;
}

function p4(v, d, x) {
  const B = [];
  for (const day of days(d.start_date, d.end_date)) {
    if (B.length) B.push({ t: 'break' });
    B.push(...autoHead(v, d, day, '№ 4-П', 'грузового автомобиля'));
    B.push({ t: 'p', text: `Сопровождающие лица: ${'_'.repeat(30)}` });
    B.push({ t: 'h', text: 'Задание водителю' });
    B.push({ t: 'table', head: ['В чье распоряжение (наименование и адрес заказчика)', 'Время прибытия, ч. мин.', 'Время убытия, ч. мин.', 'Количество часов', 'Количество ездок'],
      rows: [[`${party(d.cust, x.custContact)}; объект: ${v.site}`, v.timeOut, v.timeIn, '', '']] });
    B.push(...autoMarks());
    B.push({ t: 'h', text: 'Оборотная сторона формы № 4-П — Выполнение задания (заполняется заказчиком)' });
    B.push({ t: 'p', text: `Заказчик: ${L(d.cust?.name, 24)}   код ${L('', 6)}` });
    B.push({ t: 'p', text: 'При прибытии к заказчику: дата, время ____________, показание спидометра ________; при убытии: дата, время ____________, показание спидометра ________' });
    B.push({ t: 'p', text: `Приложенные ТТД: №№ ____________, количество ____; маршрут движения (откуда — куда): ${L(v.site, 24)}; количество ездок ____; код вида груза ____. Место для штампа заказчика` });
    B.push({ t: 'table', head: ['Простои на линии: причина', 'Код', 'Начало (дата, ч. мин.)', 'Окончание (дата, ч. мин.)', 'Подпись ответственного лица'], rows: [['', '', '', '', '']] });
    B.push({ t: 'table', head: ['Таксировка: горючее, марка', 'Расход по норме, л', 'Расход фактически, л', 'Зарплата: код', 'Зарплата: сумма, руб. коп.'], rows: [[v.fuel, '', '', '', '']] });
    const w = x.work.filter((s) => s.work_date === day && s.kind === 'WORK').reduce((a, s) => a + Number(s.hours), 0);
    B.push({ t: 'table', head: ['Результат по заказчику', 'Время оплачиваемое, ч. мин.', 'Ездки, ед.', 'Экспедитор, да/нет', 'Пробег всего, км', 'Пробег с грузом, км', 'Перепробег, км', 'Тонны, т', 'Т-км', 'Всего к оплате, руб. коп.'],
      rows: [['Выполнено', hrs(w), '', '', '', '', '', '', '', 'Х'], ['Тариф, руб. коп.', v.rate, '', '', '', '', '', '', '', 'Х'], ['К оплате, руб. коп.', '', '', '', '', '', '', '', '', '']] });
    B.push({ t: 'p', text: 'Таксировщик ________ /______________/   Начальник эксплуатации ________ /______________/' });
    B.push(...mintrans(v, d, x, day));
  }
  return B;
}

function esm7(v, d, x) {
  const work = x.work.filter((s) => s.kind === 'WORK').reduce((a, s) => a + Number(s.hours), 0);
  const idle = x.work.filter((s) => s.kind === 'DOWNTIME' && s.reason === 'CUSTOMER_FAULT').reduce((a, s) => a + Number(s.hours), 0);
  const rate = Math.round(parseFloat(String(v.rate).replace(',', '.')) * 100) || 0;
  const sumW = work * rate, sumI = idle * rate, vat = Math.round(parseFloat(String(v.vat).replace(',', '.')) * 100) || 0;
  return [
    ...head('№ ЭСМ-7', `СПРАВКА № ${L(v.num, 6)}\nдля расчетов за выполненные работы (услуги)`, v, d),
    { t: 'p', text: `Дата составления: ${ddmm(new Date().toISOString())}` },
    { t: 'p', text: `Заказчик: ${L(party(d.cust, x.custContact), 30)}   по ОКПО ${L(v.okpoCust, 8)}` },
    { t: 'p', text: `Объект: ${L(v.site, 30)}   Период работы: с ${ddmm(d.start_date)} по ${ddmm(d.end_date)}` },
    { t: 'p', text: `Машина: ${L(v.machine, 24)}   Государственный номерной знак: ${L(v.reg, 10)}` },
    { t: 'p', text: `Машинисты: ${L(v.driver, 30)}` },
    { t: 'table', head: ['Вид работы: наименование', 'Код', 'Отработано машино-часов', 'Стоимость одного машино-часа, руб. коп.', 'Стоимость работы, руб. коп.'],
      rows: [[v.workKind || (d.with_operator ? 'Услуги техники с экипажем' : 'Предоставление техники'), '', hrs(work), v.rate, sumW ? rub(sumW) : ''],
        ['Итого', 'Х', hrs(work), 'Х', sumW ? rub(sumW) : ''],
        ['Простои по вине заказчика', '', hrs(idle), v.rate, sumI ? rub(sumI) : ''],
        ['Всего', 'Х', hrs(work + idle), 'Х', sumW + sumI ? rub(sumW + sumI) : ''],
        ['Сумма НДС', '', '', '', vat ? rub(vat) : ''],
        ['Всего с учетом НДС', '', '', '', sumW + sumI ? rub(sumW + sumI + vat) : '']] },
    { t: 'p', text: `Отработано машино-часов (прописью): ${'_'.repeat(40)}` },
    { t: 'signs', l: 'Заказчик\n________ ________ /______________/\n(должность) (подпись) (расшифровка)', r: 'Исполнитель\n________ ________ /______________/\n(должность) (подпись) (расшифровка)\nМ.П.' },
    { t: 'p', text: `Справочно: стоимость по сделке ${d.number || ''} на платформе RUIN — ${money(d.total_minor)}.` }
  ];
}

const BUILD = { ESM2: esm2, SPEC3: spec3, P4: p4, ESM7: esm7 };

export function renderWaybill(app, d, x) {
  const KEY = 'ruin-waybill:' + d.id;
  const base = defaults(d, x);
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { saved = {}; }
  const v = { ...base, ...saved };
  const F = [['num', 'Номер'], ['series', 'Серия (для 3 спец. / 4-П)'], ['machine', 'Машина (наименование, марка)'], ['reg', 'Гос. номерной знак'],
    ['driver', 'Машинист / водитель (ФИО)'], ['tab', 'Табельный номер'], ['license', 'Удостоверение (серия, №, дата)'], ['licClass', 'Класс / категория'], ['snils', 'СНИЛС водителя'],
    ['garage', 'Гаражный номер'], ['site', 'Объект (наименование, адрес)'], ['workKind', 'Вид работы'], ['timeOut', 'Выезд, ч. мин.'], ['timeIn', 'Возвращение, ч. мин.'],
    ['fuel', 'Топливо (вид, марка)'], ['rate', 'Стоимость машино-часа, руб.'], ['vat', 'Сумма НДС, руб. (для ЭСМ-7)'], ['okpoOrg', 'ОКПО исполнителя'], ['okpoCust', 'ОКПО заказчика'], ['foreman', 'Прораб (ФИО)']];
  const grid = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0 12px';
  document.body.classList.add('doc-mode');
  app.innerHTML = `<div class="doc-bar" style="display:block">
      <div class="actions"><button class="btn" data-print>Скачать PDF / печать</button><button class="btn ghost" id="docx">Скачать Word (.docx)</button>
        <a class="btn ghost" href="#/deals/${d.id}">← К сделке</a></div>
      <details class="panel" style="margin-top:10px" open><summary><b>Путевой лист / справка</b> <span class="small muted">— данные сделки подставлены. Пустые поля останутся линией. Введённое сохраняется только в этом браузере.</span></summary>
        <label class="f" style="margin-top:10px"><span>Форма</span><select class="inp" data-k="form">${Object.entries(FORMS).map(([k, t]) => `<option value="${k}" ${v.form === k ? 'selected' : ''}>${esc(t)}${k === base.form ? ' — рекомендуется для этой техники' : ''}</option>`).join('')}</select></label>
        <p class="small muted" style="margin:4px 0 8px">ЭСМ-2 — лист на период до 10 дней (строка на каждый день); 3 спец. и 4-П — лист на каждый день сделки; ЭСМ-7 — одна справка на сделку. Отработанные часы и простои берутся из записей смен в сделке.</p>
        <div style="${grid}">${F.map(([k, l]) => `<label class="f"><span>${esc(l)}</span><input class="inp" data-k="${k}" value="${esc(v[k] || '')}" maxlength="200"></label>`).join('')}
          <label class="f"><span>Вид сообщения</span><select class="inp" data-k="soobsh">${['городское', 'пригородное', 'междугородное'].map((o) => `<option ${v.soobsh === o ? 'selected' : ''}>${o}</option>`).join('')}</select></label></div>
        <div class="actions" style="margin-top:8px"><button class="btn ghost sm" id="reset">Вернуть данные из сделки</button></div>
      </details></div>
    <article class="doc" id="wbDoc"></article>
    <p class="small muted" style="text-align:center">Сформировано на платформе RUIN по данным сделки ${esc(d.number || '')}. Унифицированные формы Госкомстата № 78 с 2013 г. не обязательны; блок по приказу Минтранса № 390 добавлен к путевым листам.</p>`;
  const docEl = app.querySelector('#wbDoc');
  const model = () => (BUILD[v.form] || esm2)(v, d, x);
  const draw = () => { docEl.innerHTML = toHtml(model()); };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* приватный режим */ } };
  app.querySelectorAll('[data-k]').forEach((el) => el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => { v[el.dataset.k] = el.value; draw(); save(); }));
  app.querySelector('#reset').onclick = () => { try { localStorage.removeItem(KEY); } catch { /* нет доступа */ } renderWaybill(app, d, x); };
  app.querySelector('#docx').onclick = () => {
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(buildDocx(model()));
      a.download = `${v.form === 'ESM7' ? 'Справка_ЭСМ-7' : 'Путевой_лист_' + ({ ESM2: 'ЭСМ-2', SPEC3: '3-спец', P4: '4-П' }[v.form] || '')}_${(d.number || 'RUIN').replace(/[^\wА-Яа-яЁё-]+/g, '_')}.docx`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (e) { toast('Не удалось сформировать файл: ' + e.message, true); }
  };
  draw();
  return () => document.body.classList.remove('doc-mode');
}
