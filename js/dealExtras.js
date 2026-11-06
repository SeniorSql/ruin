// Дополнительные блоки страницы сделки: документы, акты передачи/возврата, смены, претензия, отзыв
import { sb, state, q, rpc, canManage, uploadPhoto } from './api.js';
import { esc, money, toast, busy, modal, askReason, date, dateTime, mskToday, safeUrl } from './ui.js';
import { route } from './app.js';

const REASONS = ['Техника не прибыла', 'Опоздание', 'Другая техника', 'Характеристики не соответствуют', 'Техника неисправна',
  'Площадка не готова / нет доступа', 'Спор о простое или переработке', 'Ущерб технике или имуществу', 'Несогласованная стоимость', 'Другое'];
const DOWNTIME = { CUSTOMER_FAULT: 'по вине заказчика', PROVIDER_FAULT: 'по вине исполнителя', WEATHER: 'погода', OTHER: 'другое' };
const WS = { RECORDED: ['wait', 'Ждёт подтверждения'], ACCEPTED: ['ok', 'Принято'], DISPUTED: ['err', 'Оспорено'], ACCEPTED_BY_TIMEOUT: ['ok', 'Принято автоматически'] };
const DS = { OPEN: ['wait', 'Ждёт ответа'], IN_REVIEW: ['work', 'У администратора'], RESOLVED: ['ok', 'Требование признано'], REJECTED: ['closed', 'Отклонено'], WITHDRAWN: ['closed', 'Отозвано'] };
const st = (m, c) => `<span class="st ${m[c][0]}">${m[c][1]}</span>`;
const CRIT = {
  PROVIDER: [['ON_TIME', 'Соблюдение сроков'], ['AS_DESCRIBED', 'Соответствие описанию'], ['EQUIPMENT_CONDITION', 'Состояние техники'], ['COMMUNICATION', 'Общение']],
  CUSTOMER: [['TERMS_COMPLIANCE', 'Соблюдение договорённостей'], ['PAYMENT_DISCIPLINE', 'Оплата'], ['SITE_READINESS', 'Готовность объекта'], ['COMMUNICATION', 'Общение']]
};
export const stars = (n) => '★'.repeat(n) + '<span class="star-off">' + '★'.repeat(5 - n) + '</span>';

export async function renderExtras(box, d) {
  const amCust = state.org.id === d.customer_org_id;
  const amProv = state.org.id === d.provider_org_id;
  const act = canManage();
  const [hand, work, disp, revs] = await Promise.all([
    q(sb.from('handovers').select('*').eq('deal_id', d.id)),
    q(sb.from('work_sessions').select('*').eq('deal_id', d.id).order('work_date').order('created_at')),
    q(sb.from('disputes').select('*').eq('deal_id', d.id).order('created_at', { ascending: false })),
    q(sb.from('reviews').select('*').eq('deal_id', d.id))
  ]);
  const H = Object.fromEntries(hand.map((h) => [h.type, h]));
  const openDisp = disp.find((x) => ['OPEN', 'IN_REVIEW'].includes(x.status));
  const started = ['IN_PROGRESS', 'COMPLETION_PENDING', 'COMPLETED'].includes(d.status);
  const myReview = revs.find((r) => r.author_org_id === state.org.id);
  const theirReview = revs.find((r) => r.author_org_id !== state.org.id && r.status !== 'SUBMITTED');
  const workTotal = work.filter((w) => w.kind === 'WORK' && w.status !== 'DISPUTED').reduce((s, w) => s + Number(w.hours), 0);
  const downTotal = work.filter((w) => w.kind === 'DOWNTIME' && w.status !== 'DISPUTED').reduce((s, w) => s + Number(w.hours), 0);

  box.innerHTML = `
    <div class="panel"><h2>Документы</h2>
      <p class="small muted" style="margin-top:-6px">Формируются из данных сделки. Откроются в новой вкладке — сохраните в PDF через «Печать → Сохранить как PDF».</p>
      <div class="actions">
        <a class="btn ghost sm" target="_blank" href="#/deals/${d.id}/doc/request">Заявка-подтверждение</a>
        ${d.status !== 'AWAITING_CONFIRMATION' && d.status !== 'CANCELLED' ? `<a class="btn ghost sm" target="_blank" href="#/deals/${d.id}/doc/contract">Договор (шаблон)</a>` : ''}
        ${H.START ? `<a class="btn ghost sm" target="_blank" href="#/deals/${d.id}/doc/handover-START">Акт передачи</a>` : ''}
        ${H.END ? `<a class="btn ghost sm" target="_blank" href="#/deals/${d.id}/doc/handover-END">Акт возврата</a>` : ''}
        ${d.status === 'COMPLETED' ? `<a class="btn ghost sm" target="_blank" href="#/deals/${d.id}/doc/act">Акт выполненных работ</a>` : ''}
      </div></div>

    ${d.status === 'CANCELLED' || d.status === 'AWAITING_CONFIRMATION' ? '' : `
    <div class="panel"><h2>Передача и возврат техники</h2>
      ${['START', 'END'].map((t) => handoverBlock(t, H[t], d, amProv, amCust, act)).join('<div class="divider"></div>')}
    </div>`}

    ${started ? `<div class="panel"><h2>Смены и простои</h2>
      <p class="small muted" style="margin-top:-6px">Исполнитель записывает отработанные часы, заказчик подтверждает. Без ответа 24 часа запись принимается автоматически.</p>
      ${work.length ? `<table class="table resp"><thead><tr><th>Дата</th><th>Что</th><th>Часов</th><th>Статус</th><th></th></tr></thead><tbody>
        ${work.map((w) => `<tr><td>${date(w.work_date)}</td><td>${w.kind === 'WORK' ? 'Работа' : 'Простой — ' + DOWNTIME[w.reason]}${w.comment ? `<div class="small muted">${esc(w.comment)}</div>` : ''}
          ${w.customer_comment ? `<div class="small warn-text">Заказчик: ${esc(w.customer_comment)}</div>` : ''}</td>
          <td class="num">${Number(w.hours)}</td><td>${st(WS, w.status)}</td>
          <td>${amCust && act && w.status === 'RECORDED' ? `<div class="actions"><button class="btn sm" data-wok="${w.id}">Принять</button><button class="btn ghost sm" data-wno="${w.id}">Оспорить</button></div>` : ''}</td></tr>`).join('')}
        </tbody></table>
        <p class="small"><b>Итого работы: ${workTotal} ч</b>${downTotal ? ` · простоя: ${downTotal} ч` : ''}</p>` : '<p class="muted">Записей пока нет.</p>'}
      ${amProv && act && ['IN_PROGRESS', 'COMPLETION_PENDING'].includes(d.status) ? `
        <form id="wf" class="actions" style="margin-top:10px">
          <input class="inp" type="date" name="d" required value="${mskToday(0) > d.end_date ? d.end_date : mskToday(0)}" min="${d.start_date}" style="width:150px">
          <select class="inp" name="k" style="width:auto"><option value="WORK">Работа</option><option value="DOWNTIME">Простой</option></select>
          <input class="inp" type="number" name="h" min="0.5" max="24" step="0.5" required placeholder="Часов" style="width:100px">
          <select class="inp" name="r" style="width:auto" disabled>${Object.entries(DOWNTIME).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
          <input class="inp" name="c" placeholder="Комментарий" style="width:200px">
          <button class="btn dark">Записать</button></form>` : ''}
    </div>` : ''}

    ${d.status === 'CANCELLED' || d.status === 'AWAITING_CONFIRMATION' ? '' : `
    <div class="panel"><h2>Претензия</h2>
      ${disp.length ? disp.map((x) => disputeBlock(x, act)).join('<div class="divider"></div>') : '<p class="muted">Претензий нет.</p>'}
      ${!openDisp && act && (d.status !== 'COMPLETED' || (Date.now() - new Date(d.completed_at)) < 7 * 864e5)
        ? '<button class="btn ghost sm" id="openDisp" style="margin-top:8px">Сообщить о проблеме</button>' : ''}
    </div>`}

    ${d.status === 'COMPLETED' ? `
    <div class="panel"><h2>Отзыв</h2>
      ${myReview ? `<div><b>Ваш отзыв:</b> ${stars(myReview.overall)} ${myReview.status === 'SUBMITTED' ? '<span class="st wait">Опубликуется, когда отзыв оставит вторая сторона или через 14 дней</span>' : '<span class="st ok">Опубликован</span>'}
          ${myReview.text ? `<p style="margin:6px 0 0">${esc(myReview.text)}</p>` : ''}</div>`
        : act && (Date.now() - new Date(d.completed_at)) < 14 * 864e5 && !openDisp ? '<button class="btn" id="reviewBtn">Оставить отзыв</button> <span class="small muted">Отзыв второй стороны откроется, когда вы оставите свой</span>'
        : '<p class="muted">Окно для отзыва закрыто.</p>'}
      ${theirReview ? `<div class="divider"></div><div><b>Отзыв о вас:</b> ${stars(theirReview.overall)}${theirReview.text && theirReview.status !== 'TEXT_HIDDEN' ? `<p style="margin:6px 0 0">${esc(theirReview.text)}</p>` : ''}
          ${theirReview.reply_text ? `<p class="small" style="margin:6px 0 0"><b>Ваш ответ:</b> ${esc(theirReview.reply_text)}</p>`
          : act ? `<button class="btn ghost sm" data-reply="${theirReview.id}" style="margin-top:6px">Ответить на отзыв</button>` : ''}</div>` : ''}
    </div>` : ''}`;

  const reload = () => route();
  // --- акты ---
  box.querySelectorAll('[data-hand]').forEach((b) => b.onclick = () => handoverDialog(d, b.dataset.hand, reload));
  box.querySelectorAll('[data-hconf]').forEach((b) => b.onclick = () => busy(b, async () => {
    try { await rpc('confirm_handover', { p_deal: d.id, p_type: b.dataset.hconf, p_remarks: null }); toast('Акт подтверждён'); reload(); } catch (e) { toast(e.message, true); }
  }));
  box.querySelectorAll('[data-hrem]').forEach((b) => b.onclick = async () => {
    const r = await askReason('Подтвердить с замечаниями', 'Опишите расхождения: повреждения, некомплект, уровень топлива. Замечания увидит исполнитель.', 'Замечания', 'Подтвердить с замечаниями');
    if (!r) return;
    try { await rpc('confirm_handover', { p_deal: d.id, p_type: b.dataset.hrem, p_remarks: r }); toast('Акт подтверждён с замечаниями'); reload(); } catch (e) { toast(e.message, true); }
  });
  // --- смены ---
  const wf = box.querySelector('#wf');
  if (wf) {
    wf.k.onchange = () => { wf.r.disabled = wf.k.value !== 'DOWNTIME'; };
    wf.onsubmit = (e) => { e.preventDefault(); busy(wf.querySelector('button'), async () => {
      try { await rpc('add_work_session', { p_deal: d.id, p_date: wf.d.value, p_kind: wf.k.value, p_hours: Number(wf.h.value), p_reason: wf.k.value === 'DOWNTIME' ? wf.r.value : null, p_comment: wf.c.value }); toast('Записано'); reload(); }
      catch (err) { toast(err.message, true); }
    }); };
  }
  box.querySelectorAll('[data-wok]').forEach((b) => b.onclick = () => busy(b, async () => {
    try { await rpc('decide_work_session', { p_id: b.dataset.wok, p_accept: true, p_comment: null }); reload(); } catch (e) { toast(e.message, true); }
  }));
  box.querySelectorAll('[data-wno]').forEach((b) => b.onclick = async () => {
    const r = await askReason('Оспорить запись', 'Укажите, сколько часов было на самом деле или что не так.', 'Комментарий', 'Оспорить');
    if (!r) return;
    try { await rpc('decide_work_session', { p_id: b.dataset.wno, p_accept: false, p_comment: r }); reload(); } catch (e) { toast(e.message, true); }
  });
  // --- претензии ---
  box.querySelector('#openDisp')?.addEventListener('click', () => disputeDialog(d, reload));
  box.querySelectorAll('[data-dresp]').forEach((b) => b.onclick = async () => {
    const r = await askReason('Ответ на претензию', 'Изложите вашу позицию. Приложите фото в чат сделки, если есть.', 'Ваш ответ', 'Отправить ответ');
    if (!r) return;
    try { await rpc('respond_dispute', { p_id: b.dataset.dresp, p_text: r }); toast('Ответ отправлен'); reload(); } catch (e) { toast(e.message, true); }
  });
  box.querySelectorAll('[data-dwd]').forEach((b) => b.onclick = () => busy(b, async () => {
    try { await rpc('withdraw_dispute', { p_id: b.dataset.dwd }); toast('Претензия отозвана'); reload(); } catch (e) { toast(e.message, true); }
  }));
  // --- отзывы ---
  box.querySelector('#reviewBtn')?.addEventListener('click', () => reviewDialog(d, amCust ? 'PROVIDER' : 'CUSTOMER', reload));
  box.querySelectorAll('[data-reply]').forEach((b) => b.onclick = async () => {
    const r = await askReason('Ответ на отзыв', 'Ответ будет виден всем под отзывом. Изменить его нельзя.', 'Ответ', 'Опубликовать ответ');
    if (!r) return;
    try { await rpc('reply_review', { p_review: b.dataset.reply, p_text: r }); toast('Ответ опубликован'); reload(); } catch (e) { toast(e.message, true); }
  });

  function disputeBlock(x, act) {
    const mine = x.opened_by_org === state.org.id;
    return `<div><div class="actions" style="justify-content:space-between"><b>${esc(x.reason)}</b>${st(DS, x.status)}</div>
      <p style="margin:6px 0;white-space:pre-wrap">${esc(x.description)}</p>
      <div class="small muted">${mine ? 'Открыта вами' : 'Открыта второй стороной'} · ${dateTime(x.created_at)}${x.amount_minor ? ' · сумма требования ' + money(x.amount_minor) : ''}${x.desired_outcome ? ' · хотят: ' + esc(x.desired_outcome) : ''}</div>
      ${x.response_text ? `<p class="small" style="margin:8px 0 0"><b>Ответ:</b> ${esc(x.response_text)}</p>` : ''}
      ${x.decision ? `<div class="banner ${x.status === 'RESOLVED' ? 'ok' : 'info'}" style="margin:8px 0 0"><b>Решение администратора:</b>&nbsp;${esc(x.decision)}</div>` : ''}
      ${act && ['OPEN', 'IN_REVIEW'].includes(x.status) ? `<div class="actions" style="margin-top:8px">
        ${!mine && !x.response_text ? `<button class="btn sm" data-dresp="${x.id}">Ответить</button>` : ''}
        ${mine ? `<button class="btn ghost sm" data-dwd="${x.id}">Отозвать претензию</button>` : ''}</div>` : ''}</div>`;
  }
}

function handoverBlock(type, h, d, amProv, amCust, act) {
  const name = type === 'START' ? 'Акт передачи' : 'Акт возврата';
  const canSubmit = amProv && act && (type === 'START' ? ['CONFIRMED', 'IN_PROGRESS'].includes(d.status) : d.status === 'IN_PROGRESS') && (!h || h.status === 'SUBMITTED');
  if (!h) return `<div class="actions" style="justify-content:space-between"><div><b>${name}</b><div class="small muted">${type === 'START' ? 'Оформляется исполнителем при передаче техники — после него сделка переходит в работу' : 'Оформляется при возврате техники'}</div></div>
    ${canSubmit ? `<button class="btn sm" data-hand="${type}">Оформить</button>` : '<span class="small muted">Не оформлен</span>'}</div>`;
  const stl = { SUBMITTED: '<span class="st wait">Ждёт подтверждения заказчика</span>', CONFIRMED: '<span class="st ok">Подтверждён</span>', CONFIRMED_WITH_REMARKS: '<span class="st warn">Подтверждён с замечаниями</span>' }[h.status];
  return `<div><div class="actions" style="justify-content:space-between"><b>${name}</b>${stl}</div>
    <div class="small" style="margin:6px 0">Моточасы: <b>${h.hours_meter ?? '—'}</b> · топливо: <b>${h.fuel_level != null ? h.fuel_level + '%' : '—'}</b> · ${dateTime(h.created_at)}</div>
    ${h.condition ? `<p class="small" style="margin:0 0 6px">${esc(h.condition)}</p>` : ''}
    <div class="photo-grid">${(h.photos || []).map((p) => `<a class="ph" href="${safeUrl(p.url)}" target="_blank" rel="noopener"><img src="${esc(p.url)}" alt="Фото к акту"></a>`).join('')}</div>
    ${h.remarks ? `<div class="banner warn" style="margin:8px 0 0">Замечания заказчика: ${esc(h.remarks)}</div>` : ''}
    <div class="actions" style="margin-top:8px">
      ${amCust && act && h.status === 'SUBMITTED' ? `<button class="btn sm" data-hconf="${type}">Подтвердить</button><button class="btn ghost sm" data-hrem="${type}">С замечаниями</button>` : ''}
      ${canSubmit ? `<button class="btn ghost sm" data-hand="${type}">Исправить</button>` : ''}</div></div>`;
}

function handoverDialog(d, type, done) {
  const photos = [];
  const m = modal(`<h2>${type === 'START' ? 'Акт передачи техники' : 'Акт возврата техники'}</h2>
    <p class="muted small" style="margin-top:-6px">Заполните при ${type === 'START' ? 'передаче' : 'возврате'}. Заказчик подтвердит акт в своём кабинете. Фото: общий вид, счётчик моточасов, уровень топлива, повреждения.</p>
    <form id="hf">
      <div class="grid2"><label class="f"><span>Моточасы</span><input class="inp" name="h" type="number" min="0" step="0.1"></label>
        <label class="f"><span>Топливо, %</span><input class="inp" name="fu" type="number" min="0" max="100"></label></div>
      <label class="f"><span>Состояние и комплектность</span><textarea class="inp" name="c" maxlength="2000" placeholder="Повреждения, навесное оборудование, замечания"></textarea></label>
      <span style="display:block;font-size:13px;font-weight:700;margin-bottom:6px">Фото (минимум 2)</span>
      <div class="photo-grid" id="hp"><label class="photo-add" for="hfile"><span>+ Добавить фото</span></label></div>
      <input type="file" id="hfile" accept="image/jpeg,image/png,image/webp" multiple class="hidden">
      <div class="form-error hidden" id="err"></div>
      <button class="btn wide" style="margin-top:12px">Отправить акт</button></form>`);
  const grid = m.el.querySelector('#hp');
  const draw = () => {
    grid.innerHTML = photos.map((p) => `<div class="ph"><img src="${esc(p.url)}" alt=""></div>`).join('') + '<label class="photo-add" for="hfile"><span>+ Добавить фото</span></label>';
  };
  m.el.querySelector('#hfile').onchange = async (e) => {
    for (const f of [...e.target.files].slice(0, 10)) {
      try { toast('Загружаем фото…'); photos.push({ url: await uploadPhoto(d.provider_org_id, f) }); draw(); } catch (err) { toast(err.message, true); }
    }
    e.target.value = '';
  };
  m.el.querySelector('#hf').onsubmit = (e) => {
    e.preventDefault();
    const f = e.target;
    busy(f.querySelector('button'), async () => {
      try {
        await rpc('submit_handover', { p_deal: d.id, p_type: type, p_hours: f.h.value ? Number(f.h.value) : null,
          p_fuel: f.fu.value ? Number(f.fu.value) : null, p_condition: f.c.value, p_photos: photos });
        m.close(); toast('Акт отправлен заказчику'); done();
      } catch (err) { const el = m.el.querySelector('#err'); el.textContent = err.message; el.classList.remove('hidden'); }
    });
  };
}

function disputeDialog(d, done) {
  const m = modal(`<h2>Сообщить о проблеме</h2>
    <p class="muted small" style="margin-top:-6px">Вторая сторона получит уведомление и сможет ответить. Если не договоритесь — решение примет администратор платформы. Пока претензия открыта, сделку нельзя закрыть.</p>
    <form id="df">
      <label class="f"><span>Что случилось <i>*</i></span><select class="inp" name="r" required><option value="">Выберите</option>${REASONS.map((r) => `<option>${r}</option>`).join('')}</select></label>
      <label class="f"><span>Подробности <i>*</i></span><textarea class="inp" name="t" required minlength="10" maxlength="3000" placeholder="Что произошло, когда, какие есть доказательства (фото приложите в чат сделки)"></textarea></label>
      <div class="grid2"><label class="f"><span>Сумма требования, ₽</span><input class="inp" name="a" type="number" min="0" step="1" max="1000000000"></label>
        <label class="f"><span>Чего вы хотите</span><select class="inp" name="o"><option value="">—</option><option>Снизить стоимость</option><option>Вернуть деньги</option><option>Доделать работы</option><option>Возместить ущерб</option><option>Другое</option></select></label></div>
      <div class="form-error hidden" id="err"></div>
      <button class="btn wide">Открыть претензию</button></form>`);
  m.el.querySelector('#df').onsubmit = (e) => {
    e.preventDefault();
    const f = e.target;
    busy(f.querySelector('button'), async () => {
      try {
        await rpc('open_dispute', { p_deal: d.id, p_org: state.org.id, p_reason: f.r.value, p_description: f.t.value,
          p_amount: f.a.value ? Math.round(Number(f.a.value) * 100) : null, p_outcome: f.o.value });
        m.close(); toast('Претензия открыта'); done();
      } catch (err) { const el = m.el.querySelector('#err'); el.textContent = err.message; el.classList.remove('hidden'); }
    });
  };
}

function reviewDialog(d, role, done) {
  const crit = CRIT[role];
  const starInput = (name) => `<span class="star-input" data-name="${name}">${[1, 2, 3, 4, 5].map((i) => `<button type="button" data-v="${i}" aria-label="${i}">★</button>`).join('')}</span>`;
  const m = modal(`<h2>Отзыв ${role === 'PROVIDER' ? 'об исполнителе' : 'о заказчике'}</h2>
    <p class="muted small" style="margin-top:-6px">Отзыв увидят все, но только когда вторая сторона тоже оставит свой или пройдёт 14 дней. Изменить после публикации нельзя.</p>
    <form id="rf">
      <label class="f"><span>Общая оценка <i>*</i></span>${starInput('overall')}</label>
      ${crit.map(([k, l]) => `<label class="f"><span>${l}</span>${starInput(k)}</label>`).join('')}
      <label class="f"><span>Текст отзыва</span><textarea class="inp" name="t" maxlength="2000" placeholder="Что понравилось, что можно улучшить"></textarea></label>
      <div class="form-error hidden" id="err"></div>
      <button class="btn wide">Отправить отзыв</button></form>`);
  const vals = {};
  m.el.querySelectorAll('.star-input').forEach((g) => g.querySelectorAll('button').forEach((b) => b.onclick = () => {
    vals[g.dataset.name] = Number(b.dataset.v);
    g.querySelectorAll('button').forEach((x) => x.classList.toggle('on', Number(x.dataset.v) <= vals[g.dataset.name]));
  }));
  m.el.querySelector('#rf').onsubmit = (e) => {
    e.preventDefault();
    const err = m.el.querySelector('#err');
    if (!vals.overall) { err.textContent = 'Поставьте общую оценку'; err.classList.remove('hidden'); return; }
    const criteria = Object.fromEntries(crit.filter(([k]) => vals[k]).map(([k]) => [k, vals[k]]));
    busy(e.target.querySelector('button'), async () => {
      try { await rpc('submit_review', { p_deal: d.id, p_org: state.org.id, p_overall: vals.overall, p_criteria: criteria, p_text: e.target.t.value });
        m.close(); toast('Спасибо за отзыв!'); done(); }
      catch (x) { err.textContent = x.message; err.classList.remove('hidden'); }
    });
  };
}
