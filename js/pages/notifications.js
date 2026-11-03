// Центр уведомлений (SCR-COM-03)
import { sb, state, q, refreshCounters } from '../api.js';
import { esc, dateTime, emptyState, errorState, toast } from '../ui.js';
import { refreshShell } from '../app.js';

export async function render(app) {
  let rows;
  try { rows = await q(sb.from('notifications').select('*').eq('org_id', state.org.id).order('id', { ascending: false }).limit(100)); }
  catch (err) { app.innerHTML = errorState(err); return; }
  app.innerHTML = `<div class="page-head"><div><h1>Уведомления</h1><p>${esc(state.org.type === 'PERSON' ? 'Личный профиль' : state.org.name)}</p></div>
    ${rows.some((r) => !r.is_read) ? '<button class="btn ghost" id="allRead">Отметить все прочитанными</button>' : ''}</div>
    ${rows.length ? `<div class="panel">${rows.map((n) => `<a class="row-item" href="${esc(n.link || '#/')}" data-id="${n.id}">
      <div class="grow">${n.is_read ? '' : '<span class="st warn" style="margin-right:6px">Новое</span>'}<b style="display:inline">${esc(n.title)}</b>
      <div class="small muted">${dateTime(n.created_at)}</div></div><span class="muted">→</span></a>`).join('')}</div>`
    : emptyState('Уведомлений нет', 'Здесь появятся новые предложения, брони, решения модерации и сообщения.')}`;
  app.querySelectorAll('[data-id]').forEach((a) => a.addEventListener('click', () => {
    sb.from('notifications').update({ is_read: true }).eq('id', a.dataset.id).then(() => refreshCounters().then(refreshShell));
  }));
  app.querySelector('#allRead')?.addEventListener('click', async () => {
    const { error } = await sb.from('notifications').update({ is_read: true }).eq('org_id', state.org.id).eq('is_read', false);
    if (error) return toast('Не удалось обновить', true);
    await refreshCounters(); refreshShell(); render(app);
  });
}
