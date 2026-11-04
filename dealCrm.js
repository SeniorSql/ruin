// Продление аренды и личные заметки/напоминания по сделке («Рабочий стол»)
import { sb, state, q, rpc, canManage, refreshCounters, mskDate } from './api.js';
import { esc, money, toast, busy, modal, askReason, date, dateTime, toMinor, fromMinor, plural } from './ui.js';
import { route, refreshShell } from './app.js';

const EXT_ST = { REQUESTED: ['wait', 'Ждёт ответа'], ACCEPTED: ['ok', 'Принято'], DECLINED: ['err', 'Отклонено'], CANCELLED: ['closed', 'Отозвано'] };
const daysTo = (d) => Math.round((new Date(d + 'T00:00:00') - new Date(mskDate(0) + 'T00:00:00')) / 864e5);

// ---------- Продление ----------
export async function renderExtension(box, d) {
  const active = ['CONFIRMED', 'IN_PROGRESS'].includes(d.status);
  let rows = [];
  try { rows = await q(sb.from('deal_extensions').select('*').eq('deal_id', d.id).order('created_at', { ascending: false })); }
  catch { box.innerHTML = ''; return; }   // таблица появится после 07_crm.sql
  if (!active && !rows.length) { box.innerHTML = ''; return; }
  const open = rows.find((x) => x.status === 'REQUESTED');
  const mine = open && open.requested_by_org === state.org.id;
  const left = daysTo(d.end_date);
  const act = canManage();
  const who = (x) => (x.requested_by_org === d.customer_org_id ? 'заказчик' : 'исполнитель');

  box.innerHTML = `<div class="panel"><h2>Продление аренды</h2>
    ${active && !open && left <= 2 ? `<div class="banner warn">Аренда заканчивается ${left < 0 ? 'уже прошла дата окончания' : left === 0 ? 'сегодня' : `через ${left} ${plural(left, 'день', 'дня', 'дней')}`} (${date(d.end_date)}).
      Если технику нужно оставить дольше — продлите сделку, чтобы даты и сумма были в документах.</div>` : ''}
    ${open ? `<div class="banner ${mine ? 'info' : 'warn'}" style="display:block">
        <b>${mine ? 'Вы предложили' : `${who(open) === 'заказчик' ? 'Заказчик' : 'Исполнитель'} предлагает`} продлить до ${date(open.new_end)}</b>
        (+${open.new_end && Math.round((new Date(open.new_end) - new Date(open.old_end)) / 864e5)} дн.), доплата <b class="num">${money(open.extra_minor)}</b>
        ${open.comment ? `<div class="small" style="margin-top:4px">${esc(open.comment)}</div>` : ''}
        <div class="actions" style="margin-top:8px">${act ? (mine ? `<button class="btn ghost sm" id="extCancel">Отозвать запрос</button>`
          : `<button class="btn sm" id="extOk">Принять продление</button><button class="btn ghost sm" id="extNo">Отклонить</button>`) : ''}</div></div>` : ''}
    ${active && !open && act ? `<p class="small muted" style="margin-top:0">Сейчас до ${date(d.end_date)}. Любая сторона может предложить новую дату окончания и доплату — вторая сторона подтверждает.
      Календарь техники и сумма сделки обновятся автоматически.</p>
      <button class="btn ${left <= 2 ? '' : 'ghost'} sm" id="extNew">Предложить продление</button>` : ''}
    ${rows.filter((x) => x.status !== 'REQUESTED').length ? `<table class="table" style="margin-top:12px"><tbody>${rows.filter((x) => x.status !== 'REQUESTED').map((x) => `<tr>
      <td>до ${date(x.new_end)}</td><td class="num">${money(x.extra_minor)}</td><td class="small muted">${who(x)} · ${dateTime(x.created_at)}</td>
      <td><span class="st ${EXT_ST[x.status][0]}">${EXT_ST[x.status][1]}</span>${x.decline_reason ? `<div class="small muted">${esc(x.decline_reason)}</div>` : ''}</td></tr>`).join('')}</tbody></table>` : ''}
  </div>`;

  const done = async (msg) => { toast(msg); await refreshCounters(); refreshShell(); route(); };
  box.querySelector('#extNew')?.addEventListener('click', () => extensionDialog(d, done));
  box.querySelector('#extOk')?.addEventListener('click', (ev) => busy(ev.currentTarget, async () => {
    try { await rpc('decide_extension', { p_ext: open.id, p_accept: true, p_reason: null }); await done('Аренда продлена до ' + date(open.new_end)); }
    catch (e) { toast(e.message, true); }
  }));
  box.querySelector('#extNo')?.addEventListener('click', async () => {
    const r = await askReason('Отклонить продление', 'Можно коротко объяснить причину — её увидит вторая сторона.', 'Причина', 'Отклонить');
    if (!r) return;
    try { await rpc('decide_extension', { p_ext: open.id, p_accept: false, p_reason: r }); await done('Продление отклонено'); }
    catch (e) { toast(e.message, true); }
  });
  box.querySelector('#extCancel')?.addEventListener('click', (ev) => busy(ev.currentTarget, async () => {
    try { await rpc('cancel_extension', { p_ext: open.id }); await done('Запрос отозван'); } catch (e) { toast(e.message, true); }
  }));
}

function extensionDialog(d, done) {
  const minEnd = new Date(new Date(d.end_date + 'T00:00:00').getTime() + 864e5).toLocaleDateString('sv-SE');
  const m = modal(`<h2>Продлить аренду</h2>
    <p class="small muted">Сейчас: ${date(d.start_date)} — ${date(d.end_date)}. Вторая сторона получит уведомление и подтвердит продление.</p>
    <form id="xf">
      <label class="f"><span>Новая дата окончания <i>*</i></span><input class="inp" type="date" name="ne" required min="${minEnd}" value="${minEnd}"></label>
      <label class="f"><span>Доплата за продление, ₽ <i>*</i></span><input class="inp" type="number" name="extra" min="0" step="1" max="1000000000" required>
        <div class="hint" id="xh">Считаем по тарифу…</div></label>
      <label class="f"><span>Комментарий</span><textarea class="inp" name="c" maxlength="1000" placeholder="Например: работы на объекте продлились, нужна ещё неделя"></textarea></label>
      <div class="form-error hidden" id="xe"></div>
      <div class="actions"><button class="btn">Отправить запрос</button><button type="button" class="btn ghost" data-close>Отмена</button></div>
    </form>`);
  const f = m.el.querySelector('#xf');
  const hint = m.el.querySelector('#xh');
  m.el.querySelector('[data-close]').onclick = () => m.close();
  const quote = async () => {
    if (!f.ne.value) return;
    try {
      const r = await rpc('extension_quote', { p_deal: d.id, p_new_end: f.ne.value });
      if (!r.ok) { hint.textContent = r.error; hint.style.color = 'var(--red)'; return; }
      hint.style.color = '';
      hint.textContent = `+${r.days} ${plural(r.days, 'день', 'дня', 'дней')}. Подсказка по тарифу: ${money(r.extra)} — можно изменить.`;
      if (!f.extra.value || f.extra.dataset.auto === '1') { f.extra.value = fromMinor(r.extra); f.extra.dataset.auto = '1'; }
    } catch (e) { hint.textContent = e.message; }
  };
  f.extra.addEventListener('input', () => { f.extra.dataset.auto = '0'; });
  f.ne.addEventListener('change', quote);
  quote();
  f.onsubmit = (ev) => {
    ev.preventDefault();
    busy(f.querySelector('button'), async () => {
      try {
        await rpc('request_extension', { p_deal: d.id, p_org: state.org.id, p_new_end: f.ne.value, p_extra: toMinor(f.extra.value || 0), p_comment: f.c.value });
        m.close();
        await done('Запрос на продление отправлен');
      } catch (e) { const el = m.el.querySelector('#xe'); el.textContent = e.message; el.classList.remove('hidden'); }
    });
  };
}

// ---------- Заметки и напоминания (видны только своей организации) ----------
export async function renderNotes(box, d) {
  let rows;
  try { rows = await q(sb.from('deal_notes').select('*').eq('deal_id', d.id).eq('org_id', state.org.id).order('created_at', { ascending: false })); }
  catch { box.innerHTML = ''; return; }
  const today = mskDate(0);
  box.innerHTML = `<div class="panel"><h2>Мои заметки</h2>
    <p class="small muted" style="margin-top:-6px">Видны только вашей организации. Укажите дату — напоминание появится на «Рабочем столе».</p>
    <form id="nf" data-nodraft>
      <textarea class="inp" name="b" rows="2" maxlength="2000" placeholder="Например: позвонить прорабу, уточнить подачу на 8:00" required></textarea>
      <div class="actions" style="margin-top:6px"><input class="inp" type="date" name="r" title="Напомнить" style="width:150px" min="${today}">
        <button class="btn dark sm">Добавить</button></div></form>
    ${rows.length ? `<ul class="notes">${rows.map((n) => `<li class="${n.done ? 'done' : ''} ${!n.done && n.remind_on && n.remind_on <= today ? 'due' : ''}">
      <label class="check" style="margin:0"><input type="checkbox" data-done="${n.id}" ${n.done ? 'checked' : ''}> <span style="white-space:pre-wrap">${esc(n.body)}</span></label>
      <div class="small muted">${n.remind_on ? `напомнить ${date(n.remind_on)} · ` : ''}${dateTime(n.created_at)}</div></li>`).join('')}</ul>` : ''}
  </div>`;
  const f = box.querySelector('#nf');
  f.onsubmit = (ev) => {
    ev.preventDefault();
    busy(f.querySelector('button'), async () => {
      const { error } = await sb.from('deal_notes').insert({ deal_id: d.id, org_id: state.org.id, body: f.b.value.trim(), remind_on: f.r.value || null });
      if (error) return toast(error.message, true);
      toast('Заметка сохранена'); await refreshCounters(); refreshShell(); renderNotes(box, d);
    });
  };
  box.querySelectorAll('[data-done]').forEach((c) => c.onchange = async () => {
    const { error } = await sb.from('deal_notes').update({ done: c.checked }).eq('id', c.dataset.done);
    if (error) return toast(error.message, true);
    await refreshCounters(); refreshShell(); renderNotes(box, d);
  });
}
