// «Рабочий стол»: сделки по этапам, напоминания, продления и загрузка техники на 30 дней (мини-CRM)
import { sb, state, q, refreshCounters, mskDate, actsAsProvider, actsAsCustomer } from '../api.js';
import { esc, money, date, period, emptyState, errorState, plural, toast } from '../ui.js';
import { route, refreshShell } from '../app.js';
import { isTeam, loadTeam, assignees, memberLabel } from '../assign.js';
import { TRASH, deleteNote } from '../dealCrm.js';

const STAGES = [
  ['AWAITING_CONFIRMATION', 'Новые брони', 'Подтвердите в течение 12 часов'],
  ['CONFIRMED', 'Подтверждены', 'Подготовить технику и подачу'],
  ['IN_PROGRESS', 'В работе', 'Смены, продление, завершение'],
  ['COMPLETION_PENDING', 'Ждут приёмки', 'Заказчик подтверждает завершение'],
  ['COMPLETED', 'Завершены за 30 дней', 'Отзыв и документы']
];
const daysTo = (d) => Math.round((new Date(d + 'T00:00:00') - new Date(mskDate(0) + 'T00:00:00')) / 864e5);
const inDays = (n) => (n === 0 ? 'сегодня' : n === 1 ? 'завтра' : n < 0 ? `${-n} ${plural(-n, 'день', 'дня', 'дней')} назад` : `через ${n} ${plural(n, 'день', 'дня', 'дней')}`);

export async function render(app, _p, query) {
  const o = state.org;
  const role = query.role || (actsAsProvider(o) ? 'provider' : 'customer');
  const prov = role === 'provider';
  const today = mskDate(0);
  let deals, notes, exts;
  try {
    deals = await q(sb.from('deals').select('*, equipment(id,title), cust:organizations!deals_customer_org_id_fkey(name,type), prov:organizations!deals_provider_org_id_fkey(name)')
      .eq(prov ? 'provider_org_id' : 'customer_org_id', o.id).neq('status', 'CANCELLED').order('start_date').limit(400));
    deals = deals.filter((d) => d.status !== 'COMPLETED' || (d.completed_at && new Date(d.completed_at) > Date.now() - 30 * 864e5));
    [notes, exts] = await Promise.all([
      q(sb.from('deal_notes').select('*, deals(number)').eq('org_id', o.id).eq('done', false).order('remind_on', { ascending: true, nullsFirst: false })).catch(() => null),
      deals.length ? q(sb.from('deal_extensions').select('deal_id,requested_by_org,new_end').eq('status', 'REQUESTED').in('deal_id', deals.map((d) => d.id))).catch(() => []) : []
    ]);
  } catch (err) { app.innerHTML = errorState(err); return; }
  // Команда: чьи сделки показывать
  const team = await isTeam() ? await loadTeam() : null;
  const asg = team ? await assignees('DEAL', deals.map((d) => d.id)) : {};
  const who = team ? (query.who || 'all') : 'all';
  const live = (d) => d.status !== 'COMPLETED';
  const cnt = team ? { mine: deals.filter((d) => live(d) && asg[d.id] === state.user.id).length, none: deals.filter((d) => live(d) && !asg[d.id]).length } : {};
  if (who === 'mine') deals = deals.filter((d) => asg[d.id] === state.user.id);
  else if (who === 'none') deals = deals.filter((d) => !asg[d.id]);
  else if (who !== 'all') deals = deals.filter((d) => asg[d.id] === who);
  const noSql = notes === null;
  notes = notes || [];
  const extBy = Object.fromEntries(exts.map((x) => [x.deal_id, x]));
  const notesBy = notes.reduce((m, n) => ((m[n.deal_id] = (m[n.deal_id] || 0) + 1), m), {});
  const due = notes.filter((n) => n.remind_on && n.remind_on <= today);
  const by = (s) => deals.filter((d) => d.status === s);

  // Ключевые цифры: что требует внимания сегодня
  const startSoon = by('CONFIRMED').filter((d) => daysTo(d.start_date) <= 3);
  const endSoon = by('IN_PROGRESS').filter((d) => daysTo(d.end_date) <= 2);
  const extWait = exts.filter((x) => x.requested_by_org !== o.id);
  const kpi = [
    [prov ? 'Ждут вашего подтверждения' : 'Ждут подтверждения исполнителя', by('AWAITING_CONFIRMATION').length, prov && by('AWAITING_CONFIRMATION').length],
    ['Начинаются в ближайшие 3 дня', startSoon.length, startSoon.length],
    ['В работе', by('IN_PROGRESS').length, false],
    ['Заканчиваются за 2 дня — продлить?', endSoon.length, endSoon.length],
    ['Продления ждут вашего ответа', extWait.length, extWait.length],
    [prov ? 'Ждут приёмки заказчиком' : 'Ждут вашей приёмки', by('COMPLETION_PENDING').length, !prov && by('COMPLETION_PENDING').length]
  ];

  const card = (d) => {
    const other = prov ? (d.cust?.type === 'PERSON' ? 'Частное лицо' : d.cust?.name) : d.prov?.name;
    const chips = [];
    if (d.status === 'CONFIRMED') { const n = daysTo(d.start_date); chips.push([n <= 1 ? 'hot' : '', 'начало ' + inDays(n)]); }
    if (d.status === 'IN_PROGRESS') { const n = daysTo(d.end_date); chips.push([n <= 2 ? 'hot' : '', (n < 0 ? 'срок прошёл ' : 'окончание ') + inDays(n)]); }
    if (d.status === 'AWAITING_CONFIRMATION' && d.hold_expires_at) chips.push(['hot', 'ответ до ' + new Date(d.hold_expires_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' })]);
    if (extBy[d.id]) chips.push([extBy[d.id].requested_by_org === o.id ? '' : 'hot', 'продление до ' + date(extBy[d.id].new_end)]);
    if (notesBy[d.id]) chips.push(['', `заметок: ${notesBy[d.id]}`]);
    if (team) chips.push(asg[d.id] ? [asg[d.id] === state.user.id ? 'me' : '', esc(memberLabel(team, asg[d.id]))] : [live(d) ? 'warn' : '', 'без ответственного']);
    return `<a class="kcard" href="#/deals/${d.id}"><b>${esc(d.number)}</b><div class="small">${esc(d.equipment?.title || '')}</div>
      <div class="small muted">${esc(other || '')}</div><div class="small">${period(d.start_date, d.end_date)}</div>
      <div class="small num"><b>${money(d.total_minor)}</b></div>${chips.map(([c, t]) => `<span class="chip ${c}">${t}</span>`).join('')}</a>`;
  };

  app.innerHTML = `
    <div class="page-head"><div><h1>Рабочий стол</h1><p>Все сделки по этапам, напоминания и загрузка техники — в одном месте.</p></div>
      <a class="btn ghost" href="#/deals?tab=${role}">Список сделок</a></div>
    ${actsAsProvider(o) && actsAsCustomer(o) ? `<div class="tabs"><a href="#/crm?role=provider" class="${prov ? 'on' : ''}">Я исполнитель</a><a href="#/crm?role=customer" class="${!prov ? 'on' : ''}">Я заказчик</a></div>` : ''}
    ${team ? `<div class="tabs small-tabs">${[['all', 'Все'], ['mine', 'Мои'], ['none', 'Без ответственного']].map(([k, t]) =>
      `<a href="#/crm?role=${role}&who=${k}" class="${who === k ? 'on' : ''}">${t}${cnt[k] ? ` <span class="tab-cnt">${cnt[k]}</span>` : ''}</a>`).join('')}
      <select class="inp" id="whoSel" aria-label="Сотрудник" style="height:34px;width:auto;margin-left:auto"><option value="">По сотруднику…</option>
      ${team.filter((m) => ['OWNER', 'ADMIN', 'MANAGER'].includes(m.role)).map((m) => `<option value="${m.user_id}" ${who === m.user_id ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}</select></div>` : ''}
    ${noSql ? '<div class="banner warn">Заметки и продления заработают после выполнения файла 07_crm.sql в Supabase.</div>' : ''}
    <div class="kpis">${kpi.map(([t, n, hot]) => `<div class="kpi ${hot ? 'hot' : ''}"><b>${n}</b><span>${t}</span></div>`).join('')}</div>
    <div class="panel"><h2>Напоминания${due.length ? ` <span class="tab-cnt">${due.length}</span>` : ''}</h2>
      ${notes.length ? `<ul class="notes">${notes.slice(0, 30).map((n) => `<li class="${n.remind_on && n.remind_on <= today ? 'due' : ''}">
        <div class="note-row"><label class="check" style="margin:0"><input type="checkbox" data-done="${n.id}"> <span style="white-space:pre-wrap">${esc(n.body)}</span></label>
        <button type="button" class="note-del" data-del="${n.id}" title="Удалить заметку" aria-label="Удалить заметку">${TRASH}</button></div>
        <div class="small muted"><a href="#/deals/${n.deal_id}">${esc(n.deals?.number || 'сделка')}</a>${n.remind_on ? ` · ${n.remind_on <= today ? '<b class="warn-text">' : ''}напомнить ${date(n.remind_on)}${n.remind_on <= today ? '</b>' : ''}` : ''}</div></li>`).join('')}</ul>`
        : '<p class="muted" style="margin:0">Открытых заметок нет. Заметку с датой напоминания можно добавить на странице любой сделки — блок «Мои заметки».</p>'}
    </div>
    ${deals.length ? `<div class="kanban">${STAGES.map(([s, t, hint]) => `<div class="kcol"><div class="khead"><b>${t}</b><span>${by(s).length}</span><small>${hint}</small></div>
      ${by(s).map(card).join('') || '<div class="small muted" style="padding:8px">Пусто</div>'}</div>`).join('')}</div>`
      : emptyState('Сделок пока нет', prov ? 'Сделки появятся, когда заказчики забронируют вашу технику или выберут ваше предложение.' : 'Забронируйте технику или разместите заказ.',
        prov ? (o.can_provide ? '<a class="btn" href="#/feed">Лента заказов</a>' : '') : '<a class="btn" href="#/catalog">В каталог</a>')}
    ${prov ? '<div class="panel" id="tl"><h2>Загрузка техники на 30 дней</h2><div class="skeleton" style="height:120px"></div></div>' : ''}`;

  app.querySelector('#whoSel')?.addEventListener('change', (e) => { location.hash = `#/crm?role=${role}&who=${e.target.value || 'all'}`; });
  app.querySelectorAll('[data-done]').forEach((c) => c.onchange = async () => {
    const { error } = await sb.from('deal_notes').update({ done: true }).eq('id', c.dataset.done);
    if (error) return toast(error.message, true);
    toast('Отмечено как выполненное'); await refreshCounters(); refreshShell(); route();
  });
  app.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    if (await deleteNote(b.dataset.del)) { await refreshCounters(); refreshShell(); route(); }
  });
  if (prov) timeline(app.querySelector('#tl'), o, deals).catch((e) => { app.querySelector('#tl').innerHTML += `<p class="muted">${esc(e.message)}</p>`; });
}

// Шкала занятости: строки — техника, столбцы — дни. Над таблицей — фильтры, поиск и сортировка
const TL_PAGE = 15;
async function timeline(box, o, deals) {
  const eq = await q(sb.from('equipment').select('id,title,status,categories(name)').eq('org_id', o.id).in('status', ['PUBLISHED', 'HIDDEN']).order('title'));
  if (!eq.length) { box.innerHTML = '<h2>Загрузка техники на 30 дней</h2><p class="muted">Нет опубликованной техники.</p>'; return; }
  const days = Array.from({ length: 30 }, (_, i) => mskDate(i));
  const from = days[0], to = days[29];
  const bk = await q(sb.from('bookings').select('equipment_id,type,status,period,deal_id').in('equipment_id', eq.map((e) => e.id)).in('status', ['HOLD', 'CONFIRMED', 'ACTIVE']));
  const norm = (ts) => ts.trim().replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00');
  const msk = (ts) => new Date(norm(ts)).toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' });
  const deal = Object.fromEntries(deals.map((d) => [d.id, d]));
  const cells = {};
  for (const b of bk) {
    const m = String(b.period).match(/["\[(]?"?([^",]+)"?,"?([^")\]]+)"?/);
    if (!m) continue;
    const s = msk(m[1]), e = msk(new Date(new Date(norm(m[2])).getTime() - 1000).toISOString());
    if (e < from || s > to) continue;
    for (const d of days) if (d >= s && d <= e) (cells[b.equipment_id] ||= {})[d] = b;
  }
  const cls = (b) => (b.type !== 'DEAL' ? 'blk' : b.status === 'HOLD' ? 'hold' : b.status === 'ACTIVE' ? 'act' : 'conf');
  const tip = (b, d) => (b.type !== 'DEAL' ? 'Блокировка владельцем' : `${deal[b.deal_id]?.number || 'Сделка'} · ${{ HOLD: 'ждёт подтверждения', CONFIRMED: 'подтверждена', ACTIVE: 'в работе' }[b.status]} · ${date(d)}`);

  // Данные по каждой машине — для фильтров
  const rows = eq.map((e) => {
    const row = cells[e.id] || {};
    const busyN = days.filter((d) => row[d]).length;
    return { e, row, busyN, pct: Math.round((100 * busyN) / 30), cat: e.categories?.name || 'Без вида',
      busyToday: !!row[from], hold: days.some((d) => row[d]?.status === 'HOLD') };
  });
  const cats = [...new Set(rows.map((r) => r.cat))].sort((a, b) => a.localeCompare(b, 'ru'));
  const QUICK = [['all', 'Все'], ['free', 'Свободны сегодня'], ['busy', 'Заняты сегодня'], ['hold', 'Ждут подтверждения'], ['idle', 'Без броней']];
  const quickTest = { all: () => true, free: (r) => !r.busyToday, busy: (r) => r.busyToday, hold: (r) => r.hold, idle: (r) => r.busyN === 0 };
  const st = { q: '', cat: '', quick: 'all', a: '', b: '', sort: 'name', limit: TL_PAGE };

  const head = `<thead><tr><th></th>${days.map((d) => { const dt = new Date(d + 'T12:00:00'); const we = [0, 6].includes(dt.getDay());
    return `<th class="${we ? 'we' : ''}">${dt.getDate()}<small>${dt.toLocaleDateString('ru-RU', { weekday: 'short' })}</small></th>`; }).join('')}<th>Загрузка</th></tr></thead>`;
  const tr = (r) => `<tr><td class="tl-name"><a href="#/fleet/${r.e.id}" title="${esc(r.e.title)}">${esc(r.e.title)}</a></td>${days.map((d) => { const b = r.row[d];
    return b ? `<td class="${cls(b)}" title="${esc(tip(b, d))}">${b.deal_id && deal[b.deal_id] ? `<a href="#/deals/${b.deal_id}" aria-label="${esc(tip(b, d))}"></a>` : ''}</td>` : '<td></td>'; }).join('')}
    <td class="num"><b>${r.pct}%</b></td></tr>`;

  box.innerHTML = `<h2>Загрузка техники на 30 дней</h2>
    <div class="tl-tools">
      <input class="inp" type="search" id="tlQ" placeholder="Поиск по названию" aria-label="Поиск техники">
      ${cats.length > 1 ? `<select class="inp" id="tlCat" aria-label="Вид техники"><option value="">Все виды</option>${cats.map((c) => `<option>${esc(c)}</option>`).join('')}</select>` : ''}
      <select class="inp" id="tlSort" aria-label="Сортировка"><option value="name">По названию</option><option value="load-desc">Загрузка: больше</option><option value="load-asc">Загрузка: меньше</option></select>
    </div>
    <div class="tl-quick" id="tlQuick">${QUICK.map(([k, t]) => `<button type="button" data-q="${k}">${t} <span></span></button>`).join('')}</div>
    <div class="tl-dates small"><span>Свободна все дни с</span><input class="inp" type="date" id="tlA" min="${from}" max="${to}"><span>по</span><input class="inp" type="date" id="tlB" min="${from}" max="${to}"><button type="button" class="btn ghost sm hidden" id="tlReset">Сбросить фильтры</button></div>
    <div class="tl-legend small"><i class="hold"></i>ждёт подтверждения <i class="conf"></i>подтверждено <i class="act"></i>в работе <i class="blk"></i>блокировка <i></i>свободно</div>
    <div id="tlBody"></div>
    <p class="small muted" style="margin-bottom:0">Нажмите на занятый день — откроется сделка. Свободные окна можно закрыть блокировкой в карточке техники (раздел «Календарь»).</p>`;

  const $ = (s) => box.querySelector(s);
  const draw = () => {
    const base = rows.filter((r) => (!st.q || r.e.title.toLowerCase().includes(st.q)) && (!st.cat || r.cat === st.cat) &&
      (!st.a || days.filter((d) => d >= st.a && d <= (st.b || st.a)).every((d) => !r.row[d])));
    box.querySelectorAll('#tlQuick [data-q]').forEach((b) => { b.classList.toggle('on', b.dataset.q === st.quick); b.querySelector('span').textContent = base.filter(quickTest[b.dataset.q]).length; });
    const byName = (x, y) => x.e.title.localeCompare(y.e.title, 'ru');
    const list = base.filter(quickTest[st.quick]).sort((x, y) => st.sort === 'load-desc' ? y.pct - x.pct || byName(x, y) : st.sort === 'load-asc' ? x.pct - y.pct || byName(x, y) : byName(x, y));
    $('#tlReset').classList.toggle('hidden', !(st.q || st.cat || st.quick !== 'all' || st.a || st.b));
    const shown = list.slice(0, st.limit);
    $('#tlBody').innerHTML = (list.length ? `<div class="tl-wrap"><table class="tl">${head}<tbody>${shown.map(tr).join('')}</tbody></table></div>`
      : '<p class="muted" style="margin:10px 0">Под эти условия техники нет.</p>')
      + (rows.length > TL_PAGE || list.length !== rows.length ? `<div class="tl-foot small muted">Показано ${shown.length} из ${list.length}${list.length !== rows.length ? ` (всего машин ${rows.length})` : ''}
        ${list.length > shown.length ? `<button type="button" class="btn ghost sm" id="tlMore">Показать ещё ${Math.min(TL_PAGE, list.length - shown.length)}</button>` : ''}</div>` : '');
    $('#tlMore')?.addEventListener('click', () => { st.limit += TL_PAGE; draw(); });
  };
  const set = (k, v) => { st[k] = v; st.limit = TL_PAGE; draw(); };
  $('#tlQ').addEventListener('input', (e) => set('q', e.target.value.trim().toLowerCase()));
  $('#tlCat')?.addEventListener('change', (e) => set('cat', e.target.value));
  $('#tlSort').addEventListener('change', (e) => set('sort', e.target.value));
  box.querySelectorAll('#tlQuick [data-q]').forEach((b) => b.addEventListener('click', () => set('quick', b.dataset.q)));
  $('#tlA').addEventListener('change', (e) => { if (!e.target.value) { st.b = ''; $('#tlB').value = ''; } else if (st.b && e.target.value > st.b) { $('#tlB').value = e.target.value; st.b = e.target.value; } set('a', e.target.value); });
  $('#tlB').addEventListener('change', (e) => { if (e.target.value && !st.a) { $('#tlA').value = e.target.value; st.a = e.target.value; } else if (st.a && e.target.value && e.target.value < st.a) { $('#tlA').value = e.target.value; st.a = e.target.value; } set('b', e.target.value); });
  $('#tlReset').addEventListener('click', () => {
    Object.assign(st, { q: '', cat: '', quick: 'all', a: '', b: '', limit: TL_PAGE });
    $('#tlQ').value = ''; $('#tlA').value = ''; $('#tlB').value = ''; if ($('#tlCat')) $('#tlCat').value = '';
    draw();
  });
  draw();
}
