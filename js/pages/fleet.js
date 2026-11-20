// Мой парк: список техники, мастер карточки, фото, календарь и блокировки (SCR-CAT-06/07/08)
import { sb, state, q, rpc, loadCategories, categoryById, uploadPhoto, canManage, actsAsProvider, calStale, refreshCounters } from '../api.js';
import { esc, money, priceText, photoOf, status, toast, busy, confirmBox, emptyState, errorState, SPEC_LABELS, CATEGORY_SPECS,
  toMinor, fromMinor, mskToday, date, statusLabel, POLICY, POLICY_CHOICES, policyChoice } from '../ui.js';
import { go, route, refreshShell } from '../app.js';
import { brandsFor, modelsFor, specsFor, SPEC_OPTIONS } from '../catalog-data.js';
import { registerSource } from '../cities.js';

const SINGULAR = {
  excavators: 'Экскаватор', mini_excavators: 'Мини-экскаватор', backhoe_loaders: 'Экскаватор-погрузчик', wheel_loaders: 'Фронтальный погрузчик',
  mini_loaders: 'Мини-погрузчик', telehandlers: 'Телескопический погрузчик', bulldozers: 'Бульдозер', graders: 'Автогрейдер',
  rollers: 'Каток', pavers: 'Асфальтоукладчик', truck_cranes: 'Автокран', aerial_platforms: 'Автовышка', dump_trucks: 'Самосвал',
  manipulators: 'Манипулятор', drilling_rigs: 'Буровая установка', concrete: 'Бетононасос', other: ''
};
const TEXT_SPECS = new Set(['undercarriage', 'roller_type', 'chassis', 'axle_formula', 'drill_type', 'description_specs']);
// Сравнение без учёта регистра в ilike: % и _ в марке/модели — обычные символы
const likeExact = (s) => String(s || '').replace(/[\\%_]/g, (c) => '\\' + c);
const YEAR_MAX = new Date().getFullYear() + 1;

export async function render(app, params, query, pattern) {
  const o = state.org;
  // Смотреть свою технику можно, если она есть, даже когда галочку «Исполнитель» сняли; добавлять новую — только исполнителю
  if (!(pattern === 'fleet/new' ? o.can_provide : actsAsProvider(o))) {
    app.innerHTML = emptyState('Текущая организация не исполнитель',
      'Чтобы сдавать технику, создайте организацию исполнителя (ИП, юрлицо или самозанятый) или переключитесь на неё в меню под вашим именем (справа вверху).',
      '<a class="btn" href="#/account?become=provider">Стать исполнителем</a>');
    return;
  }
  await loadCategories();
  if (pattern === 'fleet') return list(app, o);
  return editor(app, o, pattern === 'fleet/new' ? null : params.id, query || {});
}

async function list(app, o) {
  let rows;
  // Группы (SQL 37, 20.11.2026): одна строка на группу — ведущая карточка, рядом «× N шт.»; машины группы — внутри карточки
  try { rows = await q(sb.from('equipment').select('*, categories(name)').eq('org_id', o.id).eq('listed', true).neq('status', 'ARCHIVED').order('created_at', { ascending: false })); }
  catch (err) { app.innerHTML = errorState(err); return; }
  app.innerHTML = `
    <div class="page-head"><div><h1>Моя техника</h1><p>${esc(o.name)}</p></div>
      ${canManage() && o.can_provide ? '<a class="btn" href="#/fleet/new">+ Добавить технику</a>' : ''}</div>
    ${!o.can_provide ? '<div class="banner warn">Роль исполнителя выключена — техника скрыта из каталога, её нельзя забронировать. Чтобы вернуть её в каталог, в <a href="#/account">Профиле и организациях</a> нажмите «Изменить» и поставьте галочку «Исполнитель».</div>' : ''}
    ${o.verification_status !== 'VERIFIED' ? `<div class="banner warn">Организация ${statusLabel('org', o.verification_status).toLowerCase()}. Карточки можно заполнять, а публиковать — после проверки. <a href="#/account">Подробнее</a></div>` : ''}
    ${rows.length ? `<div class="panel">${rows.map((e) => {
      const p = photoOf(e);
      // Календарь давно не подтверждали — строка подсвечена и ведёт сразу к шагу «6. Календарь» (v=78)
      const stale = calStale(e);
      return `<a class="row-item ${stale ? 'row-attn' : ''}" href="#/fleet/${e.id}${stale ? '?go=s6' : ''}">${p ? `<img src="${esc(p.url)}" alt="" referrerpolicy="no-referrer">` : '<img alt="">'}
        <div class="grow"><b>${esc(e.title)}</b>${e.group_size > 1 ? ` <span class="st qty">× ${e.group_size} шт.</span>` : ''}<div class="small muted">${esc(e.categories?.name)} · ${esc(e.city)} · <span class="num">${priceText(e)}</span>${e.group_size > 1 ? ' за каждую' : ''}</div>
        ${stale ? '<div class="small warn-text"><span class="attn-link">Подтвердите календарь →</span> иначе в каталоге появится «Доступность уточняется»</div>' : ''}
        ${e.moderation_comment && e.status === 'REJECTED' ? `<div class="small" style="color:var(--red)">Модератор: ${esc(e.moderation_comment)}</div>` : ''}</div>
        ${status('equipment', e.status)}</a>`;
    }).join('')}</div>`
    : emptyState('Пока нет техники', 'Добавьте первую единицу — заказчики увидят её в каталоге после модерации.', canManage() && o.can_provide ? '<a class="btn" href="#/fleet/new">Добавить технику</a>' : '')}`;
}

async function editor(app, o, id, query = {}) {
  let e = { category_id: '', brand: '', model: '', year: '', title: '', description: '', city: o.city || '', district: '', service_radius_km: 50,
    with_operator: true, without_operator: false, price_unit: 'SHIFT', price_minor: null, shift_hours: 8, min_units: 1, operator_minor: 0,
    delivery_minor: 0, deposit_minor: 0, cancel_policy: 'FLEXIBLE', instant_book: false, specs: {}, photos: [], status: 'DRAFT' };
  if (id) {
    const row = await q(sb.from('equipment').select('*').eq('id', id).eq('org_id', o.id).maybeSingle());
    if (!row) { app.innerHTML = emptyState('Карточка не найдена', 'Возможно, она принадлежит другой организации. Переключите организацию в меню под вашим именем (справа вверху).'); return; }
    // Машина из группы открывается в карточке группы, её календарь — выбран внизу
    if (row.group_id && row.group_id !== row.id && row.status !== 'ARCHIVED') { go(`#/fleet/${row.group_id}?unit=${row.id}${query.go ? '&go=' + query.go : ''}`); return; }
    e = row;
  }
  let photos = (e.photos || []).map((p) => (typeof p === 'string' ? { url: p } : p));
  const cats = state.categories;
  const editable = canManage();
  // Машины карточки (SQL 37): первая — сама карточка. Госномер и год обязательны у каждой (решение Этибара 20.11.2026)
  let units = [{ id: null, reg: '', year: '' }];
  if (id) {
    const gu = await rpc('group_units', { p_eq: id }).catch(() => []);
    units = gu.length ? gu.map((u) => ({ id: u.id, reg: u.reg_number || '', year: u.year ?? '', busy: u.busy_now, status: u.status }))
      : [{ id, reg: '', year: e.year ?? '' }];
  }
  const groupSize = () => units.length;
  // Другие такие же одиночные карточки — предложим объединить в группу
  let twins = [];
  if (id && editable && e.status !== 'ARCHIVED') {
    twins = await q(sb.from('equipment').select('id,title,status').eq('org_id', o.id).eq('listed', true).eq('group_size', 1)
      .neq('status', 'ARCHIVED').neq('id', id).eq('category_id', e.category_id).ilike('brand', likeExact(e.brand)).ilike('model', likeExact(e.model))).catch(() => []);
  }

  app.innerHTML = `
    <div class="crumbs"><a href="#/fleet">Моя техника</a> › <b>${id ? esc(e.title) : 'Новая карточка'}</b></div>
    <div class="page-head"><div><h1>${id ? esc(e.title) : 'Новая техника'}</h1>${id ? `<div style="margin-top:6px">${status('equipment', e.status)}</div>` : ''}</div>
      ${id && e.status === 'PUBLISHED' ? `<a class="btn ghost" href="#/item/${id}">Открыть в каталоге</a>` : ''}</div>
    ${e.moderation_comment && ['REJECTED', 'HIDDEN'].includes(e.status) ? `<div class="banner err">Комментарий модератора: ${esc(e.moderation_comment)}</div>` : ''}
    ${e.status === 'PENDING_MODERATION' ? '<div class="banner info">Карточка на модерации — обычно это занимает до 1 рабочего дня. Мы пришлём уведомление.</div>' : ''}
    ${groupSize() > 1 ? `<div class="banner info">Группа из ${groupSize()} одинаковых машин. В каталоге — одна карточка «${groupSize()} шт.». Описание, фото, цены и условия общие: изменения применяются ко всем машинам. Госномер, год и календарь — у каждой машины свои.</div>` : ''}
    ${twins.length ? `<div class="banner warn" style="display:block">У вас есть ещё ${twins.length} ${twins.length === 1 ? 'такая же карточка' : 'таких же карточки'} (${esc(e.brand)} ${esc(e.model)}): ${twins.map((x) => `<a href="#/fleet/${x.id}">${esc(x.title)}</a>`).join(', ')}.
      Объедините их с этой — в каталоге будет одна карточка «${groupSize() + twins.length} шт.».
      <div class="actions" style="margin-top:8px"><button type="button" class="btn sm" id="mergeBtn">Объединить в группу</button></div></div>` : ''}
    <div class="steps" id="steps">${[['s1', '1. Основное'], ['s2', '2. Характеристики'], ['s3', '3. Фото'], ['s4', '4. Место'], ['s5', '5. Цены и условия'], ...(id ? [['s6', '6. Календарь']] : [])]
      .map(([k, t]) => `<button type="button" data-go="${k}"><i></i>${t}</button>`).join('')}
      <span class="steps-legend small muted"><i class="ok"></i>заполнено <i class="todo"></i>нужно заполнить <i></i>необязательно</span></div>
    <form id="ef">
      <fieldset ${editable ? '' : 'disabled'} style="border:0;padding:0;margin:0">
      <div class="panel" id="s1"><h2>1. Основное</h2>
        <label class="f"><span>Категория <i>*</i></span><select class="inp" name="category_id" required><option value="">Выберите</option>
          ${cats.map((c) => `<option value="${c.id}" ${c.id === e.category_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
        <div class="grid2">
          <label class="f"><span>Марка <i>*</i></span><input class="inp" name="brand" data-dd="brand" required value="${esc(e.brand)}" maxlength="60" placeholder="Выберите или впишите">
            <div class="hint">Список — по выбранной категории. Нет нужной марки — впишите.</div></label>
          <label class="f"><span>Модель <i>*</i></span><input class="inp" name="model" data-dd="model" required value="${esc(e.model)}" maxlength="60" placeholder="Выберите или впишите">
            <div class="hint">Выберите модель — характеристики подставятся сами.</div></label>
        </div>
        <div class="units-box" id="unitsBox">
          <div class="units-head"><b>Сколько у вас таких машин</b>
            <input class="inp" type="number" id="uqty" min="1" max="100" value="${units.length}" aria-label="Количество одинаковых машин">
            <span class="hint" style="flex-basis:100%;margin:0">Одинаковые машины заводятся одной карточкой: описание, фото и цены — общие. Госномер и год выпуска — у каждой машины, они обязательны. Госномер заказчик увидит только после подтверждения сделки.</span></div>
          <div class="unit-labels"><span></span><span>Госномер <i style="color:var(--red);font-style:normal">*</i></span><span>Год выпуска <i style="color:var(--red);font-style:normal">*</i></span><span></span></div>
          <div id="units"></div>
          ${editable ? '<button type="button" class="btn ghost sm" id="uadd" style="margin-top:8px">+ Ещё одна такая же машина</button>' : ''}
        </div>
        <label class="f"><span>Название карточки <i>*</i></span><input class="inp" name="title" required maxlength="120" value="${esc(e.title)}">
          <div class="hint">Подставляется автоматически, можно изменить. Например: «Автокран КС-55713 · 25 тонн».</div></label>
        <label class="f"><span>Описание</span><textarea class="inp" name="description" maxlength="3000" rows="5">${esc(e.description || '')}</textarea>
          <div class="hint">Без телефонов, почты и ссылок — контакты откроются после подтверждения сделки.</div></label>
      </div>
      <div class="panel" id="s2"><h2>2. Характеристики</h2><div class="spec-auto hidden" id="specAuto"></div><div class="grid3" id="specs"></div></div>
      <div class="panel" id="s3"><h2>3. Фото</h2>
        <p class="muted small" style="margin-top:-6px">Минимум 3 фото: общий вид, рабочий орган, кабина или табличка. JPEG/PNG/WebP до 10 МБ. Первое фото — главное.</p>
        <div class="photo-grid" id="photos"></div>
        <input type="file" id="file" accept="image/jpeg,image/png,image/webp" multiple class="hidden">
      </div>
      <div class="panel" id="s4"><h2>4. Место и зона работы</h2>
        <div class="grid3">
          <label class="f"><span>Город базирования <i>*</i></span><input class="inp" name="city" required value="${esc(e.city)}"></label>
          <label class="f"><span>Район</span><input class="inp" name="district" data-dd="district" value="${esc(e.district || '')}"></label>
          <label class="f"><span>Выезд, км</span><input class="inp" name="service_radius_km" type="number" min="0" max="2000" value="${e.service_radius_km}"></label>
        </div>
      </div>
      <div class="panel" id="s5"><h2>5. Цены и условия</h2>
        <span style="display:block;font-size:13px;font-weight:700;margin-bottom:6px">Формат аренды <i style="color:var(--red);font-style:normal">*</i></span>
        <label class="check"><input type="checkbox" name="with_operator" ${e.with_operator ? 'checked' : ''}> <span>С оператором (услуги спецтехники)</span></label>
        <label class="check"><input type="checkbox" name="without_operator" ${e.without_operator ? 'checked' : ''}> <span>Без оператора (аренда)</span></label>
        <div class="grid3">
          <label class="f"><span>Единица цены</span><select class="inp" name="price_unit">
            <option value="SHIFT" ${e.price_unit === 'SHIFT' ? 'selected' : ''}>За смену</option><option value="HOUR" ${e.price_unit === 'HOUR' ? 'selected' : ''}>За час</option>
            <option value="DAY" ${e.price_unit === 'DAY' ? 'selected' : ''}>За сутки</option></select></label>
          <label class="f"><span>Ставка, ₽ <i style="color:var(--red);font-style:normal">*</i></span><input class="inp" name="price" type="number" min="1" step="1" max="1000000000" required value="${fromMinor(e.price_minor)}">
            ${e.price_unit === 'NEGOTIABLE' ? '<div class="hint">Раньше была «Договорная» — укажите ставку, без неё карточку не сохранить</div>' : ''}</label>
          <label class="f"><span>Часов в смене</span><input class="inp" name="shift_hours" type="number" min="1" max="24" value="${e.shift_hours}"></label>
          <label class="f"><span>Минимальный заказ, единиц</span><input class="inp" name="min_units" type="number" min="1" value="${e.min_units}"></label>
          <label class="f"><span>Доплата за оператора, ₽/ед.</span><input class="inp" name="operator" type="number" min="0" step="1" max="1000000000" value="${fromMinor(e.operator_minor)}">
            <div class="hint">0 — оператор включён в ставку</div></label>
          <label class="f"><span>Залог, ₽</span><input class="inp" name="deposit" type="number" min="0" step="1" max="1000000000" value="${fromMinor(e.deposit_minor)}"></label>
        </div>
        <div class="grid2">
          <label class="f"><span>Доставка (подача и возврат), ₽</span><input class="inp" name="delivery" type="number" min="0" step="1" max="1000000000" value="${e.delivery_minor == null ? '' : fromMinor(e.delivery_minor)}" ${e.delivery_minor == null ? 'disabled' : ''}></label>
          <label class="check" style="margin-top:30px"><input type="checkbox" name="delivery_request" ${e.delivery_minor == null ? 'checked' : ''}> <span>Доставка по запросу</span></label>
        </div>
        <label class="f"><span>Условия отмены</span><select class="inp" name="cancel_policy">
          ${POLICY_CHOICES.map((k) => `<option value="${k}" ${policyChoice(e.cancel_policy) === k ? 'selected' : ''}>${esc(POLICY[k])}</option>`).join('')}</select></label>
        <label class="check"><input type="checkbox" name="instant_book" ${e.instant_book ? 'checked' : ''}> <span>Мгновенное бронирование — бронь подтверждается автоматически, без моего ответа</span></label>
      </div>
      <div class="form-error hidden" id="err"></div>
      <div class="panel actions" style="position:sticky;bottom:10px;z-index:5">
        <button class="btn dark" name="save">Сохранить</button>
        ${id && ['DRAFT', 'REJECTED'].includes(e.status) ? '<button type="button" class="btn" id="submitBtn">Отправить на модерацию</button>' : ''}
        ${id && e.status === 'PUBLISHED' ? '<button type="button" class="btn ghost" data-st="HIDDEN">Скрыть из каталога</button>' : ''}
        ${id && e.status === 'HIDDEN' && e.was_published ? '<button type="button" class="btn ghost" data-st="PUBLISHED">Вернуть в каталог</button>' : ''}
        ${id ? '<button type="button" class="btn ghost" id="cloneBtn">Дублировать</button>' : ''}
        ${id && e.status !== 'ARCHIVED' ? '<button type="button" class="btn danger" data-st="ARCHIVED">В архив</button>' : ''}
      </div>
      </fieldset>
    </form>
    ${id ? `<div class="panel" id="s6"><h2>6. Календарь и блокировки</h2>
      ${groupSize() > 1 ? `<label class="f" style="max-width:360px"><span>Машина</span><select class="inp" id="calUnit">${units.filter((u) => u.id).map((u, i) =>
        `<option value="${u.id}" ${u.id === (query.unit || id) ? 'selected' : ''}>${i + 1}. ${esc(u.reg || 'без госномера')}${u.year ? ' · ' + u.year : ''}${u.busy ? ' · занята сегодня' : ''}</option>`).join('')}</select>
        <div class="hint">У каждой машины свой календарь: брони, «Занято» и ТО. В каталоге даты закрыты, только когда заняты все машины группы.</div></label>` : ''}
      <div id="calBox"><div class="skeleton" style="height:120px"></div></div></div>` : ''}`;

  const f = app.querySelector('#ef');
  // --- машины карточки: госномер и год у каждой ---
  const unitsEl = app.querySelector('#units');
  const readUnits = () => unitsEl.querySelectorAll('.unit-row').forEach((r, i) => {
    units[i].reg = r.querySelector('[data-k=reg]').value; units[i].year = r.querySelector('[data-k=year]').value;
  });
  const drawUnits = () => {
    unitsEl.innerHTML = units.map((u, i) => `<div class="unit-row">
      <span class="n">${i + 1}</span>
      <input class="inp" data-k="reg" maxlength="20" placeholder="А123ВС 78" value="${esc(u.reg)}" aria-label="Госномер машины ${i + 1}" required>
      <input class="inp" data-k="year" type="number" min="1950" max="${YEAR_MAX}" placeholder="2020" value="${esc(u.year)}" aria-label="Год выпуска машины ${i + 1}" required>
      ${!editable ? '<span></span>' : !u.id ? (units.length > 1 ? `<button type="button" class="btn ghost sm" data-udel="${i}" aria-label="Убрать строку">×</button>` : '<span></span>')
        : units.length > 1 ? `<button type="button" class="btn ghost sm" data-urm="${u.id}" title="Убрать машину из группы в архив">Убрать</button>` : '<span></span>'}
      ${u.id && units.length > 1 ? `<span class="u-st small ${u.busy ? 'warn-text' : 'muted'}">${u.busy ? 'занята сегодня' : 'свободна сегодня'}${u.status && u.status !== e.status ? ' · ' + statusLabel('equipment', u.status) : ''}</span>` : ''}</div>`).join('');
    const qty = app.querySelector('#uqty'); if (qty) qty.value = units.length;
    markSteps();
  };
  unitsEl.addEventListener('click', async (ev) => {
    const del = ev.target.closest('[data-udel]'), rm = ev.target.closest('[data-urm]');
    if (del) { readUnits(); units.splice(+del.dataset.udel, 1); drawUnits(); }
    if (rm) {
      const u = units.find((x) => x.id === rm.dataset.urm);
      if (!await confirmBox('Убрать машину из группы?', `Машина ${u?.reg || ''} уйдёт в архив и пропадёт из каталога. История её сделок сохранится. В группе останется ${units.length - 1} шт.`, 'Убрать', true)) return;
      try { const lead = await rpc('remove_group_unit', { p_id: rm.dataset.urm }); toast('Машина убрана в архив'); lead && lead !== id ? go('#/fleet/' + lead) : route(); }
      catch (err) { toast(err.message, true); }
    }
  });
  app.querySelector('#uadd')?.addEventListener('click', () => {
    readUnits(); if (units.length >= 100) return toast('В одной группе — не больше 100 машин', true);
    units.push({ id: null, reg: '', year: units[units.length - 1]?.year || '' }); drawUnits();
    unitsEl.querySelector('.unit-row:last-child [data-k=reg]')?.focus();
  });
  app.querySelector('#uqty').addEventListener('change', (ev) => {
    readUnits();
    const want = Math.min(100, Math.max(1, Math.round(+ev.target.value || 1)));
    while (units.length < want) units.push({ id: null, reg: '', year: units[units.length - 1]?.year || '' });
    // Уменьшить можно только за счёт новых пустых строк; сохранённые машины убираются кнопкой «Убрать»
    while (units.length > want && !units[units.length - 1].id) units.pop();
    if (units.length > want) toast('Сохранённые машины убирайте кнопкой «Убрать» в их строке', true);
    drawUnits();
  });
  // --- характеристики по категории ---
  const drawSpecs = () => {
    const cat = categoryById(f.category_id.value);
    const codes = cat ? (CATEGORY_SPECS[cat.code] || CATEGORY_SPECS.other) : [];
    app.querySelector('#specs').innerHTML = codes.length ? codes.map((code) => {
      const [label, unit] = SPEC_LABELS[code] || [code, ''];
      const v = e.specs?.[code] ?? '';
      // Характеристики с типовыми значениями (ходовая, тип катка, колёсная формула…) — выпадающий список, можно вписать своё
      return `<label class="f"><span>${esc(label)}${unit ? ', ' + unit : ''}</span>
        <input class="inp" data-spec="${code}" ${SPEC_OPTIONS[code] ? `data-dd="opt:${code}"` : ''} ${TEXT_SPECS.has(code) ? '' : 'type="number" step="any" min="0"'} value="${esc(v)}"></label>`;
    }).join('') : '<p class="muted">Сначала выберите категорию.</p>';
  };
  drawSpecs();
  const autoTitle = () => {
    const cat = categoryById(f.category_id.value);
    if (!cat || (f.title.value && f.title.dataset.auto !== '1')) return;
    f.title.value = [SINGULAR[cat.code] || cat.name, f.brand.value, f.model.value].filter(Boolean).join(' ');
    f.title.dataset.auto = '1';
  };
  if (!id) f.title.dataset.auto = '1';
  f.title.addEventListener('input', () => { f.title.dataset.auto = '0'; });
  f.category_id.addEventListener('change', () => { e.specs = collectSpecs(); drawSpecs(); autoTitle(); });
  f.brand.addEventListener('input', autoTitle); f.model.addEventListener('input', autoTitle);
  // Марки — по выбранной категории, модели — по выбранной марке (справочник catalog-data.js, 20.11.2026)
  const catCode = () => categoryById(f.category_id.value)?.code || '';
  registerSource('brand', () => brandsFor(catCode()));
  registerSource('model', () => modelsFor(catCode(), f.brand.value));
  // Выбрана модель из справочника — подставляем типовые характеристики в пустые поля и просим проверить
  const fillSpecs = () => {
    const cat = categoryById(f.category_id.value);
    const codes = cat ? (CATEGORY_SPECS[cat.code] || CATEGORY_SPECS.other) : [];
    const sp = specsFor(cat?.code, f.brand.value, f.model.value, codes);
    const note = app.querySelector('#specAuto');
    if (!sp) return;
    let n = 0;
    app.querySelectorAll('[data-spec]').forEach((i) => {
      if (i.value === '' && sp[i.dataset.spec] != null) { i.value = sp[i.dataset.spec]; n++; }
    });
    if (n) {
      note.textContent = `Характеристики подставлены по справочнику для ${f.brand.value} ${f.model.value} (${n}) — проверьте и поправьте под вашу машину.`;
      note.classList.remove('hidden');
      markSteps();
    }
  };
  f.model.addEventListener('dd-pick', fillSpecs);
  f.model.addEventListener('change', fillSpecs);
  // Сменили марку — модель другой марки очищаем, чтобы не осталось «Komatsu ZX200»
  f.brand.addEventListener('change', () => {
    const list = modelsFor(catCode(), f.brand.value);
    if (f.model.value && list.length && !list.some((m) => m.toLowerCase() === f.model.value.trim().toLowerCase())) { f.model.value = ''; autoTitle(); }
  });
  f.delivery_request.addEventListener('change', () => { f.delivery.disabled = f.delivery_request.checked; });
  const collectSpecs = () => {
    const s = {};
    app.querySelectorAll('[data-spec]').forEach((i) => {
      if (i.value === '') return;
      s[i.dataset.spec] = i.type === 'number' ? Number(i.value) : i.value.trim();
    });
    return s;
  };

  // --- фото ---
  const drawPhotos = () => {
    app.querySelector('#photos').innerHTML = photos.map((p, i) => `<div class="ph"><img src="${esc(p.url)}" alt="" referrerpolicy="no-referrer">
      ${editable ? `<button type="button" data-del="${i}" aria-label="Удалить фото">×</button>` : ''}
      ${i === 0 ? '<span class="st ok" style="position:absolute;left:5px;bottom:5px">Главное</span>' : editable ? `<button type="button" data-main="${i}" style="left:5px;right:auto;width:auto;padding:0 6px;font-size:11px">Главное</button>` : ''}</div>`).join('')
      + (editable && photos.length < 20 ? `<label class="photo-add" for="file"><span>+ Добавить фото<br><small>${photos.length}/20</small></span></label>` : '');
    markSteps();
  };
  // --- кнопки разделов: прокрутка к блоку и цвет по заполненности обязательных полей ---
  function markSteps() {
    const filled = (n) => !!f[n]?.value.trim();
    const st = {
      s1: filled('category_id') && filled('brand') && filled('model') && filled('title')
        && [...app.querySelectorAll('#units [data-k]')].every((i) => i.value.trim()) ? 'ok' : 'todo',
      s2: [...app.querySelectorAll('[data-spec]')].some((i) => i.value !== '') ? 'ok' : '',
      s3: photos.length >= 3 ? 'ok' : 'todo',
      s4: filled('city') ? 'ok' : 'todo',
      s5: (f.with_operator.checked || f.without_operator.checked) && Number(f.price.value) > 0 ? 'ok' : 'todo',
      s6: id && calStale(e) ? 'attn' : ''
    };
    const tips = { ok: 'Обязательные поля заполнены', todo: 'Есть незаполненные обязательные поля', '': 'Необязательный раздел',
      attn: 'Подтвердите, что календарь актуален — иначе в каталоге появится «Доступность уточняется»' };
    app.querySelectorAll('#steps [data-go]').forEach((b) => {
      b.className = st[b.dataset.go] || '';
      b.title = b.dataset.go === 's3' && st.s3 === 'todo' ? `Нужно минимум 3 фото, сейчас ${photos.length}` : tips[st[b.dataset.go] || ''];
    });
  }
  // Прокрутка к разделу. Для «6. Календарь», когда календарь давно не подтверждали, — ещё и подсветка кнопки «Календарь актуален»
  const goTo = (k) => {
    const el = app.querySelector('#' + k);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - (app.querySelector('#steps').offsetHeight + 80);
    window.scrollTo({ top, behavior: 'smooth' });
    el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1200);
    if (k === 's6' && calStale(e)) {
      const btn = el.querySelector('#fresh');
      if (btn) { btn.classList.remove('attn-btn'); void btn.offsetWidth; btn.classList.add('attn-btn'); setTimeout(() => btn.focus({ preventScroll: true }), 600); }
    }
  };
  app.querySelector('#steps').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-go]');
    if (b) goTo(b.dataset.go);
  });
  f.addEventListener('input', markSteps);
  f.addEventListener('change', markSteps);
  drawUnits();
  drawPhotos();
  app.querySelector('#photos').addEventListener('click', (ev) => {
    const d = ev.target.closest('[data-del]'), mn = ev.target.closest('[data-main]');
    if (d) { photos.splice(+d.dataset.del, 1); drawPhotos(); }
    if (mn) { const [p] = photos.splice(+mn.dataset.main, 1); photos.unshift(p); drawPhotos(); }
  });
  app.querySelector('#file').addEventListener('change', async (ev) => {
    const files = [...ev.target.files].slice(0, 20 - photos.length);
    ev.target.value = '';
    for (const file of files) {
      try { toast('Загружаем фото…'); photos.push({ url: await uploadPhoto(o.id, file) }); drawPhotos(); }
      catch (err) { toast(err.message, true); }
    }
  });

  // --- сохранение ---
  const payload = () => ({
    org_id: o.id, category_id: Number(f.category_id.value), brand: f.brand.value.trim(), model: f.model.value.trim(),
    year: units[0]?.year ? Number(units[0].year) : null, title: f.title.value.trim(), description: f.description.value.trim() || null,
    city: f.city.value.trim(), district: f.district.value.trim() || null, service_radius_km: Number(f.service_radius_km.value || 0),
    with_operator: f.with_operator.checked, without_operator: f.without_operator.checked,
    price_unit: f.price_unit.value, price_minor: f.price.value ? toMinor(f.price.value) : null,
    shift_hours: Number(f.shift_hours.value || 8), min_units: Number(f.min_units.value || 1),
    operator_minor: f.operator.value ? toMinor(f.operator.value) : 0,
    delivery_minor: f.delivery_request.checked ? null : (f.delivery.value ? toMinor(f.delivery.value) : 0),
    deposit_minor: f.deposit.value ? toMinor(f.deposit.value) : 0, cancel_policy: f.cancel_policy.value,
    instant_book: f.instant_book.checked, specs: collectSpecs(), photos
  });
  const showErr = (msg) => { const el = app.querySelector('#err'); el.textContent = msg; el.classList.remove('hidden'); el.scrollIntoView({ block: 'center' }); };
  // Проверка машин до сохранения: госномер и год у каждой, номера не повторяются
  const checkUnits = () => {
    readUnits();
    const norm = (s) => s.toUpperCase().replace(/[\s-]/g, '');
    const seen = new Set();
    for (const [i, u] of units.entries()) {
      const row = unitsEl.querySelectorAll('.unit-row')[i];
      if (!u.reg.trim()) { row?.querySelector('[data-k=reg]').focus(); throw new Error(`Укажите госномер машины ${i + 1} (раздел «1. Основное»)`); }
      const y = Number(u.year);
      if (!y || y < 1950 || y > YEAR_MAX) { row?.querySelector('[data-k=year]').focus(); throw new Error(`Укажите год выпуска машины ${i + 1}: от 1950 до ${YEAR_MAX}`); }
      if (seen.has(norm(u.reg))) { row?.querySelector('[data-k=reg]').focus(); throw new Error(`Госномер ${u.reg} указан дважды`); }
      seen.add(norm(u.reg));
    }
  };
  const unitsPayload = (leadId) => units.map((u, i) => ({ id: i === 0 ? leadId : u.id, reg: u.reg.trim(), year: Number(u.year) }));
  async function save() {
    checkUnits();
    const p = payload();
    if (!p.with_operator && !p.without_operator) throw new Error('Выберите формат аренды: с оператором и/или без');
    // 12.11.2026 (Этибар): цена обязательна, «Договорная» убрана. То же проверяет база (SQL 32).
    if (!(p.price_minor > 0)) {
      f.price.focus();
      throw new Error('Укажите ставку в разделе «5. Цены и условия» — цена обязательна');
    }
    if (id) {
      const { error } = await sb.from('equipment').update(p).eq('id', id);
      if (error) throw new Error(error.message);
      await rpc('save_group_units', { p_lead: id, p_units: unitsPayload(id) });
      return id;
    }
    const { data, error } = await sb.from('equipment').insert(p).select('id').single();
    if (error) throw new Error(error.message);
    try { await rpc('save_group_units', { p_lead: data.id, p_units: unitsPayload(data.id) }); }
    catch (err) { const e2 = new Error(err.message + ' — карточка сохранена черновиком, исправьте машины и сохраните ещё раз'); e2.newId = data.id; throw e2; }
    return data.id;
  }
  f.onsubmit = (ev) => {
    ev.preventDefault();
    busy(f.querySelector('[name=save]'), async () => {
      try { const newId = await save(); toast(units.length > 1 ? `Сохранено: ${units.length} машин` : 'Сохранено'); if (!id) go('#/fleet/' + newId); else route(); }
      catch (err) { if (err.newId) { toast(err.message, true); go('#/fleet/' + err.newId); } else showErr(err.message); }
    });
  };
  app.querySelector('#mergeBtn')?.addEventListener('click', (ev) => busy(ev.currentTarget, async () => {
    if (!await confirmBox('Объединить в группу?', `Карточки (${twins.length + 1} шт.) станут одной группой. Все они получат описание, фото, цены и статус этой карточки. Госномер, год и календарь у каждой машины сохранятся.`, 'Объединить')) return;
    try { const n = await rpc('merge_into_group', { p_lead: id, p_ids: twins.map((x) => x.id) }); toast(`Готово: в группе ${n} шт.`); route(); }
    catch (err) { showErr(err.message); }
  }));
  app.querySelector('#submitBtn')?.addEventListener('click', (ev) => busy(ev.currentTarget, async () => {
    try { await save(); await rpc('submit_equipment', { p_id: id }); toast('Отправлено на модерацию'); route(); }
    catch (err) { showErr(err.message); }
  }));
  app.querySelectorAll('[data-st]').forEach((b) => b.addEventListener('click', async () => {
    const st = b.dataset.st;
    if (st === 'ARCHIVED' && !await confirmBox('Убрать в архив?', groupSize() > 1
      ? `В архив уйдут все ${groupSize()} машин группы — карточка исчезнет из каталога и из списка. История сделок сохранится. Чтобы убрать одну машину, нажмите «Убрать» в её строке.`
      : 'Карточка исчезнет из каталога и из списка. История сделок сохранится.', 'В архив', true)) return;
    const { error } = await sb.from('equipment').update({ status: st }).eq('id', id);
    if (error) return showErr(error.message);
    toast('Готово'); st === 'ARCHIVED' ? go('#/fleet') : route();
  }));
  app.querySelector('#cloneBtn')?.addEventListener('click', (ev) => busy(ev.currentTarget, async () => {
    const p = payload(); p.title = p.title + ' (копия)';
    const { data, error } = await sb.from('equipment').insert(p).select('id').single();
    if (error) return showErr(error.message);
    toast('Создана копия-черновик'); go('#/fleet/' + data.id);
  }));

  if (id) {
    // После «Календарь актуален»: снимаем подсветку шага и обновляем счётчик «Моя техника» в меню
    const onConfirm = async () => { markSteps(); await refreshCounters(); refreshShell(); };
    // У группы — календарь выбранной машины (по умолчанию — из ссылки ?unit= или первая)
    const calUnit = app.querySelector('#calUnit');
    const showCal = () => calendar(app.querySelector('#calBox'), { ...e, id: calUnit?.value || e.id }, editable, onConfirm).catch(() => {});
    calUnit?.addEventListener('change', showCal);
    await showCal();
    // Пришли из списка или меню с ?go=s6 — сразу к календарю и кнопке
    if (query.go) setTimeout(() => goTo(query.go), 150);
  }
}

async function calendar(box, e, editable, onConfirm) {
  const rows = await q(sb.from('bookings').select('*').eq('equipment_id', e.id).in('status', ['HOLD', 'CONFIRMED', 'ACTIVE'])
    .order('period', { ascending: true }));
  const range = (r) => {
    const m = r.period.match(/[\[(]"?([^",]+)"?,"?([^")]+)"?[\])]/);
    const iso = (x) => x.trim().replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00');
    const s = new Date(iso(m[1])), en = new Date(new Date(iso(m[2])) - 1000);
    return [s.toLocaleDateString('sv', { timeZone: 'Europe/Moscow' }), en.toLocaleDateString('sv', { timeZone: 'Europe/Moscow' })];
  };
  const typeName = { DEAL: 'Сделка', OWNER_BLOCK: 'Занято (вручную)', MAINTENANCE: 'ТО / ремонт' };
  const ago = Math.floor((Date.now() - new Date(e.availability_confirmed_at)) / 864e5);
  box.innerHTML = `
    <div class="banner ${ago > 5 ? 'warn' : 'ok'}">Календарь подтверждён ${ago ? ago + ' дн. назад' : 'сегодня'}.
      Если не обновлять его 7 дней, в каталоге появится пометка «Доступность уточняется».
      ${editable ? '<button class="btn sm dark" id="fresh" style="margin-left:auto">Календарь актуален</button>' : ''}</div>
    ${rows.length ? `<table class="table resp"><thead><tr><th>Даты</th><th>Тип</th><th>Статус</th><th></th></tr></thead><tbody>
      ${rows.map((r) => { const [s, en] = range(r); return `<tr><td>${date(s)} — ${date(en)}</td><td>${typeName[r.type]}${r.reason ? ': ' + esc(r.reason) : ''}</td>
        <td>${status('booking', r.status)}</td><td>${r.type === 'DEAL' ? `<a href="#/deals/${r.deal_id}">Сделка →</a>` : editable ? `<button class="btn ghost sm" data-rm="${r.id}">Снять</button>` : ''}</td></tr>`; }).join('')}
      </tbody></table>` : '<p class="muted">Занятых дат нет — техника свободна.</p>'}
    ${editable ? `<h3 style="margin-top:16px">Закрыть даты</h3>
    <form id="bf" class="actions">
      <input class="inp" type="date" name="s" required min="${mskToday(0)}" style="width:160px">
      <input class="inp" type="date" name="e" required min="${mskToday(0)}" style="width:160px">
      <select class="inp" name="t" style="width:auto"><option value="OWNER_BLOCK">Занято</option><option value="MAINTENANCE">ТО / ремонт</option></select>
      <input class="inp" name="r" placeholder="Комментарий (видите только вы)" style="width:220px">
      <button class="btn dark">Закрыть даты</button></form>` : ''}`;
  box.querySelector('#fresh')?.addEventListener('click', async () => {
    try { await rpc('confirm_calendar', { p_id: e.id }); toast('Спасибо! Календарь отмечен актуальным'); e.availability_confirmed_at = new Date().toISOString(); calendar(box, e, editable, onConfirm); onConfirm?.(); }
    catch (err) { toast(err.message, true); }
  });
  box.querySelectorAll('[data-rm]').forEach((b) => b.onclick = async () => {
    try { await rpc('remove_block', { p_id: b.dataset.rm }); toast('Даты освобождены'); calendar(box, e, editable, onConfirm); }
    catch (err) { toast(err.message, true); }
  });
  const bf = box.querySelector('#bf');
  if (bf) bf.onsubmit = (ev) => {
    ev.preventDefault();
    busy(bf.querySelector('button'), async () => {
      try { await rpc('add_block', { p_eq: e.id, p_start: bf.s.value, p_end: bf.e.value, p_type: bf.t.value, p_reason: bf.r.value || null }); toast('Даты закрыты'); calendar(box, e, editable, onConfirm); }
      catch (err) { toast(err.message, true); }
    });
  };
}
