// Документы сделки для печати и сохранения в PDF (Модуль 5, упрощённо: формируются из данных сделки в браузере)
import { sb, state, q, rpc } from '../api.js';
import { esc, money, date, dateTime, period, POLICY, ORG_TYPE, errorState, emptyState, WORDMARK } from '../ui.js';
import { renderContract } from '../contract.js';
import { renderWaybill } from '../waybill.js';

const TITLES = { request: 'Заявка-подтверждение', contract: 'Договор', 'handover-START': 'Акт приёма-передачи техники', 'handover-END': 'Акт возврата техники', act: 'Акт выполненных работ (оказанных услуг)' };

export async function render(app, { id, type }) {
  let d, priv, events, hand, work;
  try {
    d = await q(sb.from('deals').select('*, equipment(title,brand,model,year,specs,city,price_unit,price_minor,shift_hours,categories(code)), cust:organizations!deals_customer_org_id_fkey(id,name,type,inn,ogrn,city), prov:organizations!deals_provider_org_id_fkey(id,name,type,inn,ogrn,city)').eq('id', id).maybeSingle());
    if (!d) { app.innerHTML = emptyState('Документ недоступен', 'Сделка не найдена или относится к другой организации — переключите контекст в меню.'); return; }
    [priv, events, hand, work] = await Promise.all([
      rpc('get_deal_private', { p_deal: id }),
      q(sb.from('deal_events').select('*').eq('deal_id', id).order('ts')),
      q(sb.from('handovers').select('*').eq('deal_id', id)),
      q(sb.from('work_sessions').select('*').eq('deal_id', id))
    ]);
  } catch (err) { app.innerHTML = errorState(err); return; }
  // Договор — отдельный модуль (шаблон ред. 3, форма дозаполнения, PDF и Word)
  if (type === 'contract' || type === 'waybill') {
    // Рег. номер и машинист — из карточки учёта парка, её видит только исполнитель; заказчику поля останутся для заполнения
    const fc = await sb.from('fleet_cards').select('reg_number, fleet_operators(full_name, license_no)').eq('equipment_id', d.equipment_id).maybeSingle().then((r) => r.data, () => null);
    if (type === 'contract') return renderContract(app, d, priv, { reg: fc?.reg_number || '' });
    const H = Object.fromEntries(hand.map((h) => [h.type, h]));
    return renderWaybill(app, d, {
      cat: d.equipment?.categories?.code, reg: fc?.reg_number || '', operator: fc?.fleet_operators || null,
      address: priv?.address || '', custContact: priv?.customer, provPhone: priv?.provider?.phone || '',
      work: work.filter((w) => w.status !== 'DISPUTED'), fuelStart: H.START?.fuel_level ?? null, fuelEnd: H.END?.fuel_level ?? null
    });
  }
  const H = Object.fromEntries(hand.map((h) => [h.type, h]));
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
  const workH = work.filter((w) => w.kind === 'WORK' && w.status !== 'DISPUTED').reduce((s, w) => s + Number(w.hours), 0);

  let body = '';
  if (type === 'request') {
    body = `${sides}<h3>Предмет</h3>${subject}<h3>Стоимость</h3>${cost}
      <h3>Условия отмены</h3><p>${esc(POLICY[d.cancel_policy] || '')}.</p>
      ${d.customer_comment ? `<h3>Комментарий заказчика</h3><p>${esc(d.customer_comment)}</p>` : ''}
      <h3>Электронные подтверждения на платформе RUIN</h3><ul>${confirms || '<li>Подтверждений пока нет</li>'}</ul>`;
  } else if (type === 'contract') {
    const kind = d.with_operator ? 'оказания услуг специальной техникой с экипажем' : 'аренды специальной техники без экипажа';
    body = `<div class="doc-draft">ШАБЛОН. Текст договора подготовлен как основа и должен быть проверен юристом перед использованием.</div>
      <p>${esc(d.prov.name)} (далее — Исполнитель) и ${esc(d.cust.name)} (далее — Заказчик) заключили настоящий договор ${kind} о нижеследующем.</p>
      <h3>1. Предмет договора</h3><p>1.1. Исполнитель предоставляет Заказчику технику ${d.with_operator ? 'вместе с экипажем, который управляет техникой и обеспечивает её техническую эксплуатацию' : 'во временное владение и пользование без оказания услуг по управлению'} на условиях, указанных ниже.</p>${subject}
      <h3>2. Стоимость и порядок расчётов</h3>${cost}<p>2.1. Окончательная стоимость определяется по фактически отработанному времени на основании подтверждённых сторонами записей о сменах и простоях.</p>
      <h3>3. Передача и возврат</h3><p>3.1. Передача и возврат техники оформляются актами с фотофиксацией, показаниями моточасов и уровня топлива.</p>
      <h3>4. Отмена</h3><p>4.1. ${esc(POLICY[d.cancel_policy] || '')}.</p>
      <h3>5. Ответственность и споры</h3><p>5.1. Стороны решают разногласия путём переговоров. Платформа RUIN не является стороной договора и не участвует в урегулировании споров. При недостижении согласия спор передаётся в суд по месту нахождения ответчика.</p>
      <h3>6. Реквизиты сторон</h3>${sides}${signs}`;
  } else if (type.startsWith('handover-')) {
    const h = H[type.split('-')[1]];
    if (!h) { body = '<p>Акт ещё не оформлен.</p>'; } else {
      body = `${sides}${subject}<h3>Состояние техники</h3><table class="doc-t">
        <tr><td style="width:30%">Моточасы</td><td>${h.hours_meter ?? '—'}</td></tr><tr><td>Уровень топлива</td><td>${h.fuel_level != null ? h.fuel_level + '%' : '—'}</td></tr>
        <tr><td>Состояние и комплектность</td><td>${esc(h.condition || 'без замечаний')}</td></tr>
        <tr><td>Замечания заказчика</td><td>${esc(h.remarks || 'нет')}</td></tr>
        <tr><td>Оформлен</td><td>${dateTime(h.created_at)}</td></tr>
        <tr><td>Подтверждён заказчиком</td><td>${h.confirmed_at ? dateTime(h.confirmed_at) + ' (электронно на платформе RUIN)' : 'не подтверждён'}</td></tr></table>
        <h3>Фотофиксация</h3><div class="doc-photos">${(h.photos || []).map((p) => `<img src="${esc(p.url)}" alt="">`).join('')}</div>${signs}`;
    }
  } else if (type === 'act') {
    body = `<p>Исполнитель оказал, а Заказчик принял услуги (предоставление техники) по сделке ${esc(d.number)}.</p>${sides}${subject}
      <table class="doc-t"><tr><td style="width:30%">Отработано</td><td>${workH ? workH + ' ч (по подтверждённым записям)' : 'по договорённости сторон'}</td></tr>
      <tr><td>Фактический период</td><td>${period(d.start_date, d.end_date)}</td></tr></table>
      <h3>Стоимость</h3>${cost}<p>Услуги оказаны полностью и в срок. Заказчик претензий по объёму, качеству и срокам не имеет${d.completed_at ? ` (завершение подтверждено ${dateTime(d.completed_at)})` : ''}.</p>${signs}`;
  }

  document.body.classList.add('doc-mode');
  app.innerHTML = `<div class="doc-bar"><button class="btn" data-print>Скачать PDF / печать</button>
      <a class="btn ghost" href="#/deals/${d.id}">← К сделке</a><span class="small muted">В окне печати выберите «Сохранить как PDF»</span></div>
    <article class="doc"><header><div class="doc-logo">${WORDMARK}</div><div class="small">Сформировано на платформе RUIN · ${today}</div></header>
      <h1>${TITLES[type] || 'Документ'} № ${esc(d.number)}</h1>${body}</article>`;
  return () => document.body.classList.remove('doc-mode');
}
