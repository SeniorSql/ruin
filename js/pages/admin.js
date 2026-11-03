// Админка: проверка организаций, модерация техники, жалобы (Модуль 12, SCR-ADM)
import { sb, q, rpc, isAdmin } from '../api.js';
import { esc, status, toast, askReason, emptyState, errorState, dateTime, ORG_TYPE, photoOf, priceText, qs } from '../ui.js';
import { route } from '../app.js';

export async function render(app, _p, query) {
  if (!isAdmin()) { app.innerHTML = emptyState('Нет доступа', 'Раздел доступен только администраторам платформы.'); return; }
  const tab = query.tab || 'orgs';
  const tabs = [['orgs', 'Проверка организаций'], ['equipment', 'Модерация техники'], ['reports', 'Жалобы'], ['all', 'Все организации']];
  app.innerHTML = `<div class="page-head"><div><h1>Админка</h1><p>Каждое решение записывается в журнал с автором, временем и причиной.</p></div></div>
    <div class="tabs">${tabs.map(([k, t]) => `<a href="#/admin?tab=${k}" class="${k === tab ? 'on' : ''}">${t}</a>`).join('')}</div><div id="box"></div>`;
  const box = app.querySelector('#box');
  try {
    if (tab === 'orgs') await orgs(box, { status: 'PENDING_REVIEW' });
    if (tab === 'all') await orgs(box, { search: query.s || '' });
    if (tab === 'equipment') await equipment(box);
    if (tab === 'reports') await reports(box);
  } catch (err) { box.innerHTML = errorState(err); }
}

async function orgs(box, { status: st, search }) {
  let b = sb.from('organizations').select('*').neq('type', 'PERSON').eq('is_demo', false).order('updated_at', { ascending: false }).limit(200);
  if (st) b = b.eq('verification_status', st);
  if (search) b = b.or(`name.ilike.%${search.replace(/[%,()]/g, '')}%,inn.ilike.%${search.replace(/[%,()]/g, '')}%`);
  const rows = await q(b);
  const contacts = rows.length ? await q(sb.from('org_contacts').select('*').in('org_id', rows.map((r) => r.id))) : [];
  const c = Object.fromEntries(contacts.map((x) => [x.org_id, x]));
  box.innerHTML = `${search !== undefined ? `<form class="filters" id="sf"><input class="inp" name="s" value="${esc(search)}" placeholder="Название или ИНН"><button class="btn dark">Найти</button></form>` : ''}
    ${rows.length ? `<div class="panel">${rows.map((o) => `<div class="row-item" style="align-items:flex-start"><div class="grow">
      <b>${esc(o.name)}</b> ${status('org', o.verification_status)}
      <div class="small">${ORG_TYPE[o.type]} · ИНН ${esc(o.inn || '—')} · ОГРН ${esc(o.ogrn || '—')} · ${esc(o.city || '')}</div>
      <div class="small muted">${esc(c[o.id]?.contact_person || '')} · ${esc(c[o.id]?.phone || '')} · ${esc(c[o.id]?.email || '')}</div>
      <div class="small muted">Роли: ${[o.can_order && 'заказчик', o.can_provide && 'исполнитель'].filter(Boolean).join(', ')} · обновлено ${dateTime(o.updated_at)}</div>
      <div class="small"><a href="https://egrul.nalog.ru/" target="_blank" rel="noopener">Проверить в ЕГРЮЛ/ЕГРИП →</a></div>
      ${o.verification_comment ? `<div class="small" style="color:#9a3412">Комментарий: ${esc(o.verification_comment)}</div>` : ''}</div>
      <div class="actions" style="justify-content:flex-end">
        <button class="btn sm" data-o="${o.id}" data-d="VERIFIED">Подтвердить</button>
        <button class="btn ghost sm" data-o="${o.id}" data-d="REQUIRES_UPDATE">На доработку</button>
        <button class="btn danger sm" data-o="${o.id}" data-d="REJECTED">Отклонить</button>
        ${o.verification_status === 'VERIFIED' ? `<button class="btn danger sm" data-o="${o.id}" data-d="SUSPENDED">Приостановить</button>` : ''}
      </div></div>`).join('')}</div>` : emptyState('Очередь пуста', st ? 'Новых заявок на проверку нет.' : 'Ничего не найдено.')}`;
  box.querySelector('#sf')?.addEventListener('submit', (e) => { e.preventDefault(); location.hash = '#/admin' + qs({ tab: 'all', s: e.target.s.value }); });
  box.querySelectorAll('[data-o]').forEach((b) => b.onclick = async () => {
    let comment = null;
    if (b.dataset.d !== 'VERIFIED') {
      comment = await askReason('Причина решения', 'Пользователь увидит этот текст. Напишите, что именно исправить.', 'Причина', 'Сохранить решение');
      if (!comment) return;
    }
    try { await rpc('admin_review_org', { p_org: b.dataset.o, p_decision: b.dataset.d, p_comment: comment }); toast('Решение сохранено'); route(); }
    catch (err) { toast(err.message, true); }
  });
}

async function equipment(box) {
  const rows = await q(sb.from('equipment').select('*, organizations(name,verification_status), categories(name)').eq('status', 'PENDING_MODERATION').order('updated_at').limit(200));
  box.innerHTML = rows.length ? `<div class="panel">${rows.map((e) => {
    const p = photoOf(e);
    return `<div class="row-item" style="align-items:flex-start">${p ? `<img src="${esc(p.url)}" alt="" referrerpolicy="no-referrer">` : '<img alt="">'}
      <div class="grow"><b><a href="#/item/${e.id}" target="_blank">${esc(e.title)}</a></b>
      <div class="small">${esc(e.categories?.name)} · ${esc(e.brand)} ${esc(e.model)} ${e.year || ''} · ${esc(e.city)} · <span class="num">${priceText(e)}</span></div>
      <div class="small muted">${esc(e.organizations?.name)} ${status('org', e.organizations?.verification_status)} · фото: ${(e.photos || []).length}</div>
      ${e.description ? `<div class="small" style="margin-top:4px;white-space:pre-wrap">${esc(e.description.slice(0, 400))}</div>` : ''}</div>
      <div class="actions" style="justify-content:flex-end">
        <button class="btn sm" data-e="${e.id}" data-d="PUBLISHED">Опубликовать</button>
        <button class="btn danger sm" data-e="${e.id}" data-d="REJECTED">Отклонить</button></div></div>`;
  }).join('')}</div>` : emptyState('Очередь пуста', 'Нет карточек на модерации.');
  box.querySelectorAll('[data-e]').forEach((b) => b.onclick = async () => {
    let comment = null;
    if (b.dataset.d !== 'PUBLISHED') {
      comment = await askReason('Причина отклонения', 'Исполнитель увидит этот текст в карточке.', 'Причина', 'Отклонить');
      if (!comment) return;
    }
    try { await rpc('admin_moderate_equipment', { p_id: b.dataset.e, p_decision: b.dataset.d, p_comment: comment }); toast('Готово'); route(); }
    catch (err) { toast(err.message, true); }
  });
}

async function reports(box) {
  const rows = await q(sb.from('listing_reports').select('*, equipment(id,title,status,org_id)').eq('status', 'NEW').order('created_at').limit(200));
  box.innerHTML = rows.length ? `<div class="panel">${rows.map((r) => `<div class="row-item" style="align-items:flex-start"><div class="grow">
    <b><a href="#/item/${r.equipment_id}" target="_blank">${esc(r.equipment?.title)}</a></b> ${status('equipment', r.equipment?.status)}
    <div class="small"><b>${esc(r.reason)}</b>${r.comment ? ': ' + esc(r.comment) : ''}</div><div class="small muted">${dateTime(r.created_at)}</div></div>
    <div class="actions" style="justify-content:flex-end">
      <button class="btn danger sm" data-hide="${r.equipment_id}" data-r="${r.id}">Скрыть карточку</button>
      <button class="btn ghost sm" data-close="${r.id}">Нарушения нет</button></div></div>`).join('')}</div>`
    : emptyState('Жалоб нет', 'Новые жалобы на карточки появятся здесь.');
  box.querySelectorAll('[data-close]').forEach((b) => b.onclick = async () => {
    const { error } = await sb.from('listing_reports').update({ status: 'REJECTED' }).eq('id', b.dataset.close);
    if (error) return toast(error.message, true);
    toast('Жалоба закрыта'); route();
  });
  box.querySelectorAll('[data-hide]').forEach((b) => b.onclick = async () => {
    const comment = await askReason('Скрыть карточку', 'Исполнитель увидит причину.', 'Причина', 'Скрыть');
    if (!comment) return;
    try {
      await rpc('admin_moderate_equipment', { p_id: b.dataset.hide, p_decision: 'HIDDEN', p_comment: comment });
      await sb.from('listing_reports').update({ status: 'RESOLVED' }).eq('id', b.dataset.r);
      toast('Карточка скрыта'); route();
    } catch (err) { toast(err.message, true); }
  });
}
