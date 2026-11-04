// Аналитика организации: исполнитель — загрузка и выручка, заказчик — расходы (Модуль 10, панели E)
import { state, rpc } from '../api.js';
import { esc, money, qs, mskToday, errorState, statusLabel, date, plural } from '../ui.js';

export async function render(app, _p, query) {
  const from = query.from || mskToday(-29), to = query.to || mskToday(0);
  const o = state.org;
  let a;
  try { a = await rpc('org_analytics', { p_org: o.id, p_from: from, p_to: to }); }
  catch (err) { app.innerHTML = errorState(err); return; }
  const p = a.provider, c = a.customer;
  const pct = (x, y) => (y ? Math.round((100 * x) / y) : 0) + '%';
  const presets = [['Сегодня', mskToday(0)], ['7 дней', mskToday(-6)], ['30 дней', mskToday(-29)], ['Год', mskToday(-364)]];
  const days = Math.round((new Date(to) - new Date(from)) / 864e5) + 1;
  app.innerHTML = `
    <div class="page-head"><div><h1>Аналитика</h1><p>${esc(o.type === 'PERSON' ? 'Личный профиль' : o.name)} · данные на ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })} МСК</p></div></div>
    <form class="filters" id="pf">
      ${presets.map(([label, f]) => `<a class="pill ${f === from && to === mskToday(0) ? 'on' : ''}" href="#/analytics${qs({ from: f, to: mskToday(0) })}">${label}</a>`).join('')}
      <label class="small muted">с <input class="inp" type="date" name="from" value="${from}" max="${to}"></label>
      <label class="small muted">по <input class="inp" type="date" name="to" value="${to}" min="${from}"></label></form>
    <div class="banner info" style="margin-bottom:14px">Период: <b>&nbsp;${date(from)} — ${date(to)}</b>&nbsp;(${days} ${plural(days, 'день', 'дня', 'дней')}). Отчёт обновляется сразу при выборе дат.</div>
    ${o.can_provide ? `
    <div class="panel"><h2>Как исполнитель</h2>
      <dl class="kv">
        <dt>Выручка по завершённым сделкам</dt><dd class="num">${money(p.revenue)}</dd>
        <dt>В работе и подтверждено (ещё не закрыто)</dt><dd class="num">${money(p.pipeline)}</dd>
        <dt>Новых сделок</dt><dd>${p.deals_total}</dd><dt>Завершено / отменено</dt><dd>${p.deals_completed} / ${p.deals_cancelled}</dd>
        <dt>Предложений отправлено / принято</dt><dd>${p.offers_sent} / ${p.offers_won} (${pct(p.offers_won, p.offers_sent)})</dd>
        <dt>Среднее время подтверждения брони</dt><dd>${p.confirm_hours_median != null ? p.confirm_hours_median + ' ч' : '—'}</dd>
      </dl>
      <h3 style="margin-top:18px">Загрузка техники за период</h3>
      ${p.equipment.length ? `<table class="table resp"><thead><tr><th>Техника</th><th>Статус</th><th>Занято дней</th><th>Загрузка</th><th>Выручка</th></tr></thead><tbody>
        ${p.equipment.map((e) => `<tr><td><a href="#/fleet/${e.id}">${esc(e.title)}</a></td><td class="small">${statusLabel('equipment', e.status)}</td>
          <td class="num">${e.busy_days} из ${e.days}</td><td class="num"><b>${pct(e.busy_days, e.days)}</b></td><td class="num">${money(e.revenue)}</td></tr>`).join('')}
      </tbody></table>` : '<p class="muted">Техники пока нет.</p>'}
    </div>` : ''}
    ${o.can_order ? `
    <div class="panel"><h2>Как заказчик</h2>
      <dl class="kv"><dt>Потрачено (завершённые сделки)</dt><dd class="num">${money(c.spent)}</dd>
        <dt>Обязательства по текущим сделкам</dt><dd class="num">${money(c.committed)}</dd>
        <dt>Сделок</dt><dd>${c.deals_total}</dd><dt>Заказов на бирже / стали сделкой</dt><dd>${c.orders} / ${c.orders_to_deal} (${pct(c.orders_to_deal, c.orders)})</dd></dl>
      ${c.by_category.length ? `<h3 style="margin-top:18px">Расходы по категориям</h3><table class="table resp"><thead><tr><th>Категория</th><th>Сделок</th><th>Сумма</th></tr></thead><tbody>
        ${c.by_category.map((x) => `<tr><td>${esc(x.name)}</td><td class="num">${x.deals}</td><td class="num">${money(x.sum)}</td></tr>`).join('')}</tbody></table>` : ''}
    </div>` : ''}`;
  const f = app.querySelector('#pf');
  const apply = () => {
    if (!f.from.value || !f.to.value) return;
    const [a, b] = f.from.value <= f.to.value ? [f.from.value, f.to.value] : [f.to.value, f.from.value];
    location.hash = '#/analytics' + qs({ from: a, to: b });
  };
  f.from.addEventListener('change', apply);
  f.to.addEventListener('change', apply);
  f.onsubmit = (e) => { e.preventDefault(); apply(); };
}
