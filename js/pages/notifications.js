// Центр уведомлений (SCR-COM-03): у каждого сотрудника своя отметка «прочитано»
import { sb, state, q, rpc, refreshCounters } from '../api.js';
import { esc, dateTime, emptyState, errorState, toast } from '../ui.js';
import { refreshShell } from '../app.js';

export async function render(app) {
  let rows, personal = true;
  try { rows = await rpc('my_notifications', { p_org: state.org.id }); }
  catch {
    // Запасной вариант, пока не выполнен 10_team.sql
    personal = false;
    try { rows = await q(sb.from('notifications').select('*').eq('org_id', state.org.id).order('id', { ascending: false }).limit(100)); }
    catch (err) { app.innerHTML = errorState(err); return; }
  }
  app.innerHTML = `<div class="page-head"><div><h1>Уведомления</h1><p>${esc(state.org.type === 'PERSON' ? 'Личный профиль' : state.org.name)}${personal && state.org.type !== 'PERSON' ? ' · отметки «прочитано» у каждого сотрудника свои' : ''}</p></div>
    ${rows.some((r) => !r.is_read) ? '<button class="btn ghost" id="allRead">Отметить все прочитанными</button>' : ''}</div>
    ${rows.length ? `<div class="panel">${rows.map((n) => `<a class="row-item" href="${esc(n.link || '#/')}" data-id="${n.id}">
      <div class="grow">${n.is_read ? '' : '<span class="st warn" style="margin-right:6px">Новое</span>'}${n.for_me ? '<span class="st ok" style="margin-right:6px">Вам</span>' : ''}<b style="display:inline">${esc(n.title)}</b>
      <div class="small muted">${dateTime(n.created_at)}${n.for_other ? ` · ответственный: ${esc(n.for_other)}` : ''}</div></div><span class="muted">→</span></a>`).join('')}</div>`
    : emptyState('Уведомлений нет', 'Здесь появятся новые предложения, брони, решения модерации и сообщения.')}`;
  const mark = (ids) => personal ? rpc('read_notifications', { p_org: state.org.id, p_ids: ids })
    : sb.from('notifications').update({ is_read: true }).eq('org_id', state.org.id).in('id', ids || rows.map((r) => r.id)).then(({ error }) => { if (error) throw error; });
  app.querySelectorAll('[data-id]').forEach((a) => a.addEventListener('click', () => {
    mark([Number(a.dataset.id)]).then(() => refreshCounters().then(refreshShell)).catch(() => {});
  }));
  app.querySelector('#allRead')?.addEventListener('click', async () => {
    try { await mark(null); } catch { return toast('Не удалось обновить', true); }
    await refreshCounters(); refreshShell(); render(app);
  });
}
