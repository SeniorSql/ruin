// «Учёт парка»: моточасы и ТО, документы со сроками, журнал ремонтов, расходы, машинисты, доходность по машинам
import { sb, state, q, canManage, mskDate } from '../api.js';
import { esc, money, toMinor, fromMinor, date, emptyState, errorState, modal, confirmBox, toast, busy, plural } from '../ui.js';
import { route } from '../app.js';

const TABS = [['overview', 'Обзор'], ['docs', 'Документы'], ['service', 'ТО и ремонты'], ['expenses', 'Расходы'], ['profit', 'Доходность'], ['operators', 'Машинисты']];
const DOC_KIND = { PSM: 'ПСМ / ПТС', STS: 'Свидетельство о регистрации', OSAGO: 'ОСАГО', INSPECTION: 'Техосмотр', GTN: 'Регистрация в Гостехнадзоре',
  LEASING: 'Договор лизинга', PERMIT: 'Удостоверение машиниста', MEDICAL: 'Медсправка', OTHER: 'Другое' };
const OP_DOCS = ['PERMIT', 'MEDICAL', 'OTHER'];
const EXP_CAT = { FUEL: 'Топливо', PARTS: 'Запчасти и расходники', INSURANCE: 'Страхование', SALARY: 'Зарплата машиниста', LEASING: 'Лизинг и кредит',
  TAX: 'Налоги и сборы', TRANSPORT: 'Перевозка техники', OTHER: 'Прочее' };
const SVC_KIND = { TO: 'ТО', REPAIR: 'Ремонт' };
const DEAL_LIVE = ['CONFIRMED', 'IN_PROGRESS', 'COMPLETION_PENDING', 'COMPLETED'];

const today = () => mskDate(0);
const daysTo = (d) => Math.round((new Date(d + 'T00:00:00') - new Date(today() + 'T00:00:00')) / 864e5);
const num = (x) => (x == null || x === '' ? '—' : new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(Number(x)));
const opt = (obj, cur) => Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${esc(v)}</option>`).join('');
const docState = (d) => {
  if (!d.valid_until) return ['', 'без срока'];
  const n = daysTo(d.valid_until);
  if (n < 0) return ['bad', 'истёк ' + date(d.valid_until)];
  if (n <= 30) return ['warn', `до ${date(d.valid_until)} · ${n} ${plural(n, 'день', 'дня', 'дней')}`];
  return ['ok', 'до ' + date(d.valid_until)];
};
const nextTo = (c) => (c && c.hours_meter != null ? Number(c.last_service_hours || 0) + Number(c.service_every || 250) : null);

export async function render(app, _p, query) {
  const o = state.org;
  if (!o?.can_provide) {
    app.innerHTML = emptyState('Учёт парка — для исполнителей', 'Переключитесь на организацию, которая сдаёт технику, или включите роль исполнителя в профиле организации.', '<a class="btn" href="#/account">Профиль и организации</a>');
    return;
  }
  const tab = TABS.some(([k]) => k === query.tab) ? query.tab : 'overview';
  const edit = canManage(o);
  let eq, cards, docs, svc, exps, ops, deals;
  try {
    eq = await q(sb.from('equipment').select('id,title,status').eq('org_id', o.id).neq('status', 'ARCHIVED').order('title'));
    [cards, docs, svc, exps, ops, deals] = await Promise.all([
      q(sb.from('fleet_cards').select('*').eq('org_id', o.id)),
      q(sb.from('fleet_docs').select('*').eq('org_id', o.id).order('valid_until', { ascending: true, nullsFirst: false })),
      q(sb.from('fleet_service').select('*').eq('org_id', o.id).order('done_on', { ascending: false }).limit(500)),
      q(sb.from('fleet_expenses').select('*').eq('org_id', o.id).order('spent_on', { ascending: false }).limit(1000)),
      q(sb.from('fleet_operators').select('*').eq('org_id', o.id).order('full_name')),
      q(sb.from('deals').select('id,number,equipment_id,start_date,end_date,total_minor,status').eq('provider_org_id', o.id).in('status', DEAL_LIVE).limit(1000))
    ]);
  } catch (err) {
    if (/fleet_/.test(String(err.message))) {
      app.innerHTML = `<div class="page-head"><div><h1>Учёт парка</h1></div></div><div class="banner warn">Учёт парка заработает после выполнения файла 11_fleet.sql в Supabase.</div>`;
      return;
    }
    app.innerHTML = errorState(err); return;
  }
  const card = Object.fromEntries(cards.map((c) => [c.equipment_id, c]));
  const eqById = Object.fromEntries(eq.map((e) => [e.id, e]));
  const opById = Object.fromEntries(ops.map((x) => [x.id, x]));
  const eqName = (id) => esc(eqById[id]?.title || 'Техника удалена');
  const docsBad = docs.filter((d) => d.valid_until && daysTo(d.valid_until) <= 30);
  const toSoon = eq.filter((e) => { const c = card[e.id]; const n = nextTo(c); return n != null && c.hours_meter >= n - 25; });

  // Доходность за месяц: выручка сделок делится по дням аренды, расходы — по датам
  const month = /^\d{4}-\d{2}$/.test(query.month || '') ? query.month : today().slice(0, 7);
  const mStart = month + '-01';
  const mEnd = (() => { const [y, m] = month.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); })();
  const overlapDays = (s, e) => { const a = s > mStart ? s : mStart, b = e < mEnd ? e : mEnd; return a > b ? 0 : Math.round((new Date(b) - new Date(a)) / 864e5) + 1; };
  const profit = {};
  const P = (id) => (profit[id || '_'] ||= { rev: 0, svc: 0, exp: 0 });
  for (const d of deals) {
    const total = Math.round((new Date(d.end_date) - new Date(d.start_date)) / 864e5) + 1;
    const n = overlapDays(d.start_date, d.end_date);
    if (n && total > 0) P(d.equipment_id).rev += (Number(d.total_minor) * n) / total;
  }
  for (const s of svc) if (s.done_on >= mStart && s.done_on <= mEnd) P(s.equipment_id).svc += Number(s.cost_minor);
  for (const x of exps) if (x.spent_on >= mStart && x.spent_on <= mEnd) P(x.equipment_id).exp += Number(x.amount_minor);
  const sum = (f) => Object.values(profit).reduce((s, p) => s + f(p), 0);

  const docChip = (d) => { const [c, t] = docState(d); return `<span class="pk-chip ${c}">${t}</span>`; };
  const addBtn = (id, t) => (edit ? `<button class="btn sm" id="${id}">+ ${t}</button>` : '');

  const views = {
    overview: () => `
      <div class="kpis">
        <div class="kpi"><b>${eq.length}</b><span>${plural(eq.length, 'единица', 'единицы', 'единиц')} техники</span></div>
        <div class="kpi ${docsBad.length ? 'hot' : ''}"><b>${docsBad.length}</b><span>Документы истекают за 30 дней</span></div>
        <div class="kpi ${toSoon.length ? 'hot' : ''}"><b>${toSoon.length}</b><span>Пора на ТО</span></div>
        <div class="kpi"><b class="num">${money(Math.round(sum((p) => p.rev - p.svc - p.exp)))}</b><span>Прибыль за ${monthName(month)}</span></div>
      </div>
      ${!eq.length ? emptyState('Техники пока нет', 'Добавьте технику — и здесь появится её учёт.', '<a class="btn" href="#/fleet/new">Добавить технику</a>') : `
      <div class="panel"><h2>Машины</h2><div class="table-wrap"><table class="table resp pk-t">
        <thead><tr><th>Техника</th><th>Машинист</th><th>Моточасы</th><th>ТО</th><th>Документы</th><th>Прибыль за месяц</th><th></th></tr></thead><tbody>
        ${eq.map((e) => { const c = card[e.id]; const n = nextTo(c); const left = n != null ? n - c.hours_meter : null;
          const ed = docs.filter((d) => d.equipment_id === e.id); const bad = ed.filter((d) => d.valid_until && daysTo(d.valid_until) < 0).length;
          const warn = ed.filter((d) => d.valid_until && daysTo(d.valid_until) >= 0 && daysTo(d.valid_until) <= 30).length; const p = profit[e.id] || { rev: 0, svc: 0, exp: 0 };
          return `<tr><td data-l="Техника"><a href="#/fleet/${e.id}"><b>${esc(e.title)}</b></a>${c?.reg_number ? `<div class="small muted">${esc(c.reg_number)}</div>` : ''}</td>
            <td data-l="Машинист">${c?.operator_id && opById[c.operator_id] ? esc(opById[c.operator_id].full_name) : '<span class="muted">—</span>'}</td>
            <td data-l="Моточасы" class="num">${num(c?.hours_meter)}${c?.hours_updated_on ? `<div class="small muted">на ${date(c.hours_updated_on)}</div>` : ''}</td>
            <td data-l="ТО">${left == null ? '<span class="muted">нет данных</span>' : left <= 0 ? `<span class="pk-chip bad">просрочено на ${num(-left)} м/ч</span>` : left <= 25 ? `<span class="pk-chip warn">через ${num(left)} м/ч</span>` : `<span class="pk-chip ok">через ${num(left)} м/ч</span>`}</td>
            <td data-l="Документы">${!ed.length ? '<span class="muted">не внесены</span>' : bad ? `<span class="pk-chip bad">истекло: ${bad}</span>` : warn ? `<span class="pk-chip warn">скоро истекает: ${warn}</span>` : `<span class="pk-chip ok">в порядке (${ed.length})</span>`}</td>
            <td data-l="Прибыль" class="num"><b class="${p.rev - p.svc - p.exp < 0 ? 'warn-text' : ''}">${money(Math.round(p.rev - p.svc - p.exp))}</b></td>
            <td>${edit ? `<button class="btn ghost sm" data-card="${e.id}">Учёт</button>` : ''}</td></tr>`; }).join('')}
      </tbody></table></div>
      <p class="small muted" style="margin-bottom:0">Моточасы обновляются сами из актов возврата техники и из журнала ТО. Нажмите «Учёт», чтобы задать моточасы, интервал ТО, машиниста и госномер.</p></div>`}`,

    docs: () => `<div class="panel"><div class="pk-head"><h2>Документы и сроки</h2>${addBtn('addDoc', 'Документ')}</div>
      ${docs.length ? `<div class="table-wrap"><table class="table resp"><thead><tr><th>Документ</th><th>Чей</th><th>Номер</th><th>Срок</th><th></th></tr></thead><tbody>
      ${docs.map((d) => `<tr><td data-l="Документ"><b>${esc(DOC_KIND[d.kind])}</b>${d.note ? `<div class="small muted">${esc(d.note)}</div>` : ''}</td>
        <td data-l="Чей">${d.equipment_id ? eqName(d.equipment_id) : esc(opById[d.operator_id]?.full_name || '—') + ' <span class="small muted">машинист</span>'}</td>
        <td data-l="Номер">${esc(d.number || '—')}</td><td data-l="Срок">${docChip(d)}</td>
        <td>${edit ? `<button class="btn ghost sm" data-doc="${d.id}">Изменить</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`
      : '<p class="muted" style="margin:0">Внесите ПСМ, ОСАГО, техосмотр и другие документы со сроками — сайт напомнит за 30 и за 7 дней до окончания.</p>'}</div>`,

    service: () => `<div class="panel"><div class="pk-head"><h2>ТО и ремонты</h2>${addBtn('addSvc', 'Запись')}</div>
      ${svc.length ? `<div class="table-wrap"><table class="table resp"><thead><tr><th>Дата</th><th>Техника</th><th>Что сделали</th><th>Моточасы</th><th>Стоимость</th><th></th></tr></thead><tbody>
      ${svc.map((s) => `<tr><td data-l="Дата">${date(s.done_on)}</td><td data-l="Техника">${eqName(s.equipment_id)}</td>
        <td data-l="Что сделали"><span class="pk-chip ${s.kind === 'TO' ? 'ok' : 'warn'}">${SVC_KIND[s.kind]}</span> ${esc(s.title)}${s.note ? `<div class="small muted">${esc(s.note)}</div>` : ''}</td>
        <td data-l="Моточасы" class="num">${num(s.hours)}</td><td data-l="Стоимость" class="num">${money(s.cost_minor)}</td>
        <td>${edit ? `<button class="btn ghost sm" data-svc="${s.id}">Изменить</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`
      : '<p class="muted" style="margin:0">Записывайте каждое ТО и ремонт: дата, моточасы, что сделали и сколько стоило. Запись ТО сдвигает следующее ТО, а стоимость попадает в расходы.</p>'}</div>`,

    expenses: () => {
      const list = exps.filter((x) => x.spent_on >= mStart && x.spent_on <= mEnd);
      const byCat = {};
      list.forEach((x) => (byCat[x.category] = (byCat[x.category] || 0) + Number(x.amount_minor)));
      return `<div class="panel"><div class="pk-head"><h2>Расходы</h2>${monthPick(month)}${addBtn('addExp', 'Расход')}</div>
        ${Object.keys(byCat).length ? `<div class="pk-cats">${Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span><b class="num">${money(v)}</b>${esc(EXP_CAT[k])}</span>`).join('')}</div>` : ''}
        ${list.length ? `<div class="table-wrap"><table class="table resp"><thead><tr><th>Дата</th><th>Статья</th><th>Техника</th><th>Сумма</th><th></th></tr></thead><tbody>
        ${list.map((x) => `<tr><td data-l="Дата">${date(x.spent_on)}</td><td data-l="Статья">${esc(EXP_CAT[x.category])}${x.note ? `<div class="small muted">${esc(x.note)}</div>` : ''}</td>
          <td data-l="Техника">${x.equipment_id ? eqName(x.equipment_id) : '<span class="muted">общий</span>'}</td><td data-l="Сумма" class="num"><b>${money(x.amount_minor)}</b></td>
          <td>${edit ? `<button class="btn ghost sm" data-exp="${x.id}">Изменить</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`
        : `<p class="muted" style="margin:0">За ${monthName(month)} расходов нет. Стоимость ТО и ремонтов вносить сюда не нужно — она берётся из журнала ТО.</p>`}</div>`;
    },

    profit: () => {
      const rows = [...eq.map((e) => [e.id, esc(e.title)]), ...(profit._ ? [['_', '<span class="muted">Общие расходы (без машины)</span>']] : [])];
      const t = { rev: sum((p) => p.rev), svc: sum((p) => p.svc), exp: sum((p) => p.exp) };
      return `<div class="panel"><div class="pk-head"><h2>Доходность по машинам</h2>${monthPick(month)}</div>
        <div class="table-wrap"><table class="table resp"><thead><tr><th>Техника</th><th>Выручка</th><th>ТО и ремонты</th><th>Расходы</th><th>Прибыль</th></tr></thead><tbody>
        ${rows.map(([id, name]) => { const p = profit[id] || { rev: 0, svc: 0, exp: 0 }; const pr = p.rev - p.svc - p.exp;
          return `<tr><td data-l="Техника">${name}</td><td data-l="Выручка" class="num">${money(Math.round(p.rev))}</td><td data-l="ТО и ремонты" class="num">${money(p.svc)}</td>
            <td data-l="Расходы" class="num">${money(p.exp)}</td><td data-l="Прибыль" class="num"><b class="${pr < 0 ? 'warn-text' : ''}">${money(Math.round(pr))}</b></td></tr>`; }).join('')}
        <tr class="pk-total"><td data-l="">Итого</td><td data-l="Выручка" class="num">${money(Math.round(t.rev))}</td><td data-l="ТО и ремонты" class="num">${money(t.svc)}</td>
          <td data-l="Расходы" class="num">${money(t.exp)}</td><td data-l="Прибыль" class="num"><b>${money(Math.round(t.rev - t.svc - t.exp))}</b></td></tr>
        </tbody></table></div>
        <p class="small muted" style="margin-bottom:0">Выручка — сделки на сайте (подтверждённые, в работе и завершённые), поделённые по дням аренды в этом месяце. Расходы — из журнала ТО и вкладки «Расходы».</p></div>`;
    },

    operators: () => `<div class="panel"><div class="pk-head"><h2>Машинисты</h2>${addBtn('addOp', 'Машинист')}</div>
      ${ops.length ? `<div class="table-wrap"><table class="table resp"><thead><tr><th>Машинист</th><th>Телефон</th><th>Удостоверение</th><th>Закреплён за</th><th></th></tr></thead><tbody>
      ${ops.map((x) => { const on = eq.filter((e) => card[e.id]?.operator_id === x.id);
        return `<tr class="${x.active ? '' : 'pk-off'}"><td data-l="Машинист"><b>${esc(x.full_name)}</b>${x.active ? '' : ' <span class="small muted">не работает</span>'}${x.note ? `<div class="small muted">${esc(x.note)}</div>` : ''}</td>
          <td data-l="Телефон">${x.phone ? `<a href="tel:${esc(x.phone)}">${esc(x.phone)}</a>` : '—'}</td>
          <td data-l="Удостоверение">${esc(x.license_no || '—')}${x.license_until ? ' ' + docChip({ valid_until: x.license_until }) : ''}</td>
          <td data-l="Закреплён за">${on.length ? on.map((e) => esc(e.title)).join(', ') : '<span class="muted">—</span>'}</td>
          <td>${edit ? `<button class="btn ghost sm" data-op="${x.id}">Изменить</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div>`
      : '<p class="muted" style="margin:0">Добавьте машинистов, затем закрепите их за техникой (вкладка «Обзор» → «Учёт»). Срок удостоверения тоже напомним заранее.</p>'}</div>`
  };

  app.innerHTML = `<div class="page-head"><div><h1>Учёт парка</h1><p>Моточасы и ТО, документы со сроками, расходы и прибыль по каждой машине.</p></div>
      <a class="btn ghost" href="#/fleet">Моя техника</a></div>
    <div class="tabs">${TABS.map(([k, t]) => `<a href="#/park?tab=${k}${k === 'expenses' || k === 'profit' ? '&month=' + month : ''}" class="${k === tab ? 'on' : ''}">${t}${k === 'docs' && docsBad.length ? ` <span class="tab-cnt">${docsBad.length}</span>` : ''}${k === 'service' && toSoon.length ? ` <span class="tab-cnt">${toSoon.length}</span>` : ''}</a>`).join('')}</div>
    ${views[tab]()}`;

  app.querySelector('#pkMonth')?.addEventListener('change', (e) => { if (e.target.value) location.hash = `#/park?tab=${tab}&month=${e.target.value}`; });
  if (!edit) return;

  const eqOptions = (cur, allowNone) => (allowNone ? `<option value="">— общий, без машины —</option>` : '') + eq.map((e) => `<option value="${e.id}" ${e.id === cur ? 'selected' : ''}>${esc(e.title)}</option>`).join('');
  const save = (m, f, fn) => {
    f.onsubmit = (ev) => {
      ev.preventDefault();
      busy(f.querySelector('button[type=submit]'), async () => {
        try { await fn(new FormData(f)); m.close(); toast('Сохранено'); route(); }
        catch (err) { const el = f.querySelector('.form-error'); el.textContent = err.message; el.classList.remove('hidden'); }
      });
    };
  };
  const del = (m, sel, table, id) => m.el.querySelector(sel)?.addEventListener('click', async () => {
    if (!(await confirmBox('Удалить запись?', 'Запись удалится без возможности восстановления.', 'Удалить'))) return;
    const { error } = await sb.from(table).delete().eq('id', id);
    if (error) return toast(error.message, true);
    m.close(); toast('Удалено'); route();
  });
  const ok = ({ error }) => { if (error) throw new Error(error.message); };
  const nz = (v) => (v === '' || v == null ? null : v);

  // Карточка учёта машины
  app.querySelectorAll('[data-card]').forEach((b) => b.onclick = () => {
    const e = eqById[b.dataset.card], c = card[e.id] || {};
    const m = modal(`<h2>Учёт: ${esc(e.title)}</h2><form id="pf"><div class="form-error hidden"></div>
      <div class="grid2"><label class="f"><span>Моточасы сейчас</span><input class="inp" name="hours" type="number" min="0" step="0.1" value="${c.hours_meter ?? ''}"></label>
        <label class="f"><span>ТО каждые, м/ч</span><input class="inp" name="every" type="number" min="10" max="5000" value="${c.service_every ?? 250}"></label></div>
      <label class="f"><span>Последнее ТО было на, м/ч</span><input class="inp" name="last" type="number" min="0" step="0.1" value="${c.last_service_hours ?? ''}"></label>
      <label class="f"><span>Машинист</span><select class="inp" name="op"><option value="">— не закреплён —</option>${ops.filter((x) => x.active || x.id === c.operator_id).map((x) => `<option value="${x.id}" ${x.id === c.operator_id ? 'selected' : ''}>${esc(x.full_name)}</option>`).join('')}</select></label>
      <div class="grid2"><label class="f"><span>Госномер</span><input class="inp" name="reg" maxlength="40" value="${esc(c.reg_number || '')}"></label>
        <label class="f"><span>Заводской номер</span><input class="inp" name="serial" maxlength="60" value="${esc(c.serial_number || '')}"></label></div>
      <label class="f"><span>Заметка</span><textarea class="inp" name="note" rows="2" maxlength="2000">${esc(c.note || '')}</textarea></label>
      <button class="btn wide" type="submit">Сохранить</button></form>`);
    save(m, m.el.querySelector('#pf'), async (fd) => {
      const h = nz(fd.get('hours'));
      ok(await sb.from('fleet_cards').upsert({ equipment_id: e.id, org_id: o.id, hours_meter: h, hours_updated_on: h != null && Number(h) !== Number(c.hours_meter) ? today() : (c.hours_updated_on || null),
        service_every: Number(fd.get('every') || 250), last_service_hours: nz(fd.get('last')), operator_id: nz(fd.get('op')),
        reg_number: nz(fd.get('reg')?.trim()), serial_number: nz(fd.get('serial')?.trim()), note: nz(fd.get('note')?.trim()), updated_at: new Date().toISOString() }));
    });
  });

  // Документы
  const docForm = (d = {}) => {
    const m = modal(`<h2>${d.id ? 'Документ' : 'Новый документ'}</h2><form id="df"><div class="form-error hidden"></div>
      <label class="f"><span>Чей документ</span><select class="inp" name="owner" required>
        <optgroup label="Техника">${eq.map((e) => `<option value="e:${e.id}" ${d.equipment_id === e.id ? 'selected' : ''}>${esc(e.title)}</option>`).join('')}</optgroup>
        ${ops.length ? `<optgroup label="Машинисты">${ops.map((x) => `<option value="o:${x.id}" ${d.operator_id === x.id ? 'selected' : ''}>${esc(x.full_name)}</option>`).join('')}</optgroup>` : ''}</select></label>
      <label class="f"><span>Вид документа</span><select class="inp" name="kind">${opt(DOC_KIND, d.kind || 'OSAGO')}</select></label>
      <div class="grid2"><label class="f"><span>Номер</span><input class="inp" name="number" maxlength="80" value="${esc(d.number || '')}"></label>
        <label class="f"><span>Действует до</span><input class="inp" name="until" type="date" value="${d.valid_until || ''}"></label></div>
      <label class="f"><span>Заметка</span><input class="inp" name="note" maxlength="1000" value="${esc(d.note || '')}"></label>
      <div class="actions"><button class="btn" type="submit">Сохранить</button>${d.id ? '<button class="btn danger" type="button" id="del">Удалить</button>' : ''}</div></form>`);
    save(m, m.el.querySelector('#df'), async (fd) => {
      const [t, id] = String(fd.get('owner')).split(':');
      const row = { org_id: o.id, equipment_id: t === 'e' ? id : null, operator_id: t === 'o' ? id : null, kind: fd.get('kind'),
        number: nz(fd.get('number')?.trim()), valid_until: nz(fd.get('until')), note: nz(fd.get('note')?.trim()) };
      if (t === 'o' && !OP_DOCS.includes(row.kind)) throw new Error('Для машиниста выберите удостоверение, медсправку или «Другое»');
      ok(d.id ? await sb.from('fleet_docs').update(row).eq('id', d.id) : await sb.from('fleet_docs').insert(row));
    });
    if (d.id) del(m, '#del', 'fleet_docs', d.id);
  };
  app.querySelector('#addDoc')?.addEventListener('click', () => (eq.length ? docForm() : toast('Сначала добавьте технику', true)));
  app.querySelectorAll('[data-doc]').forEach((b) => b.onclick = () => docForm(docs.find((d) => d.id === b.dataset.doc)));

  // ТО и ремонты
  const svcForm = (s = {}) => {
    const m = modal(`<h2>${s.id ? 'ТО / ремонт' : 'Новая запись ТО или ремонта'}</h2><form id="sf"><div class="form-error hidden"></div>
      <label class="f"><span>Техника</span><select class="inp" name="eq" required>${eqOptions(s.equipment_id)}</select></label>
      <div class="grid2"><label class="f"><span>Что это</span><select class="inp" name="kind">${opt(SVC_KIND, s.kind || 'TO')}</select></label>
        <label class="f"><span>Дата</span><input class="inp" name="on" type="date" required value="${s.done_on || today()}"></label></div>
      <label class="f"><span>Что сделали</span><input class="inp" name="title" required maxlength="200" placeholder="ТО-250: масло, фильтры" value="${esc(s.title || '')}"></label>
      <div class="grid2"><label class="f"><span>Моточасы</span><input class="inp" name="hours" type="number" min="0" step="0.1" value="${s.hours ?? ''}"></label>
        <label class="f"><span>Стоимость, ₽</span><input class="inp" name="cost" inputmode="decimal" value="${s.cost_minor ? fromMinor(s.cost_minor) : ''}"></label></div>
      <label class="f"><span>Заметка</span><textarea class="inp" name="note" rows="2" maxlength="2000">${esc(s.note || '')}</textarea></label>
      <div class="actions"><button class="btn" type="submit">Сохранить</button>${s.id ? '<button class="btn danger" type="button" id="del">Удалить</button>' : ''}</div></form>`);
    save(m, m.el.querySelector('#sf'), async (fd) => {
      const cost = fd.get('cost') ? toMinor(fd.get('cost')) : 0;
      if (Number.isNaN(cost) || cost < 0) throw new Error('Проверьте стоимость');
      const row = { org_id: o.id, equipment_id: fd.get('eq'), kind: fd.get('kind'), done_on: fd.get('on'), title: fd.get('title').trim(),
        hours: nz(fd.get('hours')), cost_minor: cost, note: nz(fd.get('note')?.trim()) };
      ok(s.id ? await sb.from('fleet_service').update(row).eq('id', s.id) : await sb.from('fleet_service').insert(row));
    });
    if (s.id) del(m, '#del', 'fleet_service', s.id);
  };
  app.querySelector('#addSvc')?.addEventListener('click', () => (eq.length ? svcForm() : toast('Сначала добавьте технику', true)));
  app.querySelectorAll('[data-svc]').forEach((b) => b.onclick = () => svcForm(svc.find((s) => s.id === b.dataset.svc)));

  // Расходы
  const expForm = (x = {}) => {
    const m = modal(`<h2>${x.id ? 'Расход' : 'Новый расход'}</h2><form id="xf"><div class="form-error hidden"></div>
      <div class="grid2"><label class="f"><span>Статья</span><select class="inp" name="cat">${opt(EXP_CAT, x.category || 'FUEL')}</select></label>
        <label class="f"><span>Дата</span><input class="inp" name="on" type="date" required value="${x.spent_on || today()}"></label></div>
      <label class="f"><span>Техника</span><select class="inp" name="eq">${eqOptions(x.equipment_id, true)}</select></label>
      <label class="f"><span>Сумма, ₽</span><input class="inp" name="sum" inputmode="decimal" required value="${x.amount_minor ? fromMinor(x.amount_minor) : ''}"></label>
      <label class="f"><span>Заметка</span><input class="inp" name="note" maxlength="1000" value="${esc(x.note || '')}"></label>
      <div class="actions"><button class="btn" type="submit">Сохранить</button>${x.id ? '<button class="btn danger" type="button" id="del">Удалить</button>' : ''}</div></form>`);
    save(m, m.el.querySelector('#xf'), async (fd) => {
      const amount = toMinor(fd.get('sum'));
      if (!(amount > 0)) throw new Error('Укажите сумму больше нуля');
      const row = { org_id: o.id, equipment_id: nz(fd.get('eq')), category: fd.get('cat'), spent_on: fd.get('on'), amount_minor: amount, note: nz(fd.get('note')?.trim()) };
      ok(x.id ? await sb.from('fleet_expenses').update(row).eq('id', x.id) : await sb.from('fleet_expenses').insert(row));
    });
    if (x.id) del(m, '#del', 'fleet_expenses', x.id);
  };
  app.querySelector('#addExp')?.addEventListener('click', () => expForm());
  app.querySelectorAll('[data-exp]').forEach((b) => b.onclick = () => expForm(exps.find((x) => x.id === b.dataset.exp)));

  // Машинисты
  const opForm = (x = {}) => {
    const m = modal(`<h2>${x.id ? 'Машинист' : 'Новый машинист'}</h2><form id="of"><div class="form-error hidden"></div>
      <label class="f"><span>ФИО</span><input class="inp" name="name" required maxlength="120" value="${esc(x.full_name || '')}"></label>
      <label class="f"><span>Телефон</span><input class="inp" name="phone" type="tel" maxlength="40" value="${esc(x.phone || '')}"></label>
      <div class="grid2"><label class="f"><span>Удостоверение тракториста-машиниста, №</span><input class="inp" name="lic" maxlength="60" value="${esc(x.license_no || '')}"></label>
        <label class="f"><span>Действует до</span><input class="inp" name="until" type="date" value="${x.license_until || ''}"></label></div>
      <label class="f"><span>Заметка</span><input class="inp" name="note" maxlength="1000" value="${esc(x.note || '')}" placeholder="Категории, допуски, опыт"></label>
      ${x.id ? `<label class="check"><input type="checkbox" name="active" ${x.active ? 'checked' : ''}> <span>Работает сейчас</span></label>` : ''}
      <div class="actions"><button class="btn" type="submit">Сохранить</button>${x.id ? '<button class="btn danger" type="button" id="del">Удалить</button>' : ''}</div></form>`);
    save(m, m.el.querySelector('#of'), async (fd) => {
      const row = { org_id: o.id, full_name: fd.get('name').trim(), phone: nz(fd.get('phone')?.trim()), license_no: nz(fd.get('lic')?.trim()),
        license_until: nz(fd.get('until')), note: nz(fd.get('note')?.trim()), active: x.id ? fd.get('active') === 'on' : true };
      ok(x.id ? await sb.from('fleet_operators').update(row).eq('id', x.id) : await sb.from('fleet_operators').insert(row));
    });
    if (x.id) del(m, '#del', 'fleet_operators', x.id);
  };
  app.querySelector('#addOp')?.addEventListener('click', () => opForm());
  app.querySelectorAll('[data-op]').forEach((b) => b.onclick = () => opForm(ops.find((x) => x.id === b.dataset.op)));
}

function monthName(m) {
  const [y, mm] = m.split('-').map(Number);
  return new Date(y, mm - 1, 15).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }).replace(' г.', '');
}
const monthPick = (m) => `<input class="inp pk-month" type="month" id="pkMonth" value="${m}" aria-label="Месяц">`;
