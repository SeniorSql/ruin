// Документы сделки для печати и сохранения в PDF (Модуль 5, упрощённо: формируются из данных сделки в браузере)
import { sb, state, q, rpc } from '../api.js';
import { esc, money, date, dateTime, period, POLICY, ORG_TYPE, errorState, emptyState, WORDMARK } from '../ui.js';

// Договор и путевые листы с 11.11.2026 — не здесь: форма .docx/zip скачивается и подписанные файлы загружаются в блоке сделки (dealFiles.js)
// Акты передачи/возврата техники и учёт смен убраны с сайта (11.11.2026, v=73)
const TITLES = { request: 'Заявка-подтверждение', act: 'Акт выполненных работ (оказанных услуг)' };

export async function render(app, { id, type }) {
  if (!TITLES[type]) { app.innerHTML = emptyState('Документ недоступен', 'Документы сделки — в карточке сделки, блок «Документы».'); return; }
  let d, priv, events;
  try {
    d = await q(sb.from('deals').select('*, equipment(title,brand,model,year,specs,city,price_unit,price_minor,shift_hours,categories(code)), cust:organizations!deals_customer_org_id_fkey(id,name,type,inn,ogrn,city), prov:organizations!deals_provider_org_id_fkey(id,name,type,inn,ogrn,city)').eq('id', id).maybeSingle());
    if (!d) { app.innerHTML = emptyState('Документ недоступен', 'Сделка не найдена или относится к другой организации — переключите организацию в меню под вашим именем.'); return; }
    [priv, events] = await Promise.all([
      rpc('get_deal_private', { p_deal: id }),
      q(sb.from('deal_events').select('*').eq('deal_id', id).order('ts'))
    ]);
  } catch (err) { app.innerHTML = errorState(err); return; }
  const today = date(new Date().toISOString());
  const party = (o, c) => `<b>${esc(o.type === 'PERSON' ? o.name + ' (физическое лицо)' : o.name)}</b>${o.type !== 'PERSON' ? `, ${ORG_TYPE[o.type]}` : ''}
    ${o.inn ? `, ИНН ${esc(o.inn)}` : ''}${o.ogrn ? `, ОГРН ${esc(o.ogrn)}` : ''}${o.city ? `, ${esc(o.city)}` : ''}
    ${c && priv?.open ? `<br><span class="small">Контакт: ${esc(c.contact_person || '')} ${esc(c.phone || '')} ${esc(c.email || '')}</span>` : ''}`;
  const sides = `<table class="doc-t"><tr><td style="width:30%">Исполнитель</td><td>${party(d.prov, priv?.provider)}</td></tr>
    <tr><td>Заказчик</td><td>${party(d.cust, priv?.customer)}</td></tr></table>`;
  const subject = `<table class="doc-t">
    <tr><td style="width:30%">Техника</td><td>${esc(d.equipment?.title)} (${esc(d.equipment?.brand)} ${esc(d.equipment?.model)}${d.equipment?.year ? ', ' + d.equipment.year + ' г.' : ''})</td></tr>
    <tr><td>Формат</td><td>${d.with_operator ? 'с экипажем (оператором) — услуги спецтехники' : 'без экипажа — аренда'}</td></tr>
    <tr><td>Период</td><td>${period(d.start_date, d.end_date)}</td></tr>
    <tr><td>Адрес объекта</td><td>${esc(priv?.address || 'раскрывается после подтверждения сделки')}</td></tr></table>`;
  const lines = (d.breakdown?.lines || []).filter((l) => l.amount > 0);
  const cost = `<table class="doc-t">${lines.map((l) => `<tr><td>${esc(l.label)}</td><td class="num" style="text-align:right">${money(l.amount)}</td></tr>`).join('')}
    <tr><td><b>Итого</b></td><td class="num" style="text-align:right"><b>${money(d.total_minor)}</b></td></tr></table>
    <p class="small">НДС — в соответствии с налоговым режимом исполнителя. Оплата производится напрямую исполнителю.</p>`;
  const signs = `<table class="doc-sign"><tr><td>Исполнитель<br><br>________________ / ____________</td><td>Заказчик<br><br>________________ / ____________</td></tr></table>`;
  const evText = (t) => ({ deal_confirmed_by_customer: 'Заказчик подтвердил условия', deal_confirmed: 'Исполнитель подтвердил сделку', deal_completed: 'Сделка завершена' }[t]);
  const confirms = events.filter((e) => evText(e.type)).map((e) => `<li>${evText(e.type)} — ${dateTime(e.ts)}</li>`).join('');

  let body = '';
  if (type === 'request') {
    body = `${sides}<h3>Предмет</h3>${subject}<h3>Стоимость</h3>${cost}
      <h3>Условия отмены</h3><p>${esc(POLICY[d.cancel_policy] || '')}.</p>
      ${d.customer_comment ? `<h3>Комментарий заказчика</h3><p>${esc(d.customer_comment)}</p>` : ''}
      <h3>Электронные подтверждения на платформе RUIN</h3><ul>${confirms || '<li>Подтверждений пока нет</li>'}</ul>`;
  } else if (type === 'act') {
    body = `<p>Исполнитель оказал, а Заказчик принял услуги (предоставление техники) по сделке ${esc(d.number)}.</p>${sides}${subject}
      <table class="doc-t"><tr><td style="width:30%">Фактический период</td><td>${period(d.start_date, d.end_date)}</td></tr></table>
      <h3>Стоимость</h3>${cost}<p>Услуги оказаны полностью и в срок. Заказчик претензий по объёму, качеству и срокам не имеет${d.completed_at ? ` (завершение подтверждено ${dateTime(d.completed_at)})` : ''}.</p>${signs}`;
  }

  document.body.classList.add('doc-mode');
  app.innerHTML = `<div class="doc-bar"><button class="btn" data-print>Скачать PDF / печать</button>
      <a class="btn ghost" href="#/deals/${d.id}">← К сделке</a><span class="small muted">В окне печати выберите «Сохранить как PDF»</span></div>
    <article class="doc"><header><div class="doc-logo">${WORDMARK}</div><div class="small">Сформировано на платформе RUIN · ${today}</div></header>
      <h1>${TITLES[type] || 'Документ'} № ${esc(d.number)}</h1>${body}</article>`;
  return () => document.body.classList.remove('doc-mode');
}
