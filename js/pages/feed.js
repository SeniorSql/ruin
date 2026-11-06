// Исполнитель: лента заказов, карточка заказа, форма предложения, мои предложения (SCR-ORD-06..09)
import { sb, state, q, rpc, loadCategories, seenOrders, markOrderSeen, refreshCounters, canManage, actsAsProvider } from '../api.js';
import { esc, money, status, toast, busy, emptyState, errorState, date, period, FORMAT, dateTime, timeLeft, toMinor, fromMinor,
  statusLabel, qs, photoOf } from '../ui.js';
import { go, route, refreshShell } from '../app.js';

export async function render(app, params, query, pattern) {
  await loadCategories();
  const o = state.org;
  // «Мои предложения» (история) видны и при выключенной роли; лента новых заказов — только исполнителю
  if (pattern === 'offers' ? !actsAsProvider(o) : !o.can_provide) {
    app.innerHTML = actsAsProvider(o)
      ? emptyState('Роль исполнителя выключена', 'Лента новых заказов доступна, когда у организации включена роль «Исполнитель». Ваши сделки, техника и предложения по-прежнему доступны в меню слева.',
        '<a class="btn" href="#/account">Включить роль в профиле организации</a>')
      : emptyState('Текущая организация не исполнитель', 'Лента заказов доступна организациям-исполнителям. Создайте организацию или переключитесь на неё слева.',
        '<a class="btn" href="#/account">Создать организацию</a>');
    return;
  }
  if (pattern === 'offers') return myOffers(app);
  if (o.verification_status !== 'VERIFIED') {
    app.innerHTML = emptyState('Лента откроется после проверки организации',
      `Открытые заказы видят только проверенные исполнители — так мы защищаем данные заказчиков. Сейчас статус: «${statusLabel('org', o.verification_status)}».`,
      '<a class="btn" href="#/account">К проверке</a>');
    return;
  }
  if (pattern === 'feed') return feed(app, query);
  return orderPage(app, params.id);
}

async function feed(app, query) {
  const cats = state.categories;
  const f = { cat: query.cat || '', city: query.city || '', mine: query.mine ?? '1' };
  const myEq = await q(sb.from('equipment').select('id,category_id,title').eq('org_id', state.org.id).eq('status', 'PUBLISHED'));
  const myCats = [...new Set(myEq.map((e) => e.category_id))];
  let b = sb.from('orders').select('*, categories(name)').in('status', ['PUBLISHED', 'OFFERS_RECEIVED'])
    .gt('deadline_at', new Date().toISOString()).neq('customer_org_id', state.org.id).order('created_at', { ascending: false }).limit(100);
  if (f.cat) b = b.eq('category_id', Number(f.cat));
  else if (f.mine === '1' && myCats.length) b = b.in('category_id', myCats);
  if (f.city) b = b.ilike('city', `%${f.city}%`);
  let rows;
  try { rows = await q(b); } catch (err) { app.innerHTML = errorState(err); return; }
  const mine = rows.length ? await q(sb.from('offers').select('order_id,status').eq('provider_org_id', state.org.id).in('order_id', rows.map((r) => r.id))) : [];
  const myByOrder = Object.fromEntries(mine.map((x) => [x.order_id, x.status]));
  const seen = seenOrders();
  const fresh = rows.filter((o) => !myByOrder[o.id] && !seen.has(o.id)).length;

  app.innerHTML = `
    <div class="page-head"><div><h1>Лента заказов</h1><p>Открытые заказы заказчиков. Отвечайте быстрее — это повышает шансы.</p></div>
      ${fresh ? `<button class="btn ghost sm" id="seenAll">Отметить все просмотренными (${fresh})</button>` : ''}</div>
    ${!myEq.length ? '<div class="banner warn">У вас нет опубликованной техники — отправить предложение не получится. <a href="#/fleet/new">Добавить технику</a></div>' : ''}
    <form class="filters" id="ff">
      <select class="inp" name="cat"><option value="">Все категории</option>${cats.map((c) => `<option value="${c.id}" ${String(c.id) === f.cat ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
      <input class="inp" name="city" placeholder="Город" value="${esc(f.city)}">
      <label class="check" style="margin:0"><input type="checkbox" name="mine" value="1" ${f.mine === '1' ? 'checked' : ''}> Подходит моей технике</label>
      <button class="btn dark">Показать</button></form>
    ${rows.length ? `<div class="panel">${rows.map((o) => `<a class="row-item" href="#/feed/${o.id}">
      <div class="grow"><b>${esc(o.title)}</b>${!myByOrder[o.id] && !seen.has(o.id) ? '<span class="badge-new">НОВЫЙ</span>' : ''}
        <div class="small muted">${esc(o.categories?.name)} · ${o.qty} шт. · ${esc(o.city)}${o.district ? ', ' + esc(o.district) : ''} · ${FORMAT[o.format].toLowerCase()}</div>
        <div class="small">${period(o.start_date, o.end_date)}${o.budget_visible && o.budget_minor ? ' · бюджет ' + money(o.budget_minor) : ''}
          ${o.visibility === 'DIRECT' ? ' · <b>личный запрос вам</b>' : ''}</div></div>
      <div style="text-align:right">${myByOrder[o.id] ? status('offer', myByOrder[o.id]) : `<span class="small muted">приём ещё ${timeLeft(o.deadline_at)}</span>`}</div></a>`).join('')}</div>`
    : emptyState('Подходящих заказов сейчас нет', 'Мы пришлём уведомление, когда появится заказ для вашей техники. Можно снять фильтр «Подходит моей технике».')}`;
  app.querySelector('#seenAll')?.addEventListener('click', async () => {
    rows.forEach((o) => markOrderSeen(o.id));
    (state.counters.feed_new_ids || []).forEach(markOrderSeen);
    await refreshCounters(); route();
  });
  app.querySelector('#ff').onsubmit = (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    location.hash = '#/feed' + qs({ cat: d.cat, city: d.city, mine: d.mine ? '1' : '0' });
  };
}

async function orderPage(app, id) {
  let o;
  try { o = await q(sb.from('orders').select('*, categories(name), organizations!orders_customer_org_id_fkey(name,type,verification_status)').eq('id', id).maybeSingle()); }
  catch (err) { app.innerHTML = errorState(err); return; }
  if (!o) { app.innerHTML = emptyState('Заказ недоступен', 'Заказ закрыт, отменён или не предназначен для вашей организации.'); return; }
  // Заказ открыт — он больше не «новый», счётчик ленты уменьшается
  if (!seenOrders().has(id)) { markOrderSeen(id); refreshCounters().then(refreshShell); }
  const [myEq, myOffers, offerCount] = await Promise.all([
    q(sb.from('equipment').select('*').eq('org_id', state.org.id).eq('status', 'PUBLISHED').eq('category_id', o.category_id)),
    q(sb.from('offers').select('*').eq('order_id', id).eq('provider_org_id', state.org.id).order('created_at', { ascending: false })),
    rpc('order_offer_count', { p_order: id }).catch(() => 0)
  ]);
  // Проверяем занятость своей техники на даты заказа
  const busyMap = Object.fromEntries(await Promise.all(myEq.map(async (e) =>
    [e.id, (await rpc('get_busy', { p_eq: e.id, p_from: o.start_date, p_to: o.end_date }).catch(() => [])).length > 0])));
  const active = myOffers.find((f) => ['SUBMITTED', 'SELECTED'].includes(f.status));
  const open = ['PUBLISHED', 'OFFERS_RECEIVED'].includes(o.status) && new Date(o.deadline_at) > Date.now();
  const cust = o.organizations || {};

  app.innerHTML = `
    <div class="crumbs"><a href="#/feed">Лента заказов</a> › <b>${esc(o.title)}</b></div>
    <div class="page-head"><div><h1>${esc(o.title)}</h1><div style="margin-top:6px">${status('order', o.status)}
      ${o.visibility === 'DIRECT' ? '<span class="st warn">Личный запрос вам</span>' : ''}</div></div>
      <span class="small muted" style="max-width:260px">Чат с заказчиком откроется, когда он выберет ваше предложение и оформится сделка.</span></div>
    <div class="cols">
      <div>
        <div class="panel"><h2>Что нужно</h2>
          <dl class="kv"><dt>Техника</dt><dd>${esc(o.categories?.name)}, ${o.qty} шт.</dd><dt>Формат</dt><dd>${FORMAT[o.format]}</dd>
            <dt>Даты</dt><dd>${period(o.start_date, o.end_date)}</dd>
            <dt>Где</dt><dd>${esc(o.city)}${o.district ? ', ' + esc(o.district) : ''} <span class="muted small">(точный адрес — после подтверждения сделки)</span></dd>
            <dt>Бюджет</dt><dd>${o.budget_visible && o.budget_minor ? money(o.budget_minor) : 'не указан'}</dd>
            <dt>Заказчик</dt><dd>${cust.type === 'PERSON' ? 'Частное лицо' : esc(cust.name)}</dd>
            <dt>Предложений</dt><dd>${offerCount}</dd>
            <dt>Приём до</dt><dd>${dateTime(o.deadline_at)}</dd></dl>
          ${o.description ? `<div class="divider"></div><p style="white-space:pre-wrap;margin:0">${esc(o.description)}</p>` : ''}
        </div>
        ${myOffers.length ? `<div class="panel"><h2>Мои предложения по заказу</h2>${myOffers.map((f) => `<div class="row-item"><div class="grow">
          <b class="num">${money(f.total_minor)}</b> <span class="small muted">редакция №${f.rev} · ${dateTime(f.created_at)}</span>
          ${f.comment ? `<div class="small">${esc(f.comment)}</div>` : ''}</div>${status('offer', f.status)}
          ${f.status === 'SUBMITTED' && canManage() ? `<button class="btn ghost sm" data-wd="${f.id}">Отозвать</button>` : ''}</div>`).join('')}</div>` : ''}
      </div>
      <aside class="sticky"><div class="panel"><h2>${active ? 'Ваше предложение отправлено' : 'Ваше предложение'}</h2>
        ${active?.status === 'SUBMITTED' ? `<div class="banner ok" style="display:block">
            <div class="price-big num" style="font-size:22px">${money(active.total_minor)}</div>
            <div class="small">${esc(myEq.find((e) => e.id === active.equipment_id)?.title || '')} · ${active.with_operator ? 'с оператором' : 'без оператора'} · редакция №${active.rev}</div>
            ${active.comment ? `<p class="small" style="margin:6px 0 0;white-space:pre-wrap">${esc(active.comment)}</p>` : ''}
            <div class="small muted" style="margin-top:6px">Заказчик получил уведомление. Ждём его решения.</div></div>
          ${open && canManage() ? '<button class="btn ghost wide" id="editOffer">Изменить предложение</button>' : ''}` : ''}
        ${!open ? '<div class="banner warn">Приём предложений закрыт.</div>'
        : !canManage() ? '<div class="banner info">У вас роль только для просмотра. Отправлять предложения могут владелец, администратор и менеджер.</div>'
        : !myEq.length ? `<div class="banner warn">Нет опубликованной техники категории «${esc(o.categories?.name)}». <a href="#/fleet/new">Добавить</a></div>`
        : active?.status === 'SELECTED' ? '<div class="banner ok">Заказчик выбрал ваше предложение — подтвердите сделку в разделе «Сделки».</div>'
        : `<form id="of" class="${active ? 'hidden' : ''}" ${active ? 'data-nodraft' : ''}>
          <label class="f"><span>Техника <i>*</i></span><select class="inp" name="eq" required>
            ${myEq.map((e) => `<option value="${e.id}" ${busyMap[e.id] ? 'disabled' : ''}>${esc(e.title)}${busyMap[e.id] ? ' — занята' : ''}</option>`).join('')}</select></label>
          <label class="f"><span>Формат</span><select class="inp" name="op"></select></label>
          <label class="f"><span>Стоимость за весь период, ₽ <i>*</i></span><input class="inp" name="total" type="number" min="1" step="1" max="1000000000" required>
            <div class="hint" id="sugg"></div></label>
          <label class="f"><span>Комментарий</span><textarea class="inp" name="comment" maxlength="2000" placeholder="Что входит, когда сможете приехать, особые условия"></textarea></label>
          <div class="form-error hidden" id="err"></div>
          <button class="btn wide">${active ? 'Отправить новую редакцию' : 'Отправить предложение'}</button>
          <p class="small muted" style="margin:8px 0 0">Предложение не бронирует технику. Бронь создастся, когда заказчик его выберет.</p>
        </form>`}
      </div></aside>
    </div>`;

  app.querySelectorAll('[data-wd]').forEach((b) => b.onclick = async () => {
    try { await rpc('withdraw_offer', { p_offer: b.dataset.wd }); toast('Предложение отозвано'); route(); } catch (err) { toast(err.message, true); }
  });
  const f = app.querySelector('#of');
  if (!f) return;
  const fillFormats = async () => {
    const e = myEq.find((x) => x.id === f.eq.value);
    if (!e) return;
    const opts = [];
    if (e.with_operator && o.format !== 'WITHOUT_OPERATOR') opts.push(['1', 'С оператором']);
    if (e.without_operator && o.format !== 'WITH_OPERATOR') opts.push(['0', 'Без оператора']);
    f.op.innerHTML = opts.length ? opts.map(([v, t]) => `<option value="${v}">${t}</option>`).join('') : '<option value="">Формат не подходит заказу</option>';
    await suggest();
  };
  const suggest = async () => {
    const sg = app.querySelector('#sugg');
    if (f.op.value === '') { sg.textContent = ''; return; }
    try {
      const qt = await rpc('calc_quote', { p_eq: f.eq.value, p_start: o.start_date, p_end: o.end_date, p_with_operator: f.op.value === '1' });
      if (qt.ok) {
        sg.textContent = `По вашим тарифам: ${money(qt.total).replace(' ', ' ')}`;
        if (!f.total.value || f.total.dataset.auto === '1') { f.total.value = fromMinor(qt.total); f.total.dataset.auto = '1'; }
      } else sg.textContent = qt.error;
    } catch { sg.textContent = ''; }
  };
  f.total.addEventListener('input', () => { f.total.dataset.auto = '0'; });
  // Изменение отправленного предложения: форма открывается по кнопке и заполняется текущей редакцией
  if (active) { f.eq.value = active.equipment_id; f.total.value = fromMinor(active.total_minor); f.comment.value = active.comment || ''; f.total.dataset.auto = '0'; }
  app.querySelector('#editOffer')?.addEventListener('click', (ev) => { f.classList.remove('hidden'); ev.currentTarget.remove(); f.total.focus(); });
  f.eq.addEventListener('change', fillFormats);
  f.op.addEventListener('change', suggest);
  fillFormats();
  f.onsubmit = (ev) => {
    ev.preventDefault();
    busy(f.querySelector('button'), async () => {
      try {
        await rpc('submit_offer', { p_org: state.org.id, p_order: id, p_eq: f.eq.value, p_with_operator: f.op.value === '1',
          p_total: toMinor(f.total.value), p_comment: f.comment.value });
        toast('Предложение отправлено заказчику'); route();
      } catch (err) { const el = app.querySelector('#err'); el.textContent = err.message; el.classList.remove('hidden'); }
    });
  };
}

async function myOffers(app) {
  let rows;
  try { rows = await q(sb.from('offers').select('*, orders(id,title,city,start_date,end_date,status), equipment(title,photos)').eq('provider_org_id', state.org.id).order('created_at', { ascending: false }).limit(200)); }
  catch (err) { app.innerHTML = errorState(err); return; }
  app.innerHTML = `<div class="page-head"><div><h1>Мои предложения</h1><p>История ответов на заказы и их результат.</p></div>${state.org.can_provide ? '<a class="btn" href="#/feed">Лента заказов</a>' : ''}</div>
    ${rows.length ? `<div class="panel">${rows.map((f) => { const p = photoOf(f.equipment || {}); return `<a class="row-item" href="#/feed/${f.order_id}">
      ${p ? `<img src="${esc(p.url)}" alt="" referrerpolicy="no-referrer">` : '<img alt="">'}
      <div class="grow"><b>${esc(f.orders?.title)}</b><div class="small muted">${esc(f.equipment?.title)} · ${esc(f.orders?.city)} · ${date(f.orders?.start_date)} — ${date(f.orders?.end_date)}</div>
      <div class="small num">${money(f.total_minor)} · редакция №${f.rev}</div></div>${status('offer', f.status)}</a>`; }).join('')}</div>`
    : emptyState('Предложений пока нет', 'Откройте ленту заказов и ответьте на подходящий заказ.', state.org.can_provide ? '<a class="btn" href="#/feed">Лента заказов</a>' : '')}`;
}
