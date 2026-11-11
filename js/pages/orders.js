// Заказчик: мои заказы, мастер заказа, предложения и сравнение (SCR-ORD-01..05)
import { sb, state, q, rpc, loadCategories, categoryById, canManage, actsAsCustomer } from '../api.js';
import { isTeam, loadTeam, assignees, memberLabel, assignFilterHtml, mountAssign, ROLE_NAME } from '../assign.js';
import { esc, money, status, toast, busy, modal, askReason, emptyState, errorState, mskToday, date, period, FORMAT, idemKey,
  dateTime, timeLeft, photoOf, initials, plural, POLICY, toMinor, offerParts } from '../ui.js';
import { go, route } from '../app.js';

export async function render(app, params, query, pattern) {
  await loadCategories();
  // Свои заказы видны, если они есть, даже когда галочку «Заказчик» сняли; новый заказ — только заказчику
  if (!(pattern === 'orders/new' ? state.org.can_order : actsAsCustomer(state.org))) {
    app.innerHTML = emptyState('Текущая организация не заказчик', 'Переключитесь на личный профиль или организацию-заказчика в меню слева, либо включите роль заказчика в настройках организации.',
      '<a class="btn" href="#/account">Настройки</a>');
    return;
  }
  if (pattern === 'orders') return list(app, query);
  if (pattern === 'orders/new') {
    if (!canManage()) {
      app.innerHTML = emptyState('Размещать заказы может менеджер', `У вас роль «${ROLE_NAME[state.org.role] || state.org.role}» — только просмотр. Попросите владельца или администратора организации изменить роль в разделе «Сотрудники».`, '<a class="btn ghost" href="#/orders">Мои заказы</a>');
      return;
    }
    return create(app, query);
  }
  return detail(app, params.id);
}

async function list(app, query = {}) {
  let rows;
  try { rows = await q(sb.from('orders').select('*, categories(name)').eq('customer_org_id', state.org.id).order('created_at', { ascending: false }).limit(200)); }
  catch (err) { app.innerHTML = errorState(err); return; }
  // Команда: ответственные за заказы и фильтр «Мои / Без ответственного»
  const team = await isTeam() ? await loadTeam() : null;
  const asg = team ? await assignees('ORDER', rows.map((o) => o.id)) : {};
  const live = (o) => ['PUBLISHED', 'OFFERS_RECEIVED', 'NEGOTIATION'].includes(o.status);
  const who = team ? (query.who || 'all') : 'all';
  const cnt = team ? { mine: rows.filter((o) => live(o) && asg[o.id] === state.user.id).length, none: rows.filter((o) => live(o) && !asg[o.id]).length } : {};
  if (who === 'mine') rows = rows.filter((o) => asg[o.id] === state.user.id);
  if (who === 'none') rows = rows.filter((o) => !asg[o.id]);
  const counts = await Promise.all(rows.map((o) => rpc('order_offer_count', { p_order: o.id }).catch(() => 0)));
  app.innerHTML = `
    <div class="page-head"><div><h1>Мои заказы</h1><p>Опишите задачу — проверенные исполнители пришлют предложения.</p></div>
      ${canManage() && state.org.can_order ? '<a class="btn" href="#/orders/new">+ Разместить заказ</a>' : ''}</div>
    ${!state.org.can_order ? '<div class="banner warn">У организации выключена роль заказчика — новые заказы размещать нельзя. Включить роль можно в <a href="#/account">Профиле и организациях</a>.</div>' : ''}
    ${team ? assignFilterHtml(who, '#/orders', cnt) : ''}
    ${rows.length ? `<div class="panel"><table class="table resp"><thead><tr><th>Заказ</th><th>Даты</th><th>Предложений</th>${team ? '<th>Ответственный</th>' : ''}<th>Статус</th></tr></thead><tbody>
      ${rows.map((o, i) => `<tr class="click" data-hash="#/orders/${o.id}"><td><b>${esc(o.title)}</b><div class="small muted">${esc(o.categories?.name)} · ${esc(o.city)}${o.visibility === 'DIRECT' ? ' · личный запрос' : ''}</div></td>
        <td class="small">${date(o.start_date)} — ${date(o.end_date)}</td><td><b>${counts[i]}</b></td>
        ${team ? `<td class="small">${asg[o.id] ? esc(memberLabel(team, asg[o.id])) : live(o) ? '<span class="chip warn">не назначен</span>' : '—'}</td>` : ''}<td>${status('order', o.status)}</td></tr>`).join('')}
      </tbody></table></div>`
    : who !== 'all' ? emptyState(who === 'mine' ? 'У вас нет своих заказов' : 'Все заказы распределены', 'Откройте вкладку «Все», чтобы увидеть заказы коллег.', '<a class="btn ghost" href="#/orders">Все заказы</a>')
    : emptyState('Заказов пока нет', 'Разместите первый заказ: укажите технику, даты и адрес. Исполнители пришлют цены, вы выберете лучшее.', state.org.can_order ? '<a class="btn" href="#/orders/new">Разместить заказ</a>' : '')}`;
}

function create(app, query) {
  const cats = state.categories;
  app.innerHTML = `
    <div class="crumbs"><a href="#/orders">Мои заказы</a> › <b>Новый заказ</b></div>
    <div class="page-head"><div><h1>Разместить заказ</h1><p>Заказ увидят проверенные исполнители с подходящей техникой. Точный адрес — только тот, с кем заключите сделку.</p></div></div>
    <form id="of" class="cols">
      <div>
        <div class="panel"><h2>Что нужно</h2>
          <label class="f"><span>Категория техники <i>*</i></span><select class="inp" name="cat" required><option value="">Выберите</option>
            ${cats.map((c) => `<option value="${c.id}" ${c.code === query.cat ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
          <label class="f"><span>Коротко о задаче <i>*</i></span><input class="inp" name="title" required minlength="3" maxlength="150" title="От 3 до 150 символов" placeholder="Например: выкопать котлован 10×12 м"></label>
          <div class="grid2">
            <label class="f"><span>Количество единиц</span><input class="inp" name="qty" type="number" min="1" max="50" value="1"></label>
            <label class="f"><span>Формат</span><select class="inp" name="format"><option value="ANY">Не важно</option><option value="WITH_OPERATOR">С оператором</option><option value="WITHOUT_OPERATOR">Без оператора</option></select></label>
          </div>
          <label class="f"><span>Подробности</span><textarea class="inp" name="desc" maxlength="3000" rows="5" placeholder="Объём работ, требования к технике (глубина копания, грузоподъёмность), график, условия подъезда"></textarea>
            <div class="hint">Без телефонов и ссылок — контакты откроются после подтверждения сделки.</div></label>
        </div>
        <div class="panel"><h2>Где и когда</h2>
          <div class="grid2">
            <label class="f"><span>Начало <i>*</i></span><input class="inp" type="date" name="start" required min="${mskToday(1)}" value="${mskToday(1)}"></label>
            <label class="f"><span>Окончание <i>*</i></span><input class="inp" type="date" name="end" required min="${mskToday(1)}" value="${mskToday(1)}"></label>
            <label class="f"><span>Город или посёлок <i>*</i></span><input class="inp" name="city" required maxlength="100" placeholder="Например: Подольск" value="${esc(state.org.city || '')}"></label>
            <label class="f"><span>Район</span><input class="inp" name="district" maxlength="100" placeholder="Необязательно"></label>
          </div>
          <label class="f"><span>Точный адрес <i>*</i></span><input class="inp" name="address" required maxlength="300">
            <div class="hint">Увидит только исполнитель, с которым будет подтверждена сделка.</div></label>
        </div>
      </div>
      <aside class="sticky"><div class="panel"><h2>Условия</h2>
        <label class="f"><span>Бюджет, ₽</span><input class="inp" name="budget" type="number" min="0" step="1" max="1000000000"></label>
        <label class="check"><input type="checkbox" name="budget_visible"> <span>Показывать бюджет исполнителям</span></label>
        <label class="f"><span>Собирать предложения</span><select class="inp" name="deadline">
          <option value="24">24 часа</option><option value="72" selected>3 дня</option><option value="168">7 дней</option><option value="336">14 дней</option></select></label>
        <div class="banner info small">Заказ от имени: <b>&nbsp;${esc(state.org.type === 'PERSON' ? 'вы как частное лицо' : state.org.name)}</b></div>
        <div class="form-error hidden" id="err"></div>
        <button class="btn wide">Опубликовать заказ</button>
      </div></aside>
    </form>`;
  const f = app.querySelector('#of');
  f.onsubmit = (e) => {
    e.preventDefault();
    if (f.end.value < f.start.value) { f.end.value = f.start.value; }
    busy(f.querySelector('button'), async () => {
      try {
        const id = await rpc('create_order', {
          p_org: state.org.id, p_title: f.title.value, p_description: f.desc.value, p_category: Number(f.cat.value),
          p_qty: Number(f.qty.value || 1), p_format: f.format.value, p_start: f.start.value, p_end: f.end.value,
          p_city: f.city.value, p_district: f.district.value || null, p_address: f.address.value,
          p_budget: f.budget.value ? toMinor(f.budget.value) : null, p_budget_visible: f.budget_visible.checked,
          p_deadline_hours: Number(f.deadline.value), p_equipment: null });
        toast('Заказ опубликован'); go('#/orders/' + id);
      } catch (err) { const el = app.querySelector('#err'); el.textContent = err.message; el.classList.remove('hidden'); }
    });
  };
}

async function detail(app, id) {
  let o, offers, priv;
  try {
    o = await q(sb.from('orders').select('*, categories(name,code)').eq('id', id).maybeSingle());
    if (!o || o.customer_org_id !== state.org.id) {
      app.innerHTML = emptyState('Заказ не найден', 'Возможно, он размещён от имени другой организации — переключите контекст слева.');
      return;
    }
    [offers, priv] = await Promise.all([
      q(sb.from('offers').select('*, equipment(id,title,photos,brand,model,year,specs,cancel_policy), organizations(id,name,verification_status)')
        .eq('order_id', id).order('created_at', { ascending: false })),
      q(sb.from('order_private').select('*').eq('order_id', id).maybeSingle())
    ]);
  } catch (err) { app.innerHTML = errorState(err); return; }
  const active = offers.filter((f) => ['SUBMITTED', 'SELECTED', 'ACCEPTED'].includes(f.status));
  const other = offers.filter((f) => !active.includes(f));
  const stats = Object.fromEntries(await Promise.all(active.map(async (f) => [f.provider_org_id, await rpc('public_org_stats', { p_org: f.provider_org_id }).catch(() => ({}))])));
  const deal = o.status === 'NEGOTIATION' || o.status === 'CONVERTED_TO_DEAL'
    ? await q(sb.from('deals').select('id,number,status').eq('order_id', id).neq('status', 'CANCELLED').maybeSingle()) : null;
  const cheapest = Math.min(...active.filter((f) => f.status === 'SUBMITTED').map((f) => f.total_minor));
  const canCancel = ['PUBLISHED', 'OFFERS_RECEIVED'].includes(o.status) && canManage();
  const pending = active.filter((f) => f.status === 'SUBMITTED' && f.dates_pending).length;
  const startPassed = o.start_date <= mskToday(0);

  app.innerHTML = `
    <div class="crumbs"><a href="#/orders">Мои заказы</a> › <b>${esc(o.title)}</b></div>
    <div class="page-head"><div><h1>${esc(o.title)}</h1><div style="margin-top:6px">${status('order', o.status)}
      ${o.visibility === 'DIRECT' ? '<span class="st gray">Личный запрос</span>' : ''}</div></div>
      ${canCancel ? '<button class="btn danger" id="cancelBtn">Отменить заказ</button>' : ''}</div>
    ${deal ? `<div class="next"><div><small>ЧТО ДАЛЬШЕ</small><b>Сделка ${esc(deal.number)}: ${deal.status === 'AWAITING_CONFIRMATION' ? 'ждём подтверждения исполнителя' : 'перейдите в сделку'}</b></div><a class="btn" href="#/deals/${deal.id}">Открыть сделку</a></div>` : ''}
    <div id="assign"></div>
    ${!canManage() ? `<div class="banner info">У вас роль «${ROLE_NAME[state.org.role] || state.org.role}» — только просмотр. Выбирать предложения и отменять заказ могут владелец, администратор и менеджер.</div>` : ''}
    ${['PUBLISHED', 'OFFERS_RECEIVED'].includes(o.status) ? `<div class="banner info">Приём предложений: ${new Date(o.deadline_at) > Date.now() ? 'ещё ' + timeLeft(o.deadline_at) : 'завершён — выберите предложение'}.</div>` : ''}
    ${['PUBLISHED', 'OFFERS_RECEIVED'].includes(o.status) && o.start_date <= mskToday(0) ? `<div class="banner warn" style="display:block"><b>Дата начала заказа уже прошла.</b>
      Измените даты — исполнители получат уведомление и подтвердят, что техника свободна. После подтверждения предложение можно выбрать. Срок аренды и цена останутся прежними.
      Если даты не изменить, заказ закроется ${date(addDays(o.start_date, 4))}.
      ${canManage() ? '<div style="margin-top:8px"><button class="btn sm" data-resched>Изменить даты</button></div>' : ''}</div>` : ''}
    ${pending ? `<div class="banner info">Ждём подтверждения новых дат от исполнителей: ${pending} ${plural(pending, 'предложение', 'предложения', 'предложений')}. Выбрать предложение можно после подтверждения.</div>` : ''}
    <div class="cols">
      <div>
        <div class="panel"><h2>Предложения ${active.length ? `<span class="muted">(${active.length})</span>` : ''}</h2>
          ${active.length ? `${active.length > 1 ? `<div class="actions" style="margin:-4px 0 10px"><label class="small muted">Порядок:
              <select class="inp" id="cmpSort" style="width:auto;display:inline-block">
                <option value="price">сначала дешевле</option><option value="deals">больше завершённых сделок</option><option value="new">сначала новые</option></select></label></div>` : ''}
            <div id="cmp"></div>` : `<div class="empty"><b>Пока нет предложений</b>Исполнители получили уведомление. Обычно первые предложения приходят в течение нескольких часов.
            <div><a class="btn ghost" href="#/catalog?cat=${o.categories?.code}">Посмотреть технику в каталоге</a></div></div>`}
        </div>
        ${other.length ? `<div class="panel"><h3>Неактивные предложения</h3>${other.map((f) => `<div class="row-item"><div class="grow"><b>${esc(f.organizations?.name)}</b>
          <span class="small muted">${esc(f.equipment?.title)} · ${money(f.total_minor)}</span></div>${status('offer', f.status)}</div>`).join('')}</div>` : ''}
      </div>
      <aside class="sticky"><div class="panel"><h2>Детали заказа</h2>
        <dl class="kv"><dt>Техника</dt><dd>${esc(o.categories?.name)}, ${o.qty} шт.</dd><dt>Формат</dt><dd>${FORMAT[o.format]}</dd>
          <dt>Даты</dt><dd>${period(o.start_date, o.end_date)}${['PUBLISHED', 'OFFERS_RECEIVED'].includes(o.status) && canManage()
            ? '<div><button class="btn ghost sm" data-resched style="margin-top:4px">Изменить даты</button></div>' : ''}</dd><dt>Город</dt><dd>${esc(o.city)}${o.district ? ', ' + esc(o.district) : ''}</dd>
          <dt>Адрес</dt><dd>${esc(priv?.address_exact || '—')}</dd>
          <dt>Бюджет</dt><dd>${o.budget_minor ? money(o.budget_minor) + (o.budget_visible ? '' : ' (скрыт)') : 'не указан'}</dd>
          <dt>Создан</dt><dd>${dateTime(o.created_at)}</dd></dl>
        ${o.description ? `<div class="divider"></div><p style="white-space:pre-wrap;margin:0" class="small">${esc(o.description)}</p>` : ''}
      </div></aside>
    </div>`;

  mountAssign(app.querySelector('#assign'), 'ORDER', id).catch(() => {});
  app.querySelector('#cancelBtn')?.addEventListener('click', async () => {
    const r = await askReason('Отменить заказ?', 'Исполнители получат уведомление, их предложения закроются.', 'Причина', 'Отменить заказ');
    if (!r) return;
    try { await rpc('cancel_order', { p_order: id, p_reason: r }); toast('Заказ отменён'); route(); } catch (err) { toast(err.message, true); }
  });
  app.querySelectorAll('[data-resched]').forEach((b) => b.onclick = () => rescheduleDialog(o, active.some((f) => f.status === 'SUBMITTED')));
  const bind = (root) => {
    if (!canManage()) root.querySelectorAll('[data-select],[data-decline]').forEach((b) => b.remove());
    root.querySelectorAll('[data-select]').forEach((b) => b.onclick = () => selectDialog(o, active.find((f) => f.id === b.dataset.select)));
    root.querySelectorAll('[data-decline]').forEach((b) => b.onclick = async () => {
      try { await rpc('decline_offer', { p_offer: b.dataset.decline }); toast('Предложение отклонено'); route(); } catch (err) { toast(err.message, true); }
    });
    root.querySelectorAll('[data-chat]').forEach((b) => b.onclick = async () => {
      try { const c = await rpc('open_conversation', { p_org: state.org.id, p_equipment: null, p_order: id, p_provider: b.dataset.chat }); go('#/messages/' + c); }
      catch (err) { toast(err.message, true); }
    });
  };
  bind(app);
  // Сравнение предложений: порядок и показ по 5 штук, чтобы при большом числе откликов таблица оставалась читаемой
  const cmp = app.querySelector('#cmp');
  if (cmp) {
    const PAGE = 5;
    let shown = PAGE;
    const sortSel = app.querySelector('#cmpSort');
    const draw = () => {
      const key = sortSel?.value || 'price';
      const done = (f) => stats[f.provider_org_id]?.completed ?? 0;
      const sorted = [...active].sort((a, b) => (a.status === 'SUBMITTED') - (b.status === 'SUBMITTED')
        || (key === 'deals' ? done(b) - done(a) || a.total_minor - b.total_minor
          : key === 'new' ? new Date(b.created_at) - new Date(a.created_at)
          : a.total_minor - b.total_minor));
      const rest = sorted.length - shown;
      cmp.innerHTML = compareTable(sorted.slice(0, shown), stats, cheapest, startPassed)
        + (rest > 0 ? `<button class="btn ghost wide" id="cmpMore" style="margin-top:10px">Показать ещё ${Math.min(PAGE, rest)} (осталось ${rest})</button>` : '');
      cmp.querySelector('#cmpMore')?.addEventListener('click', () => { shown += PAGE; draw(); });
      bind(cmp);
    };
    sortSel?.addEventListener('change', () => { shown = PAGE; draw(); });
    draw();
  }
}

// Сравнение предложений: одинаковый набор строк для всех (F1)
function compareTable(list, stats, cheapest, startPassed) {
  const cell = (f, html) => `<td>${html}</td>`;
  // Первая колонка (названия строк) закреплена — при прокрутке вбок видно, что сравниваем
  const head = 'position:sticky;left:0;z-index:1;background:var(--panel);min-width:96px;max-width:130px';
  const row = (label, fn) => `<tr><th style="${head}">${label}</th>${list.map((f) => cell(f, fn(f))).join('')}</tr>`;
  return `<div style="overflow-x:auto"><table class="table" style="min-width:${130 + list.length * 190}px">
    <thead><tr><th style="${head}"></th>${list.map((f) => {
      const p = photoOf(f.equipment || {});
      return `<th style="vertical-align:top">${p ? `<img src="${esc(p.url)}" alt="" style="width:100%;height:90px;object-fit:cover;border-radius:8px" referrerpolicy="no-referrer">` : ''}
        <a href="#/item/${f.equipment_id}" target="_blank" style="color:var(--ink);font-size:14px">${esc(f.equipment?.title)}</a></th>`;
    }).join('')}</tr></thead>
    <tbody>
      ${row('Итого к оплате', (f) => `<b class="num" style="font-size:18px">${money(f.total_minor)}</b>${f.total_minor === cheapest && list.length > 1 ? '<div><span class="st ok">Лучшая цена</span></div>' : ''}`)}
      ${row('Аренда', (f) => offerParts(f).mode ? `<span class="num">${money(offerParts(f).rent)}</span>` : '<span class="small muted">в итоге</span>')}
      ${row('Доставка', (f) => `<span class="small${offerParts(f).mode === 'PAID' ? '' : ' muted'}">${offerParts(f).mode === 'PAID' ? `<b class="num">${money(offerParts(f).delivery)}</b><br>оплачивает заказчик` : esc(offerParts(f).text)}</span>`)}
      ${row('Исполнитель', (f) => `<b>${esc(f.organizations?.name)}</b><div>${status('org', f.organizations?.verification_status)}</div>`)}
      ${row('Завершённых сделок', (f) => String(stats[f.provider_org_id]?.completed ?? 0))}
      ${row('Формат', (f) => f.with_operator ? 'С оператором' : 'Без оператора')}
      ${row('Техника', (f) => `${esc(f.equipment?.brand)} ${esc(f.equipment?.model)}${f.equipment?.year ? ', ' + f.equipment.year : ''}`)}
      ${row('Условия отмены', (f) => esc(POLICY[f.equipment?.cancel_policy] || '—'))}
      ${row('Комментарий', (f) => `<span class="small">${esc(f.comment || '—')}</span>`)}
      ${row('Действует до', (f) => `<span class="small">${dateTime(f.expires_at)}</span>`)}
      ${row('Редакция', (f) => `№${f.rev}`)}
      ${row('', (f) => f.status === 'SUBMITTED' ? `<div class="actions" style="flex-direction:column;align-items:stretch">
        ${f.dates_pending ? '<span class="st wait">Ждёт подтверждения дат</span>'
          : startPassed ? '<span class="small muted">Сначала измените даты</span>'
          : `<button class="btn sm" data-select="${f.id}">Выбрать</button>`}
        <button class="btn ghost sm" data-decline="${f.id}">Отклонить</button></div>` : status('offer', f.status))}
    </tbody></table></div>`;
}

// Дата YYYY-MM-DD плюс n дней
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

function selectDialog(o, f) {
  const key = idemKey();
  const p = offerParts(f);
  // Даты заказа уже согласованы с исполнителем (SQL 26): перенос — через «Изменить даты» и подтверждение исполнителя
  const m = modal(`<h2>Выбрать предложение</h2>
    <p class="muted" style="margin-top:-6px">${esc(f.organizations?.name)} · ${esc(f.equipment?.title)}</p>
    <dl class="kv"><dt>Даты</dt><dd>${period(o.start_date, o.end_date)}</dd><dt>Формат</dt><dd>${f.with_operator ? 'с оператором' : 'без оператора'}</dd>
      ${p.mode ? `<dt>Аренда</dt><dd class="num">${money(p.rent)}</dd>` : ''}
      <dt>Доставка</dt><dd>${esc(p.text)}</dd>
      <dt>Итого к оплате</dt><dd class="num" style="font-size:18px">${money(f.total_minor)}</dd><dt>Условия отмены</dt><dd>${esc(POLICY[f.equipment?.cancel_policy] || '')}</dd>
      <dt>Оплата</dt><dd>напрямую исполнителю</dd></dl>
    ${f.comment ? `<p class="small" style="white-space:pre-wrap"><b>Комментарий исполнителя:</b> ${esc(f.comment)}</p>` : ''}
    <div class="banner info" style="margin-top:14px">Техника забронируется на ваши даты. Исполнитель подтвердит сделку в течение 12 часов — после этого откроются контакты и адрес.</div>
    <label class="check"><input type="checkbox" id="agree"> <span>Подтверждаю условия предложения и <a href="#/terms" target="_blank">правила сервиса</a></span></label>
    <div class="form-error hidden" id="err"></div>
    <button class="btn wide" id="go">Выбрать и забронировать</button>`);
  m.el.querySelector('#go').onclick = (ev) => {
    const err = m.el.querySelector('#err');
    if (!m.el.querySelector('#agree').checked) { err.textContent = 'Подтвердите условия'; err.classList.remove('hidden'); return; }
    busy(ev.currentTarget, async () => {
      try {
        const r = await rpc('select_offer', { p_offer: f.id, p_key: key, p_start: null });
        if (!r.ok) { const el = m.el.querySelector('#err'); el.textContent = r.error; el.classList.remove('hidden'); setTimeout(route, 2500); return; }
        m.close(); toast('Предложение выбрано, ждём подтверждения исполнителя'); go('#/deals/' + r.deal_id);
      } catch (err) { const el = m.el.querySelector('#err'); el.textContent = err.message; el.classList.remove('hidden'); }
    });
  };
}

// Изменение дат заказа (SQL 26): срок аренды сохраняется, исполнители подтверждают новые даты
function rescheduleDialog(o, hasOffers) {
  const len = Math.round((new Date(o.end_date) - new Date(o.start_date)) / 864e5);
  const first = o.start_date > mskToday(0) ? o.start_date : mskToday(1);
  const m = modal(`<h2>Изменить даты заказа</h2>
    <p class="muted" style="margin-top:-6px">Сейчас: ${period(o.start_date, o.end_date)}. Срок аренды останется ${len + 1} ${plural(len + 1, 'день', 'дня', 'дней')}.</p>
    <label class="f"><span>Новая дата начала <i>*</i></span><input class="inp" type="date" id="nstart" required min="${mskToday(1)}" max="${addDays(mskToday(0), 365)}" value="${first}"></label>
    <dl class="kv"><dt>Новые даты</dt><dd id="ndates"></dd></dl>
    ${hasOffers ? '<div class="banner info" style="display:block;margin-top:10px">Исполнители, приславшие предложения, получат уведомление и подтвердят, что техника свободна. Выбрать предложение можно будет после их подтверждения.</div>' : ''}
    <div class="form-error hidden" id="err"></div>
    <button class="btn wide" id="go">Сохранить новые даты</button>`);
  const ns = m.el.querySelector('#nstart');
  const show = () => { m.el.querySelector('#ndates').textContent = ns.value ? period(ns.value, addDays(ns.value, len)) : '—'; };
  ns.addEventListener('input', show); show();
  m.el.querySelector('#go').onclick = (ev) => {
    const err = m.el.querySelector('#err');
    if (!ns.value || ns.value < mskToday(1)) { err.textContent = 'Новая дата начала — не раньше завтрашнего дня'; err.classList.remove('hidden'); return; }
    if (ns.value === o.start_date) { err.textContent = 'Это прежняя дата начала — выберите другую'; err.classList.remove('hidden'); return; }
    busy(ev.currentTarget, async () => {
      try {
        const n = await rpc('reschedule_order', { p_order: o.id, p_start: ns.value });
        m.close(); toast(n ? 'Даты изменены. Ждём подтверждения исполнителей' : 'Даты изменены'); route();
      } catch (e) { err.textContent = e.message; err.classList.remove('hidden'); }
    });
  };
}
