// Сотрудники организации: список, приглашения, роли (SCR-IDN-08)
import { state, rpc, isOwnerAdmin, loadMe } from '../api.js';
import { esc, toast, busy, confirmBox, emptyState, errorState, date } from '../ui.js';
import { route, refreshShell, go } from '../app.js';

const ROLES = { OWNER: 'Владелец', ADMIN: 'Администратор', MANAGER: 'Менеджер', APPROVER: 'Согласующий', FINANCE: 'Бухгалтер', VIEWER: 'Наблюдатель' };
const ROLE_HINT = {
  ADMIN: 'всё, кроме передачи владения', MANAGER: 'техника, заказы, предложения, сделки, чат',
  APPROVER: 'просмотр заказов и сделок', FINANCE: 'просмотр сделок и документов', VIEWER: 'только просмотр'
};

export async function render(app) {
  const o = state.org;
  if (o.type === 'PERSON') {
    app.innerHTML = emptyState('В личном профиле нет сотрудников', 'Чтобы работать командой, создайте организацию и переключитесь на неё в меню слева.', '<a class="btn" href="#/account">Создать организацию</a>');
    return;
  }
  const admin = isOwnerAdmin();
  let team, inv;
  try { [team, inv] = await Promise.all([rpc('org_team', { p_org: o.id }), admin ? rpc('org_invitations', { p_org: o.id }) : []]); }
  catch (err) { app.innerHTML = errorState(err); return; }
  const active = team.filter((m) => m.status === 'ACTIVE');
  app.innerHTML = `
    <div class="page-head"><div><h1>Сотрудники</h1><p>${esc(o.name)} · у каждого свой вход и своя роль</p></div></div>
    <div class="cols">
      <div class="panel"><h2>Команда (${active.length})</h2>
        <table class="table resp"><thead><tr><th>Сотрудник</th><th>Роль</th><th>С нами с</th><th></th></tr></thead><tbody>
        ${active.map((m) => `<tr><td><b>${esc(m.name || '—')}</b><div class="small muted">${esc(m.email)}</div></td>
          <td>${admin && m.user_id !== state.user.id ? `<select class="inp" data-role="${m.user_id}" style="height:36px;width:auto">${Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${k === m.role ? 'selected' : ''}>${v}</option>`).join('')}</select>` : ROLES[m.role]}</td>
          <td class="small">${date(m.joined_at)}</td>
          <td>${m.user_id === state.user.id ? '<button class="btn ghost sm" data-leave>Выйти из организации</button>' : admin ? `<button class="btn danger sm" data-rm="${m.user_id}">Отключить</button>` : ''}</td></tr>`).join('')}
        </tbody></table>
      </div>
      <aside class="sticky">${admin ? `<div class="panel"><h2>Пригласить</h2>
        <form id="inv"><label class="f"><span>Email сотрудника</span><input class="inp" type="email" name="e" required></label>
          <label class="f"><span>Роль</span><select class="inp" name="r">${Object.entries(ROLES).filter(([k]) => k !== 'OWNER').map(([k, v]) => `<option value="${k}" ${k === 'MANAGER' ? 'selected' : ''}>${v} — ${ROLE_HINT[k]}</option>`).join('')}</select></label>
          <button class="btn wide">Пригласить</button></form>
        <p class="small muted">Письмо пока не отправляется автоматически. Сообщите сотруднику: пусть зарегистрируется на сайте с этим email — приглашение появится у него в «Профиле».</p>
        ${inv.length ? `<div class="divider"></div><h3>Ждут ответа</h3>${inv.map((i) => `<div class="row-item"><div class="grow"><b>${esc(i.email)}</b><div class="small muted">${ROLES[i.role]} · до ${date(i.expires_at)}</div></div><button class="btn ghost sm" data-rev="${i.id}">Отозвать</button></div>`).join('')}` : ''}
      </div>` : '<div class="panel"><p class="muted">Приглашать сотрудников могут владелец и администратор.</p></div>'}</aside>
    </div>`;

  app.querySelector('#inv')?.addEventListener('submit', (e) => { e.preventDefault(); busy(e.target.querySelector('button'), async () => {
    try { await rpc('invite_member', { p_org: o.id, p_email: e.target.e.value, p_role: e.target.r.value }); toast('Приглашение создано'); route(); } catch (err) { toast(err.message, true); }
  }); });
  app.querySelectorAll('[data-rev]').forEach((b) => b.onclick = async () => { try { await rpc('revoke_invitation', { p_id: b.dataset.rev }); route(); } catch (e) { toast(e.message, true); } });
  app.querySelectorAll('[data-role]').forEach((s) => s.onchange = async () => {
    try { await rpc('set_member_role', { p_org: o.id, p_user: s.dataset.role, p_role: s.value }); toast('Роль изменена'); } catch (e) { toast(e.message, true); route(); }
  });
  app.querySelectorAll('[data-rm]').forEach((b) => b.onclick = async () => {
    if (!await confirmBox('Отключить сотрудника?', 'Он потеряет доступ к организации. История его действий сохранится.', 'Отключить', true)) return;
    try { await rpc('remove_member', { p_org: o.id, p_user: b.dataset.rm }); toast('Сотрудник отключён'); route(); } catch (e) { toast(e.message, true); }
  });
  app.querySelector('[data-leave]')?.addEventListener('click', async () => {
    if (!await confirmBox('Выйти из организации?', 'Вы потеряете доступ к её технике, заказам и сделкам.', 'Выйти', true)) return;
    try { await rpc('remove_member', { p_org: o.id, p_user: state.user.id }); await loadMe(); refreshShell(); go('#/account'); } catch (e) { toast(e.message, true); }
  });
}
