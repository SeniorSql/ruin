// Сделки: список и рабочее пространство сделки (SCR-DEAL-01, D100)
import { sb, state, q, rpc, canManage, refreshCounters } from '../api.js';
import { esc, money, status, toast, busy, askReason, confirmBox, emptyState, errorState, period, dateTime, timeLeft, photoOf,
  POLICY, ORG_TYPE } from '../ui.js';
import { breakdownHtml } from './item.js';
import { mountChat } from '../chat.js';
import { route, refreshShell } from '../app.js';

export async function render(app, params, query, pattern) {
  if (pattern === 'deals') return list(app, query);
  return detail(app, params.id);
}

async function list(app, query) {
  const o = state.org;
  const tab = query.tab || (o.can_order ? 'customer' : 'provider');
  let rows;
  try {
    rows = await q(sb.from('deals').select('*, equipment(title,photos), cust:organizations!deals_customer_org_id_fkey(name,type), prov:organizations!deals_provider_org_id_fkey(name)')
      .eq(tab === 'customer' ? 'customer_org_id' : 'provider_org_id', o.id).order('created_at', { ascending: false }).limit(200));
  } catch (err) { app.innerHTML = errorState(err); return; }
  const needAction = (d) => (tab === 'provider' && ['AWAITING_CONFIRMATION', 'CONFIRMED', 'IN_PROGRESS'].includes(d.status))
    || (tab === 'customer' && d.status === 'COMPLETION_PENDING');
  app.innerHTML = `
    <div class="page-head"><div><h1>Сделки</h1><p>Брони и сделки по заказам. Сначала — те, где нужно ваше действие.</p></div></div>
    ${o.can_order && o.can_provide ? `<div class="tabs"><a href="#/deals?tab=customer" class="${tab === 'customer' ? 'on' : ''}">Я заказчик</a><a href="#/deals?tab=provider" class="${tab === 'provider' ? 'on' : ''}">Я исполнитель</a></div>` : ''}
    ${rows.length ? `<div class="panel">${rows.sort((a, b) => needAction(b) - needAction(a)).map((d) => {
      const p = photoOf(d.equipment || {});
      const other = tab === 'customer' ? d.prov?.name : (d.cust?.type === 'PERSON' ? 'Частное лицо' : d.cust?.name);
      return `<a class="row-item" href="#/deals/${d.id}">${p ? `<img src="${esc(p.url)}" alt="" referrerpolicy="no-referrer">` : '<img alt="">'}
        <div class="grow"><b>${esc(d.number)} · ${esc(d.equipment?.title)}</b><div class="small muted">${esc(other || '')} · ${period(d.start_date, d.end_date)}</div>
        <div class="small num">${money(d.total_minor)}</div>
        ${needAction(d) ? '<div class="small" style="color:#9a3412;font-weight:700">Нужно ваше действие</div>' : ''}</div>${status('deal', d.status)}</a>`;
    }).join('')}</div>`
    : emptyState('Сделок пока нет', tab === 'customer' ? 'Забронируйте технику в каталоге или разместите заказ.' : 'Сделки появятся, когда заказчики забронируют вашу технику или выберут ваше предложение.',
      tab === 'customer' ? '<a class="btn" href="#/catalog">В каталог</a>' : '<a class="btn" href="#/feed">Лента заказов</a>')}`;
}

async function detail(app, id) {
  let d, events, priv, conv;
  try {
    d = await q(sb.from('deals').select('*, equipment(id,title,photos,brand,model,year,city), cust:organizations!deals_customer_org_id_fkey(id,name,type,inn), prov:organizations!deals_provider_org_id_fkey(id,name,type,inn,verification_status)').eq('id', id).maybeSingle());
    if (!d) { app.innerHTML = emptyState('Сделка не найдена', 'Возможно, она относится к другой организации — переключите контекст слева.'); return; }
    [events, priv, conv] = await Promise.all([
      q(sb.from('deal_events').select('*').eq('deal_id', id).order('ts')),
      rpc('get_deal_private', { p_deal: id }),
      q(sb.from('conversations').select('id').eq('deal_id', id).eq('type', 'DEAL').maybeSingle())
    ]);
  } catch (err) { app.innerHTML = errorState(err); return; }

  const amCust = state.org.id === d.customer_org_id;
  const amProv = state.org.id === d.provider_org_id;
  if (!amCust && !amProv) {
    app.innerHTML = emptyState('Переключите организацию', 'Эта сделка относится к другой вашей организации. Выберите её в меню слева.');
    return;
  }
  const act = canManage();
  const p = photoOf(d.equipment || {});
  const next = nextStep(d, amCust, amProv);

  app.innerHTML = `
    <div class="crumbs"><a href="#/deals">Сделки</a> › <b>${esc(d.number)}</b></div>
    <div class="page-head"><div><h1>Сделка ${esc(d.number)}</h1><div style="margin-top:6px">${status('deal', d.status)}
      <span class="muted small">· вы ${amCust ? 'заказчик' : 'исполнитель'}</span></div></div></div>
    <div class="next"><div><small>ЧТО ДАЛЬШЕ</small><b>${next.text}</b>${next.timer ? `<div class="small" style="color:#c4c7c1;margin-top:4px">Осталось: <span class="timer">${timeLeft(next.timer)}</span></div>` : ''}</div>
      <div class="actions">${act ? next.buttons : '<span class="small">Действия доступны ролям владелец, администратор, менеджер</span>'}</div></div>
    <div class="cols">
      <div>
        <div class="panel"><div class="row-item" style="padding-top:0">${p ? `<img src="${esc(p.url)}" alt="" referrerpolicy="no-referrer">` : ''}
          <div class="grow"><b><a href="#/item/${d.equipment_id}">${esc(d.equipment?.title)}</a></b>
          <div class="small muted">${esc(d.equipment?.brand)} ${esc(d.equipment?.model)}${d.equipment?.year ? ', ' + d.equipment.year : ''}</div></div></div>
          <dl class="kv"><dt>Период</dt><dd>${period(d.start_date, d.end_date)}</dd><dt>Формат</dt><dd>${d.with_operator ? 'с оператором' : 'без оператора'}</dd>
            <dt>Источник</dt><dd>${d.source === 'CATALOG' ? 'бронь из каталога' : `<a href="#/${amCust ? 'orders' : 'feed'}/${d.order_id}">заказ на бирже</a>`}</dd>
            <dt>Отмена</dt><dd>${esc(POLICY[d.cancel_policy] || '')}</dd>
            <dt>Оплата</dt><dd>напрямую исполнителю, платформа деньги не принимает</dd>
            ${d.customer_comment ? `<dt>Комментарий</dt><dd style="white-space:pre-wrap">${esc(d.customer_comment)}</dd>` : ''}
            ${d.cancel_reason ? `<dt>Причина отмены</dt><dd>${esc(reasonText(d.cancel_reason))}</dd>` : ''}</dl>
          <h3 style="margin-top:16px">Стоимость</h3>${breakdownHtml(d.breakdown)}
        </div>
        <div id="chat">${conv ? '' : '<p class="muted">Чат недоступен</p>'}</div>
      </div>
      <aside class="sticky">
        <div class="panel"><h2>Стороны</h2>
          ${party('Заказчик', d.cust, priv?.customer, priv?.open || amCust)}
          <div class="divider"></div>
          ${party('Исполнитель', d.prov, priv?.provider, priv?.open || amProv)}
          <div class="divider"></div>
          <h3>Адрес объекта</h3>
          <p style="margin:0">${priv?.address ? esc(priv.address) : '<span class="muted">Откроется после подтверждения сделки</span>'}</p>
        </div>
        <div class="panel"><h2>История</h2><ul class="timeline">${events.map((ev) => `<li><b>${esc(EVENT[ev.type] || ev.type)}</b><div class="small muted">${dateTime(ev.ts)}</div></li>`).join('')}</ul></div>
      </aside>
    </div>`;

  const run = (fn, okText) => async (ev) => busy(ev.currentTarget, async () => {
    try { await fn(); toast(okText); await refreshCounters(); refreshShell(); route(); } catch (err) { toast(err.message, true); }
  });
  const on = (sel, h) => app.querySelector(sel)?.addEventListener('click', h);
  on('#confirmBtn', run(() => rpc('provider_confirm_deal', { p_deal: id }), 'Сделка подтверждена'));
  on('#startBtn', run(() => rpc('start_deal', { p_deal: id }), 'Отмечено: работы начались'));
  on('#finishBtn', async (ev) => {
    if (!await confirmBox('Завершить работы?', 'Заказчик получит запрос на подтверждение. Если он не ответит за 72 часа, сделка закроется автоматически.', 'Завершить')) return;
    run(() => rpc('finish_deal', { p_deal: id }), 'Запрос на завершение отправлен')(ev);
  });
  on('#acceptBtn', run(() => rpc('confirm_completion', { p_deal: id }), 'Сделка завершена'));
  on('#rejectBtn', async () => {
    const r = await askReason('Вернуть на доработку', 'Опишите, что не сделано или сделано не так. Исполнитель увидит это в чате.', 'Что не так', 'Вернуть');
    if (!r) return;
    try { await rpc('reject_completion', { p_deal: id, p_reason: r }); toast('Сделка возвращена в работу'); route(); } catch (err) { toast(err.message, true); }
  });
  on('#cancelBtn', async () => {
    const free = cancelInfo(d);
    const r = await askReason(amProv && d.status === 'AWAITING_CONFIRMATION' ? 'Отклонить бронь' : 'Отменить сделку', free,
      'Причина', amProv && d.status === 'AWAITING_CONFIRMATION' ? 'Отклонить' : 'Отменить сделку');
    if (!r) return;
    try { await rpc('cancel_deal', { p_deal: id, p_org: state.org.id, p_reason: r }); toast('Сделка отменена'); await refreshCounters(); refreshShell(); route(); }
    catch (err) { toast(err.message, true); }
  });

  if (conv) return mountChat(app.querySelector('#chat'), conv.id, 'Чат сделки');
}

function party(role, org, contacts, show) {
  return `<div class="small muted">${role}</div><b>${esc(org?.type === 'PERSON' ? org.name + ' (частное лицо)' : org?.name)}</b>
    ${org?.type && org.type !== 'PERSON' ? `<div class="small muted">${ORG_TYPE[org.type]}${org.inn ? ', ИНН ' + esc(org.inn) : ''}</div>` : ''}
    ${show && contacts ? `<div class="small" style="margin-top:6px">${contacts.contact_person ? esc(contacts.contact_person) + '<br>' : ''}
      ${contacts.phone ? `<a href="tel:${esc(contacts.phone)}">${esc(contacts.phone)}</a><br>` : ''}${contacts.email ? `<a href="mailto:${esc(contacts.email)}">${esc(contacts.email)}</a>` : ''}</div>`
      : '<div class="small muted" style="margin-top:4px">Контакты откроются после подтверждения</div>'}`;
}

// Блок «Что дальше»: одно главное действие, ответственный и таймер (D100)
function nextStep(d, amCust, amProv) {
  const cancel = (t = 'Отменить') => `<button class="btn ghost sm" id="cancelBtn" style="background:transparent;color:#fff;border-color:#ffffff44">${t}</button>`;
  switch (d.status) {
    case 'AWAITING_CONFIRMATION':
      return amProv
        ? { text: 'Подтвердите бронь — заказчик ждёт ответа', timer: d.hold_expires_at, buttons: `<button class="btn" id="confirmBtn">Подтвердить сделку</button>${cancel('Отклонить')}` }
        : { text: 'Ждём подтверждения исполнителя', timer: d.hold_expires_at, buttons: cancel('Отменить бронь') };
    case 'CONFIRMED':
      return amProv
        ? { text: `Сделка подтверждена. В день начала (${d.start_date.split('-').reverse().join('.')}) отметьте передачу техники`, buttons: `<button class="btn" id="startBtn">Техника передана, начать</button>${cancel()}` }
        : { text: 'Сделка подтверждена. Контакты и адрес открыты — согласуйте подачу в чате', buttons: cancel() };
    case 'IN_PROGRESS':
      return amProv ? { text: 'Идут работы. После окончания отметьте завершение', buttons: '<button class="btn" id="finishBtn">Работы завершены</button>' }
        : { text: 'Идут работы. Исполнитель отметит завершение', buttons: '' };
    case 'COMPLETION_PENDING':
      return amCust
        ? { text: 'Исполнитель завершил работы — подтвердите или верните на доработку', timer: new Date(new Date(d.updated_at).getTime() + 72 * 3600e3).toISOString(),
          buttons: `<button class="btn" id="acceptBtn">Подтвердить завершение</button><button class="btn ghost sm" id="rejectBtn" style="background:transparent;color:#fff;border-color:#ffffff44">Вернуть на доработку</button>` }
        : { text: 'Ждём, когда заказчик подтвердит завершение (до 72 часов)', buttons: '' };
    case 'COMPLETED': return { text: 'Сделка завершена. Спасибо за работу!', buttons: '' };
    default: return { text: 'Сделка отменена', buttons: amCust && d.order_id ? `<a class="btn" href="#/orders/${d.order_id}">Вернуться к заказу</a>` : amCust ? '<a class="btn" href="#/catalog">Найти другую технику</a>' : '' };
  }
}

function cancelInfo(d) {
  const days = { FLEXIBLE: 1, MODERATE: 3, STRICT: 7 }[d.cancel_policy] || 1;
  const startMs = new Date(d.start_date + 'T00:00:00+03:00').getTime();
  const free = startMs - Date.now() > days * 864e5;
  if (d.status === 'AWAITING_CONFIRMATION') return 'Сделка ещё не подтверждена — отмена без последствий, бронь снимется.';
  return free ? 'Отмена в бесплатный период по правилам этой сделки. Бронь снимется, обе стороны получат уведомление.'
    : `Бесплатный период по правилам «${(POLICY[d.cancel_policy] || '').split(':')[0]}» прошёл. Расчёты между сторонами — напрямую по договорённости; поздняя отмена учитывается в репутации.`;
}

const EVENT = {
  deal_created: 'Сделка создана', deal_confirmed_by_customer: 'Заказчик подтвердил условия', deal_confirmed: 'Сделка подтверждена',
  deal_cancelled: 'Сделка отменена', deal_started: 'Работы начались', deal_completion_requested: 'Исполнитель завершил работы',
  deal_completion_rejected: 'Заказчик вернул на доработку', deal_completed: 'Сделка завершена'
};
const reasonText = (r) => ({ PROVIDER_NO_RESPONSE: 'исполнитель не ответил за 12 часов' }[r] || r);
