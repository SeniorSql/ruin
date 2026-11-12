// Сделки: список и рабочее пространство сделки (SCR-DEAL-01, D100)
import { sb, state, q, rpc, canManage, refreshCounters, actsAsProvider, actsAsCustomer } from '../api.js';
import { esc, money, status, toast, busy, askReason, confirmBox, emptyState, errorState, period, dateTime, timeLeft, photoOf,
  POLICY, ORG_TYPE } from '../ui.js';
import { breakdownHtml } from './item.js';
import { renderExtras } from '../dealExtras.js';
import { renderNotes, extensionTopHtml, bindExtensionButtons, extensionDialog } from '../dealCrm.js';
import { mountChat } from '../chat.js';
import { isTeam, loadTeam, assignees, memberLabel, assignFilterHtml, mountAssign, names, shortName, ROLE_NAME } from '../assign.js';
import { route, refreshShell } from '../app.js';

export async function render(app, params, query, pattern) {
  if (pattern === 'deals') return list(app, query);
  return detail(app, params.id);
}

async function list(app, query) {
  const o = state.org;
  const tab = query.tab || (actsAsCustomer(o) ? 'customer' : 'provider');
  try { sessionStorage.setItem('ruin.dealTab', tab); } catch {}
  let rows;
  try {
    rows = await q(sb.from('deals').select('*, equipment(title,photos), cust:organizations!deals_customer_org_id_fkey(name,type), prov:organizations!deals_provider_org_id_fkey(name)')
      .eq(tab === 'customer' ? 'customer_org_id' : 'provider_org_id', o.id).order('created_at', { ascending: false }).limit(200));
  } catch (err) { app.innerHTML = errorState(err); return; }
  const extWait = state.counters.ext_wait || {};
  const needAction = (d) => (tab === 'provider' && ['AWAITING_CONFIRMATION', 'CONFIRMED', 'IN_PROGRESS'].includes(d.status))
    || (tab === 'customer' && d.status === 'COMPLETION_PENDING') || !!extWait[d.id];
  // Команда: ответственные и фильтр «Мои / Без ответственного»
  const team = await isTeam() ? await loadTeam() : null;
  const asg = team ? await assignees('DEAL', rows.map((d) => d.id)) : {};
  const live = (d) => !['COMPLETED', 'CANCELLED'].includes(d.status);
  const who = team ? (query.who || 'all') : 'all';
  const counts = team ? { mine: rows.filter((d) => live(d) && asg[d.id] === state.user.id).length, none: rows.filter((d) => live(d) && !asg[d.id]).length } : {};
  if (who === 'mine') rows = rows.filter((d) => asg[d.id] === state.user.id);
  if (who === 'none') rows = rows.filter((d) => !asg[d.id]);
  app.innerHTML = `
    <div class="page-head"><div><h1>Сделки</h1><p>Брони и сделки по заказам. Сначала — те, где нужно ваше действие.</p></div></div>
    ${actsAsCustomer(o) && actsAsProvider(o) ? `<div class="tabs"><a href="#/deals?tab=customer" class="${tab === 'customer' ? 'on' : ''}">Я заказчик</a><a href="#/deals?tab=provider" class="${tab === 'provider' ? 'on' : ''}">Я исполнитель</a></div>` : ''}
    ${team ? assignFilterHtml(who, '#/deals?tab=' + tab, counts) : ''}
    ${rows.length ? `<div class="panel">${rows.sort((a, b) => needAction(b) - needAction(a)).map((d) => {
      const p = photoOf(d.equipment || {});
      const other = tab === 'customer' ? d.prov?.name : (d.cust?.type === 'PERSON' ? 'Частное лицо' : d.cust?.name);
      return `<a class="row-item" href="#/deals/${d.id}">${p ? `<img src="${esc(p.url)}" alt="" referrerpolicy="no-referrer">` : '<img alt="">'}
        <div class="grow"><b>${esc(d.number)} · ${esc(d.equipment?.title)}</b><div class="small muted">${esc(other || '')} · ${period(d.start_date, d.end_date)}</div>
        <div class="small num">${money(d.total_minor)}</div>
        ${team ? `<div class="small">${asg[d.id] ? `<span class="chip ${asg[d.id] === state.user.id ? 'me' : ''}">Ответственный: ${esc(memberLabel(team, asg[d.id]))}</span>` : live(d) ? '<span class="chip warn">Без ответственного</span>' : ''}</div>` : ''}
        ${extWait[d.id] ? '<div class="small warn-text" style="font-weight:700">Ждёт вашего ответа: продление аренды</div>'
          : needAction(d) ? '<div class="small warn-text" style="font-weight:700">Нужно ваше действие</div>' : ''}</div>${status('deal', d.status)}</a>`;
    }).join('')}</div>`
    : who !== 'all' ? emptyState(who === 'mine' ? 'У вас нет своих сделок' : 'Все сделки распределены', 'Откройте вкладку «Все», чтобы увидеть сделки коллег.', `<a class="btn ghost" href="#/deals?tab=${tab}">Все сделки</a>`)
    : emptyState('Сделок пока нет', tab === 'customer' ? 'Забронируйте технику в каталоге или разместите заказ.' : 'Сделки появятся, когда заказчики забронируют вашу технику или выберут ваше предложение.',
      tab === 'customer' ? '<a class="btn" href="#/catalog">В каталог</a>' : (o.can_provide ? '<a class="btn" href="#/feed">Лента заказов</a>' : ''))}`;
}

async function detail(app, id) {
  let d, events, priv, conv, ext;
  try {
    d = await q(sb.from('deals').select('*, equipment(id,title,photos,brand,model,year,city), cust:organizations!deals_customer_org_id_fkey(id,name,type,inn), prov:organizations!deals_provider_org_id_fkey(id,name,type,inn,verification_status)').eq('id', id).maybeSingle());
    if (!d) { app.innerHTML = emptyState('Сделка не найдена', 'Возможно, она относится к другой организации — переключите организацию в меню под вашим именем (справа вверху).'); return; }
    [events, priv, conv, ext] = await Promise.all([
      q(sb.from('deal_events').select('*').eq('deal_id', id).order('ts')),
      rpc('get_deal_private', { p_deal: id }),
      q(sb.from('conversations').select('id').eq('deal_id', id).eq('type', 'DEAL').maybeSingle()),
      q(sb.from('deal_extensions').select('*').eq('deal_id', id).eq('status', 'REQUESTED').maybeSingle()).catch(() => null)
    ]);
  } catch (err) { app.innerHTML = errorState(err); return; }

  const amCust = state.org.id === d.customer_org_id;
  const amProv = state.org.id === d.provider_org_id;
  if (!amCust && !amProv) {
    app.innerHTML = emptyState('Переключите организацию', 'Эта сделка относится к другой вашей организации. Выберите её в меню под вашим именем (справа вверху).');
    return;
  }
  const act = canManage();
  const nm = await names(events.map((e) => e.actor_user_id));
  const orgOf = (id) => (id === d.customer_org_id ? d.cust : id === d.provider_org_id ? d.prov : null);
  const whoDid = (ev) => {
    const n = ev.actor_user_id ? (ev.actor_user_id === state.user.id ? 'Вы' : shortName(nm(ev.actor_user_id))) : '';
    const org = orgOf(ev.actor_org_id);
    const orgN = org ? (org.type === 'PERSON' ? 'частное лицо' : org.name) : '';
    return [n, orgN].filter(Boolean).join(' · ');
  };
  try { sessionStorage.setItem('ruin.dealTab', amCust ? 'customer' : 'provider'); } catch {}
  refreshShell();
  const p = photoOf(d.equipment || {});
  const next = nextStep(d, amCust, amProv);
  const activeDeal = ['CONFIRMED', 'IN_PROGRESS'].includes(d.status);
  if (ext && ext.requested_by_org !== state.org.id) next.text = 'Ответьте на предложение о продлении аренды — оно ниже';
  if (activeDeal && !ext) next.buttons += `<button class="btn ghost sm" id="extendBtn">Продлить аренду</button>`;

  app.innerHTML = `
    <div class="crumbs"><a href="#/deals">Сделки</a> › <b>${esc(d.number)}</b></div>
    <div class="page-head"><div><h1>Сделка ${esc(d.number)}</h1><div style="margin-top:6px">${status('deal', d.status)}
      <span class="muted small">· вы ${amCust ? 'заказчик' : 'исполнитель'}</span></div></div></div>
    <div class="next"><div><small>ЧТО ДАЛЬШЕ</small><b>${next.text}</b>${next.timer ? `<div class="small" style="color:#c4c7c1;margin-top:4px">Осталось: <span class="timer">${timeLeft(next.timer)}</span></div>` : ''}</div>
      <div class="actions">${act ? next.buttons : `<span class="small">У вас роль «${ROLE_NAME[state.org.role] || state.org.role}» — только просмотр. Действия доступны владельцу, администратору и менеджеру</span>`}</div></div>
    ${extensionTopHtml(ext, d, state.org.id, act)}
    <div id="assign"></div>
    <div class="cols">
      <div>
        <div class="panel"><div class="row-item" style="padding-top:0">${p ? `<img src="${esc(p.url)}" alt="" referrerpolicy="no-referrer">` : ''}
          <div class="grow"><b><a href="#/item/${d.equipment_id}">${esc(d.equipment?.title)}</a></b>
          <div class="small muted">${esc(d.equipment?.brand)} ${esc(d.equipment?.model)}${d.equipment?.year ? ', ' + d.equipment.year : ''}</div></div></div>
          <dl class="kv"><dt>Период</dt><dd>${period(d.start_date, d.end_date)}</dd><dt>Формат</dt><dd>${d.with_operator ? 'с оператором' : 'без оператора'}</dd>
            <dt>Источник</dt><dd>${d.source === 'CATALOG' ? 'бронь из каталога' : `<a href="#/${amCust ? 'orders' : 'feed'}/${d.order_id}">заказ на бирже</a>`}</dd>
            <dt>Условия отмены</dt><dd>${esc(POLICY[d.cancel_policy] || '')}</dd>
            <dt>Оплата</dt><dd>напрямую исполнителю, платформа деньги не принимает</dd>
            ${d.customer_comment ? `<dt>Комментарий</dt><dd style="white-space:pre-wrap">${esc(d.customer_comment)}</dd>` : ''}
            ${d.cancel_reason ? `<dt>Причина отмены</dt><dd>${esc(reasonText(d.cancel_reason))}</dd>` : ''}</dl>
          <h3 style="margin-top:16px">Стоимость</h3>${breakdownHtml(d.breakdown)}
        </div>
        <div id="extras"><div class="skeleton" style="height:120px;margin-top:14px"></div></div>
        <div id="chat" style="margin-top:14px">${conv ? '' : '<p class="muted">Чат недоступен</p>'}</div>
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
        <div id="notes"></div>
        <div class="panel"><h2>История</h2><ul class="timeline">${events.map((ev) => `<li><b>${esc(eventText(ev))}</b><div class="small muted">${dateTime(ev.ts)}${whoDid(ev) ? ' · ' + esc(whoDid(ev)) : ''}</div></li>`).join('')}</ul></div>
      </aside>
    </div>`;

  // Кнопку берём сразу из события: после await (окно подтверждения) ev.currentTarget уже пустой
  // Если пока вы смотрели страницу, коллега уже что-то сделал — говорим, кто и что, и обновляем
  const lastEvId = events.length ? events[events.length - 1].id : 0;
  const fail = async (err) => {
    try {
      const fresh = await q(sb.from('deal_events').select('*').eq('deal_id', id).gt('id', lastEvId).order('id', { ascending: false }).limit(1));
      if (fresh.length) {
        const ev = fresh[0];
        const nn = await names([ev.actor_user_id]);
        const by = ev.actor_user_id === state.user.id ? 'Вы' : shortName(nn(ev.actor_user_id)) || (orgOf(ev.actor_org_id) ? 'Другая сторона' : 'Система');
        toast(`Пока вы смотрели сделку, ${by === 'Вы' ? 'вы уже' : by + ' уже'}: «${eventText(ev)}». Страница обновлена`, true);
        await refreshCounters(); refreshShell(); route();
        return;
      }
    } catch {}
    toast(err.message, true);
  };
  const exec = (btn, fn, okText) => busy(btn, async () => {
    try { await fn(); toast(okText); await refreshCounters(); refreshShell(); route(); } catch (err) { fail(err); }
  });
  const run = (fn, okText) => (ev) => exec(ev.currentTarget, fn, okText);
  const on = (sel, h) => app.querySelector(sel)?.addEventListener('click', h);
  on('#confirmBtn', run(() => rpc('provider_confirm_deal', { p_deal: id }), 'Сделка подтверждена'));
  on('#startBtn', run(() => rpc('start_deal', { p_deal: id }), 'Отмечено: работы начались'));
  on('#finishBtn', async (ev) => {
    const btn = ev.currentTarget;
    if (!await confirmBox('Завершить работы?', 'Заказчик получит запрос на подтверждение. Если он не ответит за 72 часа, сделка закроется автоматически.', 'Завершить')) return;
    exec(btn, () => rpc('finish_deal', { p_deal: id }), 'Запрос на завершение отправлен');
  });
  on('#acceptBtn', run(() => rpc('confirm_completion', { p_deal: id }), 'Сделка завершена'));
  on('#rejectBtn', async () => {
    const r = await askReason('Вернуть на доработку', 'Опишите, что не сделано или сделано не так. Исполнитель увидит это в чате.', 'Что не так', 'Вернуть');
    if (!r) return;
    try { await rpc('reject_completion', { p_deal: id, p_reason: r }); toast('Сделка возвращена в работу'); route(); } catch (err) { fail(err); }
  });
  on('#cancelBtn', async () => {
    const free = cancelInfo(d);
    const r = await askReason(amProv && d.status === 'AWAITING_CONFIRMATION' ? 'Отклонить бронь' : 'Отменить сделку', free,
      'Причина', amProv && d.status === 'AWAITING_CONFIRMATION' ? 'Отклонить' : 'Отменить сделку');
    if (!r) return;
    try { await rpc('cancel_deal', { p_deal: id, p_org: state.org.id, p_reason: r }); toast('Сделка отменена'); await refreshCounters(); refreshShell(); route(); }
    catch (err) { fail(err); }
  });

  const extDone = async (msg) => { toast(msg); await refreshCounters(); refreshShell(); route(); };
  bindExtensionButtons(app.querySelector('.ext-top') || document.createElement('div'), ext, extDone);
  on('#extendBtn', () => extensionDialog(d, extDone));
  mountAssign(app.querySelector('#assign'), 'DEAL', id).catch(() => {});
  // Панель «Продление аренды» убрана (11.11.2026): предложение и кнопки — в верхнем блоке, «Продлить аренду» — в «Что дальше»
  renderNotes(app.querySelector('#notes'), d).catch(() => {});
  renderExtras(app.querySelector('#extras'), d).catch((err) => { app.querySelector('#extras').innerHTML = `<p class="muted">${esc(err.message)}</p>`; });
  if (conv) return mountChat(app.querySelector('#chat'), conv.id, 'Чат сделки');
}

function party(role, org, contacts, show) {
  return `<div class="small muted">${role}</div><b>${org?.type === 'PERSON' ? esc(org.name + ' (частное лицо)') : `<a href="#/company/${org?.id}">${esc(org?.name)}</a>`}</b>
    ${org?.type && org.type !== 'PERSON' ? `<div class="small muted">${ORG_TYPE[org.type]}${org.inn ? ', ИНН ' + esc(org.inn) : ''}</div>` : ''}
    ${show && contacts ? `<div class="small" style="margin-top:6px">${contacts.contact_person ? esc(contacts.contact_person) + '<br>' : ''}
      ${contacts.phone ? `<a href="tel:${esc(contacts.phone)}">${esc(contacts.phone)}</a><br>` : ''}${contacts.email ? `<a href="mailto:${esc(contacts.email)}">${esc(contacts.email)}</a>` : ''}</div>`
      : '<div class="small muted" style="margin-top:4px">Контакты откроются после подтверждения</div>'}`;
}

// Блок «Что дальше»: одно главное действие, ответственный и таймер (D100)
function nextStep(d, amCust, amProv) {
  const cancel = (t = 'Отменить') => `<button class="btn ghost sm" id="cancelBtn">${t}</button>`;
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
          buttons: `<button class="btn" id="acceptBtn">Подтвердить завершение</button><button class="btn ghost sm" id="rejectBtn">Вернуть на доработку</button>` }
        : { text: 'Ждём, когда заказчик подтвердит завершение (до 72 часов)', buttons: '' };
    case 'COMPLETED': return { text: 'Сделка завершена. Спасибо за работу!', buttons: '' };
    default: return { text: 'Сделка отменена', buttons: amCust && d.order_id ? `<a class="btn" href="#/orders/${d.order_id}">Вернуться к заказу</a>` : amCust ? '<a class="btn" href="#/catalog">Найти другую технику</a>' : '' };
  }
}

function cancelInfo(d) {
  // Условия отмены (11.11.2026): FLEXIBLE — бесплатно до начала работ; остальное — по согласованию сторон
  const startMs = new Date(d.start_date + 'T00:00:00+03:00').getTime();
  if (d.status === 'AWAITING_CONFIRMATION') return 'Сделка ещё не подтверждена — отмена без последствий, бронь снимется.';
  if (d.cancel_policy !== 'FLEXIBLE') return 'Условия отмены по этой сделке — по согласованию сторон. Перед отменой обсудите порядок и стоимость в чате сделки. Бронь снимется, обе стороны получат уведомление.';
  return startMs > Date.now() ? 'Бесплатная отмена: работы ещё не начались. Бронь снимется, обе стороны получат уведомление.'
    : 'Работы уже начались — бесплатный период прошёл. Расчёты между сторонами — напрямую по договорённости; поздняя отмена учитывается в репутации.';
}

const EVENT = {
  deal_created: 'Сделка создана', deal_confirmed_by_customer: 'Заказчик подтвердил условия', deal_confirmed: 'Сделка подтверждена',
  deal_cancelled: 'Сделка отменена', deal_started: 'Работы начались', deal_completion_requested: 'Исполнитель завершил работы',
  deal_completion_rejected: 'Заказчик вернул на доработку', deal_completed: 'Сделка завершена',
  handover_submitted: 'Исполнитель оформил акт', handover_confirmed: 'Заказчик подтвердил акт',
  dispute_opened: 'Открыта претензия', dispute_decided: 'Принято решение по претензии',
  extension_requested: 'Запрошено продление', extension_accepted: 'Аренда продлена', extension_declined: 'Продление отклонено'
};
// Текст события с подробностями из payload: какой акт, чем закончилась претензия и т. п.
export function eventText(ev) {
  const p = ev.payload || {};
  const act = p.type === 'START' ? 'передачи техники' : p.type === 'END' ? 'возврата техники' : '';
  switch (ev.type) {
    case 'handover_submitted': return `Исполнитель оформил акт ${act}`;
    case 'handover_confirmed': return `Заказчик подтвердил акт ${act}${p.remarks ? ' с замечаниями' : ''}`;
    case 'deal_completed': return p.auto ? 'Сделка завершена автоматически (заказчик не ответил за 72 часа)' : 'Сделка завершена';
    case 'deal_confirmed': return p.instant_book ? 'Сделка подтверждена автоматически (мгновенная бронь)' : 'Сделка подтверждена';
    case 'deal_started': return p.handover ? 'Работы начались (по акту передачи)' : 'Работы начались';
    case 'deal_cancelled': return p.actor === 'SYSTEM' ? 'Сделка отменена: исполнитель не ответил вовремя' : 'Сделка отменена';
    case 'dispute_decided': return p.status === 'RESOLVED' ? 'Претензия признана обоснованной' : 'Претензия отклонена';
    case 'extension_requested': return `Запрошено продление до ${p.new_end ? p.new_end.split('-').reverse().join('.') : ''}`;
    case 'extension_accepted': return `Аренда продлена до ${p.new_end ? p.new_end.split('-').reverse().join('.') : ''}`;
    default: return EVENT[ev.type] || 'Событие по сделке';
  }
}
const reasonText = (r) => ({ PROVIDER_NO_RESPONSE: 'исполнитель не подтвердил сделку вовремя' }[r] || r);
