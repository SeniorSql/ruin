// Работа командой: ответственные за сделки и заказы, имена сотрудников
import { sb, state, rpc, canManage } from './api.js';
import { esc, toast } from './ui.js';

export const ROLE_NAME = { OWNER: 'Владелец', ADMIN: 'Администратор', MANAGER: 'Менеджер', APPROVER: 'Согласующий', FINANCE: 'Бухгалтер', VIEWER: 'Наблюдатель' };
const ACTIVE_ROLES = ['OWNER', 'ADMIN', 'MANAGER'];

// Сотрудники текущей организации (кэш на время работы страницы)
const teamCache = new Map();
export async function loadTeam(orgId = state.org?.id, fresh = false) {
  if (!orgId) return [];
  if (!fresh && teamCache.has(orgId)) return teamCache.get(orgId);
  let rows = [];
  try { rows = (await rpc('org_team', { p_org: orgId })).filter((m) => m.status === 'ACTIVE'); } catch {}
  rows.forEach((m) => { m.label = m.name || (m.email || '').split('@')[0] || 'Сотрудник'; });
  teamCache.set(orgId, rows);
  return rows;
}
export const dropTeamCache = () => teamCache.clear();

// В организации больше одного человека — показываем ответственных и имена
export async function isTeam() {
  if (!state.org || state.org.type === 'PERSON') return false;
  return (await loadTeam()).length > 1;
}

// Имена людей по id (коллеги и участники моих сделок/переписок)
const nameCache = new Map();
export async function names(ids) {
  const need = [...new Set(ids.filter((x) => x && !nameCache.has(x)))];
  if (need.length) {
    try { (await rpc('people_names', { p_ids: need })).forEach((r) => nameCache.set(r.user_id, r.name)); } catch {}
    need.forEach((x) => { if (!nameCache.has(x)) nameCache.set(x, null); });
  }
  return (id) => nameCache.get(id) || null;
}
export const shortName = (n) => {
  if (!n) return '';
  const p = n.trim().split(/\s+/);
  return p.length > 1 ? `${p[0]} ${p[1][0]}.` : p[0];
};

// Ответственные: { object_id: user_id }
export async function assignees(type, ids, orgId = state.org?.id) {
  if (!ids.length || !orgId) return {};
  const { data, error } = await sb.from('assignments').select('object_id,user_id').eq('org_id', orgId).eq('object_type', type).in('object_id', ids.slice(0, 300));
  if (error) return {};
  return Object.fromEntries(data.map((a) => [a.object_id, a.user_id]));
}

export function memberLabel(team, uid) {
  if (!uid) return null;
  if (uid === state.user?.id) return 'Вы';
  return shortName(team.find((m) => m.user_id === uid)?.label) || 'бывший сотрудник';
}

// Фильтр списка: Все / Мои / Без ответственного
export function assignFilterHtml(cur, base, counts) {
  const t = (k, label) => `<a href="${base}${base.includes('?') ? '&' : '?'}who=${k}" class="${cur === k ? 'on' : ''}">${label}${counts[k] ? ` <span class="tab-cnt">${counts[k]}</span>` : ''}</a>`;
  return `<div class="tabs small-tabs">${t('all', 'Все')}${t('mine', 'Мои')}${t('none', 'Без ответственного')}</div>`;
}

// Блок «Ответственный» на странице сделки или заказа
export async function mountAssign(box, type, objId, onChange) {
  if (!box) return;
  const team = await loadTeam();
  if (team.length < 2) { box.innerHTML = ''; return; }
  const map = await assignees(type, [objId]);
  const cur = map[objId] || null;
  const managers = team.filter((m) => ACTIVE_ROLES.includes(m.role));
  const act = canManage();
  const curName = cur ? (cur === state.user.id ? 'Вы' : team.find((m) => m.user_id === cur)?.label || 'бывший сотрудник') : null;
  box.innerHTML = `<div class="assign ${cur ? '' : 'empty'}">
    <div><small>ОТВЕТСТВЕННЫЙ В ВАШЕЙ КОМАНДЕ</small><b>${cur ? esc(curName) : 'Не назначен'}</b>
      ${cur ? '' : '<span class="small muted">Уведомления по этой сделке видят все сотрудники</span>'}</div>
    ${act ? `<div class="assign-actions">
      ${cur !== state.user.id ? '<button class="btn sm" data-take>Взять в работу</button>' : ''}
      <select class="inp" data-pass aria-label="Передать коллеге"><option value="">Передать коллеге…</option>
        ${managers.filter((m) => m.user_id !== cur).map((m) => `<option value="${m.user_id}">${esc(m.label)}${m.user_id === state.user.id ? ' (вы)' : ''} — ${ROLE_NAME[m.role]}</option>`).join('')}
        ${cur ? '<option value="-">Снять ответственного</option>' : ''}</select></div>` : ''}
  </div>`;
  const set = async (uid, msg) => {
    try { await rpc('assign_to', { p_org: state.org.id, p_type: type, p_id: objId, p_user: uid }); toast(msg); onChange ? onChange() : mountAssign(box, type, objId); }
    catch (e) { toast(e.message, true); }
  };
  box.querySelector('[data-take]')?.addEventListener('click', () => set(state.user.id, 'Теперь вы ответственный'));
  box.querySelector('[data-pass]')?.addEventListener('change', (e) => {
    const v = e.target.value;
    if (!v) return;
    if (v === '-') return set(null, 'Ответственный снят');
    set(v, 'Передано: ' + (team.find((m) => m.user_id === v)?.label || 'коллеге'));
  });
}
