// Мой парк: список техники, мастер карточки, фото, календарь и блокировки (SCR-CAT-06/07/08)
import { sb, state, q, rpc, loadCategories, categoryById, uploadPhoto, canManage, actsAsProvider } from '../api.js';
import { esc, money, priceText, photoOf, status, toast, busy, confirmBox, emptyState, errorState, SPEC_LABELS, CATEGORY_SPECS,
  toMinor, fromMinor, mskToday, date, statusLabel, POLICY } from '../ui.js';
import { go, route } from '../app.js';

const SINGULAR = {
  excavators: 'Экскаватор', mini_excavators: 'Мини-экскаватор', backhoe_loaders: 'Экскаватор-погрузчик', wheel_loaders: 'Фронтальный погрузчик',
  mini_loaders: 'Мини-погрузчик', telehandlers: 'Телескопический погрузчик', bulldozers: 'Бульдозер', graders: 'Автогрейдер',
  rollers: 'Каток', pavers: 'Асфальтоукладчик', truck_cranes: 'Автокран', aerial_platforms: 'Автовышка', dump_trucks: 'Самосвал',
  manipulators: 'Манипулятор', drilling_rigs: 'Буровая установка', concrete: 'Бетононасос', other: ''
};
const TEXT_SPECS = new Set(['undercarriage', 'roller_type', 'chassis', 'axle_formula', 'drill_type', 'description_specs']);

export async function render(app, params, _q, pattern) {
  const o = state.org;
  // Смотреть свою технику можно, если она есть, даже когда галочку «Исполнитель» сняли; добавлять новую — только исполнителю
  if (!(pattern === 'fleet/new' ? o.can_provide : actsAsProvider(o))) {
    app.innerHTML = emptyState('Текущая организация не исполнитель',
      'Чтобы сдавать технику, создайте организацию исполнителя (ИП, юрлицо или самозанятый) или переключитесь на неё в меню слева.',
      '<a class="btn" href="#/account">Создать организацию</a>');
    return;
  }
  await loadCategories();
  if (pattern === 'fleet') return list(app, o);
  return editor(app, o, pattern === 'fleet/new' ? null : params.id);
}

async function list(app, o) {
  let rows;
  try { rows = await q(sb.from('equipment').select('*, categories(name)').eq('org_id', o.id).neq('status', 'ARCHIVED').order('created_at', { ascending: false })); }
  catch (err) { app.innerHTML = errorState(err); return; }
  app.innerHTML = `
    <div class="page-head"><div><h1>Моя техника</h1><p>${esc(o.name)}</p></div>
      ${canManage() && o.can_provide ? '<a class="btn" href="#/fleet/new">+ Добавить технику</a>' : ''}</div>
    ${!o.can_provide ? '<div class="banner warn">У организации выключена роль исполнителя — техника скрыта из каталога, её нельзя забронировать. Чтобы снова сдавать технику, включите роль «Исполнитель» в <a href="#/account">Профиле и организациях</a>.</div>' : ''}
    ${o.verification_status !== 'VERIFIED' ? `<div class="banner warn">Организация ${statusLabel('org', o.verification_status).toLowerCase()}. Карточки можно заполнять, а публиковать — после проверки. <a href="#/account">Подробнее</a></div>` : ''}
    ${rows.length ? `<div class="panel">${rows.map((e) => {
      const p = photoOf(e);
      const stale = e.status === 'PUBLISHED' && Date.now() - new Date(e.availability_confirmed_at) > 5 * 864e5;
      return `<a class="row-item" href="#/fleet/${e.id}">${p ? `<img src="${esc(p.url)}" alt="" referrerpolicy="no-referrer">` : '<img alt="">'}
        <div class="grow"><b>${esc(e.title)}</b><div class="small muted">${esc(e.categories?.name)} · ${esc(e.city)} · <span class="num">${priceText(e)}</span></div>
        ${stale ? '<div class="small warn-text">Подтвердите актуальность календаря</div>' : ''}
        ${e.moderation_comment && e.status === 'REJECTED' ? `<div class="small" style="color:var(--red)">Модератор: ${esc(e.moderation_comment)}</div>` : ''}</div>
        ${status('equipment', e.status)}</a>`;
    }).join('')}</div>`
    : emptyState('Пока нет техники', 'Добавьте первую единицу — заказчики увидят её в каталоге после модерации.', canManage() && o.can_provide ? '<a class="btn" href="#/fleet/new">Добавить технику</a>' : '')}`;
}

async function editor(app, o, id) {
  let e = { category_id: '', brand: '', model: '', year: '', title: '', description: '', city: o.city || '', district: '', service_radius_km: 50,
    with_operator: true, without_operator: false, price_unit: 'SHIFT', price_minor: null, shift_hours: 8, min_units: 1, operator_minor: 0,
    delivery_minor: 0, deposit_minor: 0, cancel_policy: 'FLEXIBLE', instant_book: false, specs: {}, photos: [], status: 'DRAFT' };
  if (id) {
    const row = await q(sb.from('equipment').select('*').eq('id', id).eq('org_id', o.id).maybeSingle());
    if (!row) { app.innerHTML = emptyState('Карточка не найдена', 'Возможно, она принадлежит другой организации. Переключите контекст слева.'); return; }
    e = row;
  }
  let photos = (e.photos || []).map((p) => (typeof p === 'string' ? { url: p } : p));
  const cats = state.categories;
  const editable = canManage();

  app.innerHTML = `
    <div class="crumbs"><a href="#/fleet">Моя техника</a> › <b>${id ? esc(e.title) : 'Новая карточка'}</b></div>
    <div class="page-head"><div><h1>${id ? esc(e.title) : 'Новая техника'}</h1>${id ? `<div style="margin-top:6px">${status('equipment', e.status)}</div>` : ''}</div>
      ${id && e.status === 'PUBLISHED' ? `<a class="btn ghost" href="#/item/${id}">Открыть в каталоге</a>` : ''}</div>
    ${e.moderation_comment && ['REJECTED', 'HIDDEN'].includes(e.status) ? `<div class="banner err">Комментарий модератора: ${esc(e.moderation_comment)}</div>` : ''}
    ${e.status === 'PENDING_MODERATION' ? '<div class="banner info">Карточка на модерации — обычно это занимает до 1 рабочего дня. Мы пришлём уведомление.</div>' : ''}
    <div class="steps" id="steps">${[['s1', '1. Основное'], ['s2', '2. Характеристики'], ['s3', '3. Фото'], ['s4', '4. Место'], ['s5', '5. Цены и условия'], ...(id ? [['s6', '6. Календарь']] : [])]
      .map(([k, t]) => `<button type="button" data-go="${k}"><i></i>${t}</button>`).join('')}
      <span class="steps-legend small muted"><i class="ok"></i>заполнено <i class="todo"></i>нужно заполнить <i></i>необязательно</span></div>
    <form id="ef">
      <fieldset ${editable ? '' : 'disabled'} style="border:0;padding:0;margin:0">
      <div class="panel" id="s1"><h2>1. Основное</h2>
        <label class="f"><span>Категория <i>*</i></span><select class="inp" name="category_id" required><option value="">Выберите</option>
          ${cats.map((c) => `<option value="${c.id}" ${c.id === e.category_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
        <div class="grid3">
          <label class="f"><span>Марка <i>*</i></span><input class="inp" name="brand" required value="${esc(e.brand)}" maxlength="60"></label>
          <label class="f"><span>Модель <i>*</i></span><input class="inp" name="model" required value="${esc(e.model)}" maxlength="60"></label>
          <label class="f"><span>Год выпуска</span><input class="inp" name="year" type="number" min="1950" max="2100" value="${esc(e.year ?? '')}"></label>
        </div>
        <label class="f"><span>Название карточки <i>*</i></span><input class="inp" name="title" required maxlength="120" value="${esc(e.title)}">
          <div class="hint">Подставляется автоматически, можно изменить. Например: «Автокран КС-55713 · 25 тонн».</div></label>
        <label class="f"><span>Описание</span><textarea class="inp" name="description" maxlength="3000" rows="5">${esc(e.description || '')}</textarea>
          <div class="hint">Без телефонов, почты и ссылок — контакты откроются после подтверждения сделки.</div></label>
      </div>
      <div class="panel" id="s2"><h2>2. Характеристики</h2><div class="grid3" id="specs"></div></div>
      <div class="panel" id="s3"><h2>3. Фото</h2>
        <p class="muted small" style="margin-top:-6px">Минимум 3 фото: общий вид, рабочий орган, кабина или табличка. JPEG/PNG/WebP до 10 МБ. Первое фото — главное.</p>
        <div class="photo-grid" id="photos"></div>
        <input type="file" id="file" accept="image/jpeg,image/png,image/webp" multiple class="hidden">
      </div>
      <div class="panel" id="s4"><h2>4. Место и зона работы</h2>
        <div class="grid3">
          <label class="f"><span>Город базирования <i>*</i></span><input class="inp" name="city" required value="${esc(e.city)}"></label>
          <label class="f"><span>Район</span><input class="inp" name="district" value="${esc(e.district || '')}"></label>
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
            <option value="DAY" ${e.price_unit === 'DAY' ? 'selected' : ''}>За сутки</option><option value="NEGOTIABLE" ${e.price_unit === 'NEGOTIABLE' ? 'selected' : ''}>Договорная</option></select></label>
          <label class="f"><span>Ставка, ₽</span><input class="inp" name="price" type="number" min="0" step="1" max="1000000000" value="${fromMinor(e.price_minor)}"></label>
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
        <label class="f"><span>Правила отмены</span><select class="inp" name="cancel_policy">
          ${Object.entries(POLICY).map(([k, v]) => `<option value="${k}" ${e.cancel_policy === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
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
    ${id ? `<div class="panel" id="s6"><h2>6. Календарь и блокировки</h2><div id="calBox"><div class="skeleton" style="height:120px"></div></div></div>` : ''}`;

  const f = app.querySelector('#ef');
  // --- характеристики по категории ---
  const drawSpecs = () => {
    const cat = categoryById(f.category_id.value);
    const codes = cat ? (CATEGORY_SPECS[cat.code] || CATEGORY_SPECS.other) : [];
    app.querySelector('#specs').innerHTML = codes.length ? codes.map((code) => {
      const [label, unit] = SPEC_LABELS[code] || [code, ''];
      const v = e.specs?.[code] ?? '';
      return `<label class="f"><span>${esc(label)}${unit ? ', ' + unit : ''}</span>
        <input class="inp" data-spec="${code}" ${TEXT_SPECS.has(code) ? '' : 'type="number" step="any" min="0"'} value="${esc(v)}"></label>`;
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
      s1: filled('category_id') && filled('brand') && filled('model') && filled('title') ? 'ok' : 'todo',
      s2: [...app.querySelectorAll('[data-spec]')].some((i) => i.value !== '') ? 'ok' : '',
      s3: photos.length >= 3 ? 'ok' : 'todo',
      s4: filled('city') ? 'ok' : 'todo',
      s5: (f.with_operator.checked || f.without_operator.checked) && (f.price_unit.value === 'NEGOTIABLE' || filled('price')) ? 'ok' : 'todo',
      s6: ''
    };
    const tips = { ok: 'Обязательные поля заполнены', todo: 'Есть незаполненные обязательные поля', '': 'Необязательный раздел' };
    app.querySelectorAll('#steps [data-go]').forEach((b) => {
      b.className = st[b.dataset.go] || '';
      b.title = b.dataset.go === 's3' && st.s3 === 'todo' ? `Нужно минимум 3 фото, сейчас ${photos.length}` : tips[st[b.dataset.go] || ''];
    });
  }
  app.querySelector('#steps').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-go]');
    if (!b) return;
    const el = app.querySelector('#' + b.dataset.go);
    const top = el.getBoundingClientRect().top + window.scrollY - (app.querySelector('#steps').offsetHeight + 80);
    window.scrollTo({ top, behavior: 'smooth' });
    el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1200);
  });
  f.addEventListener('input', markSteps);
  f.addEventListener('change', markSteps);
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
    year: f.year.value ? Number(f.year.value) : null, title: f.title.value.trim(), description: f.description.value.trim() || null,
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
  async function save() {
    const p = payload();
    if (!p.with_operator && !p.without_operator) throw new Error('Выберите формат аренды: с оператором и/или без');
    if (id) {
      const { error } = await sb.from('equipment').update(p).eq('id', id);
      if (error) throw new Error(error.message);
      return id;
    }
    const { data, error } = await sb.from('equipment').insert(p).select('id').single();
    if (error) throw new Error(error.message);
    return data.id;
  }
  f.onsubmit = (ev) => {
    ev.preventDefault();
    busy(f.querySelector('[name=save]'), async () => {
      try { const newId = await save(); toast('Сохранено'); if (!id) go('#/fleet/' + newId); else route(); }
      catch (err) { showErr(err.message); }
    });
  };
  app.querySelector('#submitBtn')?.addEventListener('click', (ev) => busy(ev.currentTarget, async () => {
    try { await save(); await rpc('submit_equipment', { p_id: id }); toast('Отправлено на модерацию'); route(); }
    catch (err) { showErr(err.message); }
  }));
  app.querySelectorAll('[data-st]').forEach((b) => b.addEventListener('click', async () => {
    const st = b.dataset.st;
    if (st === 'ARCHIVED' && !await confirmBox('Убрать в архив?', 'Карточка исчезнет из каталога и из списка. История сделок сохранится.', 'В архив', true)) return;
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

  if (id) calendar(app.querySelector('#calBox'), e, editable);
}

async function calendar(box, e, editable) {
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
    try { await rpc('confirm_calendar', { p_id: e.id }); toast('Спасибо! Календарь отмечен актуальным'); e.availability_confirmed_at = new Date().toISOString(); calendar(box, e, editable); }
    catch (err) { toast(err.message, true); }
  });
  box.querySelectorAll('[data-rm]').forEach((b) => b.onclick = async () => {
    try { await rpc('remove_block', { p_id: b.dataset.rm }); toast('Даты освобождены'); calendar(box, e, editable); }
    catch (err) { toast(err.message, true); }
  });
  const bf = box.querySelector('#bf');
  if (bf) bf.onsubmit = (ev) => {
    ev.preventDefault();
    busy(bf.querySelector('button'), async () => {
      try { await rpc('add_block', { p_eq: e.id, p_start: bf.s.value, p_end: bf.e.value, p_type: bf.t.value, p_reason: bf.r.value || null }); toast('Даты закрыты'); calendar(box, e, editable); }
      catch (err) { toast(err.message, true); }
    });
  };
}
