// Дополнительные блоки страницы сделки: документы и отзыв.
// 11.11.2026 (v=73) по решению Этибара убраны блоки «Смены и простои», «Передача и возврат техники» и «Претензия»
// (таблицы work_sessions, handovers, disputes в базе остаются, сайт их больше не показывает и не заполняет).
import { sb, state, q, rpc, canManage } from './api.js';
import { esc, toast, busy, modal, askReason } from './ui.js';
import { route } from './app.js';
import { docFilesPanel, bindDocFiles } from './dealFiles.js';

const CRIT = {
  PROVIDER: [['ON_TIME', 'Соблюдение сроков'], ['AS_DESCRIBED', 'Соответствие описанию'], ['EQUIPMENT_CONDITION', 'Состояние техники'], ['COMMUNICATION', 'Общение']],
  CUSTOMER: [['TERMS_COMPLIANCE', 'Соблюдение договорённостей'], ['PAYMENT_DISCIPLINE', 'Оплата'], ['SITE_READINESS', 'Готовность объекта'], ['COMMUNICATION', 'Общение']]
};
export const stars = (n) => '★'.repeat(n) + '<span class="star-off">' + '★'.repeat(5 - n) + '</span>';
// Отзыв проверяет модератор площадки до публикации (SQL 24). SUBMITTED — старый статус, тоже «на проверке».
export const reviewPending = (r) => ['PENDING', 'SUBMITTED'].includes(r.status);
export function reviewBadge(r) {
  if (reviewPending(r)) return '<span class="st wait">На проверке у модератора</span>';
  if (r.status === 'REJECTED') return '<span class="st err">Отклонён модератором</span>';
  if (r.status === 'EXCLUDED') return '<span class="st err">Исключён модератором</span>';
  if (r.status === 'TEXT_HIDDEN') return '<span class="st warn">Опубликован без текста</span>';
  return '<span class="st ok">Опубликован</span>';
}

export async function renderExtras(box, d) {
  const amCust = state.org.id === d.customer_org_id;
  const act = canManage();
  const [revs, files] = await Promise.all([
    q(sb.from('reviews').select('*').eq('deal_id', d.id)),
    q(sb.from('deal_files').select('*').eq('deal_id', d.id).order('created_at')).catch(() => [])
  ]);
  // Договор и путевые листы — после подтверждения сделки (загруженные файлы видны всегда); заявка — всегда
  const showFiles = (d.status !== 'AWAITING_CONFIRMATION' && d.status !== 'CANCELLED') || files.length > 0;
  const myReview = revs.find((r) => r.author_org_id === state.org.id);
  const theirReview = revs.find((r) => r.author_org_id !== state.org.id && ['PUBLISHED', 'TEXT_HIDDEN'].includes(r.status));
  const reviewOpen = act && (Date.now() - new Date(d.completed_at)) < 14 * 864e5;
  const canEditReview = myReview && reviewOpen && (reviewPending(myReview) || myReview.status === 'REJECTED');

  box.innerHTML = `
    <div class="panel"><h2>Документы</h2><div id="dealFiles"></div></div>

    ${d.status === 'COMPLETED' ? `
    <div class="panel"><h2>Отзыв</h2>
      ${myReview ? `<div><b>Ваш отзыв:</b> ${stars(myReview.overall)} ${reviewBadge(myReview)}
          ${myReview.text ? `<p style="margin:6px 0 0">${esc(myReview.text)}</p>` : ''}
          ${myReview.moderation_comment && myReview.status !== 'PUBLISHED' ? `<div class="small warn-text" style="margin-top:4px">Модератор: ${esc(myReview.moderation_comment)}</div>` : ''}
          ${reviewPending(myReview) ? '<div class="small muted" style="margin-top:4px">Отзыв появится у всех после проверки модератором. Пока он на проверке, его можно исправить.</div>' : ''}
          ${canEditReview ? `<button class="btn ghost sm" id="reviewBtn" style="margin-top:8px">${myReview.status === 'REJECTED' ? 'Исправить и отправить снова' : 'Исправить отзыв'}</button>` : ''}</div>`
        : reviewOpen ? '<button class="btn" id="reviewBtn">Оставить отзыв</button> <span class="small muted">Отзыв опубликуется после проверки модератором</span>'
        : '<p class="muted">Окно для отзыва закрыто.</p>'}
      ${theirReview ? `<div class="divider"></div><div><b>Отзыв о вас:</b> ${stars(theirReview.overall)}${theirReview.text && theirReview.status !== 'TEXT_HIDDEN' ? `<p style="margin:6px 0 0">${esc(theirReview.text)}</p>` : ''}
          ${theirReview.reply_text ? `<p class="small" style="margin:6px 0 0"><b>Ваш ответ:</b> ${esc(theirReview.reply_text)}</p>`
          : act ? `<button class="btn ghost sm" data-reply="${theirReview.id}" style="margin-top:6px">Ответить на отзыв</button>` : ''}</div>` : ''}
    </div>` : ''}`;

  const reload = () => route();
  // --- договор и путевые листы: после загрузки/удаления обновляется только этот блок ---
  const filesBox = box.querySelector('#dealFiles');
  const drawFiles = (list) => {
    filesBox.innerHTML = docFilesPanel(d, list, act && d.status !== 'CANCELLED', showFiles || list.length > 0);
    bindDocFiles(filesBox, d, list, async () => drawFiles(await q(sb.from('deal_files').select('*').eq('deal_id', d.id).order('created_at')).catch(() => list)));
  };
  drawFiles(files);
  // --- отзывы ---
  box.querySelector('#reviewBtn')?.addEventListener('click', () => reviewDialog(d, amCust ? 'PROVIDER' : 'CUSTOMER', reload, myReview));
  box.querySelectorAll('[data-reply]').forEach((b) => b.onclick = async () => {
    const r = await askReason('Ответ на отзыв', 'Ответ будет виден всем под отзывом. Изменить его нельзя.', 'Ответ', 'Опубликовать ответ');
    if (!r) return;
    try { await rpc('reply_review', { p_review: b.dataset.reply, p_text: r }); toast('Ответ опубликован'); reload(); } catch (e) { toast(e.message, true); }
  });
}

function reviewDialog(d, role, done, old) {
  const crit = CRIT[role];
  const starInput = (name) => `<span class="star-input" data-name="${name}">${[1, 2, 3, 4, 5].map((i) => `<button type="button" data-v="${i}" aria-label="${i}">★</button>`).join('')}</span>`;
  const m = modal(`<h2>Отзыв ${role === 'PROVIDER' ? 'об исполнителе' : 'о заказчике'}</h2>
    <p class="muted small" style="margin-top:-6px">Отзыв сначала проверит модератор площадки, после этого его увидят все. Пока отзыв на проверке, его можно исправить; после публикации — нельзя.</p>
    ${old?.status === 'REJECTED' && old.moderation_comment ? `<div class="banner warn small" style="display:block">Причина отклонения: ${esc(old.moderation_comment)}</div>` : ''}
    <form id="rf">
      <label class="f"><span>Общая оценка <i>*</i></span>${starInput('overall')}</label>
      ${crit.map(([k, l]) => `<label class="f"><span>${l}</span>${starInput(k)}</label>`).join('')}
      <label class="f"><span>Текст отзыва</span><textarea class="inp" name="t" maxlength="2000" placeholder="Что понравилось, что можно улучшить">${esc(old?.text || '')}</textarea></label>
      <div class="form-error hidden" id="err"></div>
      <button class="btn wide">${old ? 'Отправить на проверку' : 'Отправить отзыв'}</button></form>`);
  const vals = {};
  const setStars = (g, v) => { vals[g.dataset.name] = v; g.querySelectorAll('button').forEach((x) => x.classList.toggle('on', Number(x.dataset.v) <= v)); };
  m.el.querySelectorAll('.star-input').forEach((g) => {
    const pre = g.dataset.name === 'overall' ? old?.overall : old?.criteria?.[g.dataset.name];
    if (pre) setStars(g, Number(pre));
    g.querySelectorAll('button').forEach((b) => b.onclick = () => setStars(g, Number(b.dataset.v)));
  });
  m.el.querySelector('#rf').onsubmit = (e) => {
    e.preventDefault();
    const err = m.el.querySelector('#err');
    if (!vals.overall) { err.textContent = 'Поставьте общую оценку'; err.classList.remove('hidden'); return; }
    const criteria = Object.fromEntries(crit.filter(([k]) => vals[k]).map(([k]) => [k, vals[k]]));
    busy(e.target.querySelector('button'), async () => {
      try { await rpc('submit_review', { p_deal: d.id, p_org: state.org.id, p_overall: vals.overall, p_criteria: criteria, p_text: e.target.t.value });
        m.close(); toast('Спасибо! Отзыв отправлен на проверку модератору'); done(); }
      catch (x) { err.textContent = x.message; err.classList.remove('hidden'); }
    });
  };
}
