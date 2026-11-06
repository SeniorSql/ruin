// Сотрудники организации: список, приглашения, роли (SCR-IDN-08)
import { sb, state, rpc, isOwnerAdmin, loadMe } from '../api.js';
import { dropTeamCache } from '../assign.js';
import { esc, toast, busy, confirmBox, emptyState, errorState, date } from '../ui.js';
import { route, refreshShell, go } from '../app.js';
import { withActionCode } from '../actionCode.js';

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
  dropTeamCache();
  const iOwn = o.role === 'OWNER';
  // Нагрузка: сколько живых сделок и заказов ведёт каждый сотрудник
  const load = {};
  try {
    const { data } = await sb.from('assignments').select('user_id,object_type,object_id').eq('org_id', o.id);
    const dealIds = (data || []).filter((a) => a.object_type === 'DEAL').map((a) => a.object_id);
    const liveDeals = dealIds.length ? new Set((await sb.from('deals').select('id').in('id', dealIds.slice(0, 300)).in('status', ['AWAITING_CONFIRMATION', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETION_PENDING'])).data?.map((d) => d.id) || []) : new Set();
    for (const a of data || []) if (a.object_type === 'DEAL' && liveDeals.has(a.object_id)) load[a.user_id] = (load[a.user_id] || 0) + 1;
  } catch {}
  app.innerHTML = `
    <div class="page-head"><div><h1>Сотрудники</h1><p>${esc(o.name)} · у каждого свой вход и своя роль</p></div></div>
    <div class="cols">
      <div class="panel"><h2>Команда (${active.length})</h2>
        <div class="table-wrap"><table class="table resp team-t"><thead><tr><th>Сотрудник</th><th>Роль</th><th title="Сколько текущих сделок ведёт">Сделок</th></tr></thead><tbody>
        ${active.map((m) => `<tr><td><b>${esc(m.name || '—')}</b><div class="small muted">${esc(m.email)} · в команде с ${date(m.joined_at)}</div>
            <div class="row-actions">${m.user_id === state.user.id ? '<button class="btn ghost sm" data-leave>Выйти из организации</button>'
            : `${iOwn ? `<button class="btn ghost sm" data-own="${m.user_id}" data-name="${esc(m.name || m.email)}">Сделать владельцем</button>` : ''}${admin && m.role !== 'OWNER' || iOwn ? `<button class="btn danger sm" data-rm="${m.user_id}">Отключить</button>` : ''}`}</div></td>
          <td>${admin && m.user_id !== state.user.id ? `<select class="inp" data-role="${m.user_id}" style="height:36px;width:auto;max-width:100%">${Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${k === m.role ? 'selected' : ''}>${v}</option>`).join('')}</select>` : ROLES[m.role]}</td>
          <td>${['OWNER', 'ADMIN', 'MANAGER'].includes(m.role) ? `<a href="#/crm?who=${m.user_id}"><b>${load[m.user_id] || 0}</b></a>` : '<span class="muted small">—</span>'}</td></tr>`).join('')}
        </tbody></table></div>
        <div class="small muted" style="margin-top:10px">Роли: <b>владелец, администратор, менеджер</b> — работают со сделками, заказами и чатом;
          <b>согласующий, бухгалтер, наблюдатель</b> — только просмотр. Ответственным за сделку можно назначить только тех, кто работает со сделками.
          Если сотрудника отключить или перевести в «только просмотр», его сделки станут «без ответственного» — их увидят коллеги.</div>
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
  app.querySelectorAll('[data-own]').forEach((b) => b.onclick = async () => {
    if (!await confirmBox('Передать права владельца?', `Владельцем станет ${esc(b.dataset.name)}. Вы останетесь в организации с ролью «Администратор». Вернуть права сможет только новый владелец.`, 'Передать', true)) return;
    try { await withActionCode('transfer_ownership', (code) => rpc('transfer_ownership', { p_org: o.id, p_user: b.dataset.own, p_code: code })); await loadMe(); refreshShell(); toast('Права владельца переданы'); route(); } catch (e) { toast(e.message, true); }
  });
  app.querySelector('[data-leave]')?.addEventListener('click', async () => {
    if (!await confirmBox('Выйти из организации?', 'Вы потеряете доступ к её технике, заказам и сделкам.', 'Выйти', true)) return;
    try { await rpc('remove_member', { p_org: o.id, p_user: state.user.id }); await loadMe(); refreshShell(); go('#/account'); } catch (e) { toast(e.message, true); }
  });
}
