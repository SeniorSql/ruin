// Админка: проверка организаций, модерация техники, жалобы (Модуль 12, SCR-ADM)
import { sb, q, rpc, isAdmin, state, refreshCounters, loadMe } from '../api.js';
import { esc, status, toast, askReason, emptyState, errorState, dateTime, ORG_TYPE, photoOf, priceText, qs, money, mskToday } from '../ui.js';
import { route, refreshShell } from '../app.js';
// Претензии убраны с сайта (11.11.2026, v=73): вкладки нет, счётчик не учитывается

export async function render(app, _p, query) {
  if (!isAdmin()) { app.innerHTML = emptyState('Нет доступа', 'Раздел доступен только администраторам платформы.'); return; }
  await refreshCounters(); refreshShell();
  const n = { ...(state.counters.admin || {}) };
  // Отзывы на проверке (SQL 24) с v=75 считаются в refreshCounters (api.js) вместе с остальными очередями
  n.reviews = n.reviews || 0;
  n.total = (n.orgs || 0) + (n.equipment || 0) + (n.reports || 0) + n.reviews;
  // Если ничего не выбрано — открываем первую очередь, где есть работа
  const firstQueue = ['equipment', 'orgs', 'reviews', 'reports'].find((k) => n[k]);
  const tab = query.tab || firstQueue || 'stats';
  const tabs = [['stats', 'Статистика'], ['orgs', 'Проверка организаций', n.orgs], ['equipment', 'Модерация техники', n.equipment],
    ['reviews', 'Отзывы', n.reviews], ['reports', 'Жалобы', n.reports], ['all', 'Все организации']];
  app.innerHTML = `<div class="page-head"><div><h1>Админка</h1><p>Каждое решение записывается в журнал с автором, временем и причиной.</p></div></div>
    ${n.total ? `<div class="banner warn">Ждут вашего решения: ${[['orgs', 'организаций на проверке'], ['equipment', 'техники на модерации'], ['reviews', 'отзывов на проверке'], ['reports', 'жалоб']]
      .filter(([k]) => n[k]).map(([k, t]) => `<a href="#/admin?tab=${k}"><b>${n[k]}</b> ${t}</a>`).join(' · ')}</div>` : ''}
    <div class="tabs">${tabs.map(([k, t, c]) => `<a href="#/admin?tab=${k}" class="${k === tab ? 'on' : ''} ${c ? 'need' : ''}">${t}${c ? `<span class="tab-cnt">${c}</span>` : ''}</a>`).join('')}</div><div id="box"></div>`;
  const box = app.querySelector('#box');
  try {
    if (tab === 'orgs') await orgs(box, { status: 'PENDING_REVIEW' });
    if (tab === 'all') await orgs(box, { search: query.s || '' });
    if (tab === 'equipment') await equipment(box);
    if (tab === 'reports') await reports(box);
    if (tab === 'stats') await stats(box, query);
    if (tab === 'reviews') await reviews(box);
  } catch (err) { box.innerHTML = errorState(err); }
}

async function stats(box, query) {
  const from = query.from || mskToday(-30), to = query.to || mskToday(0);
  const a = await rpc('platform_analytics', { p_from: from, p_to: to });
  const bypass = await rpc('admin_bypass_attempts').catch(() => []);
  box.innerHTML = `<form class="filters" id="sf"><label class="small muted">с <input class="inp" type="date" name="from" value="${from}"></label>
      <label class="small muted">по <input class="inp" type="date" name="to" value="${to}"></label><button class="btn dark">Показать</button></form>
    <div class="cols"><div class="panel"><h2>Платформа за период</h2><dl class="kv">
      <dt>Оборот (завершённые сделки)</dt><dd class="num">${money(a.gmv)}</dd>
      <dt>Сделок создано / подтверждено</dt><dd>${a.deals_created} / ${a.deals_confirmed}</dd>
      <dt>Завершено / отменено</dt><dd>${a.deals_completed} / ${a.deals_cancelled}</dd>
      <dt>Заказов на бирже / предложений</dt><dd>${a.orders} / ${a.offers}</dd>
      <dt>Новых пользователей</dt><dd>${a.users_new}</dd></dl>
      ${a.by_category.length ? `<h3 style="margin-top:16px">Категории</h3><table class="table resp"><thead><tr><th>Категория</th><th>Реальных карточек</th><th>Сделок за период</th></tr></thead><tbody>
        ${a.by_category.map((x) => `<tr><td>${esc(x.name)}</td><td class="num">${x.listings}</td><td class="num">${x.deals}</td></tr>`).join('')}</tbody></table>` : ''}</div>
    <aside><div class="panel"><h2>Сейчас</h2><dl class="kv">
      <dt>Пользователей</dt><dd>${a.users}</dd><dt>Организаций / проверено</dt><dd>${a.orgs} / ${a.orgs_verified}</dd>
      <dt>Реальной техники</dt><dd>${a.equipment_published}</dd><dt>Демо-карточек</dt><dd>${a.equipment_demo}</dd></dl>
      <div class="divider"></div><h3>Очереди</h3><dl class="kv">
      <dt><a href="#/admin?tab=orgs">Проверка организаций</a></dt><dd>${a.queue_orgs}</dd>
      <dt><a href="#/admin?tab=equipment">Модерация техники</a></dt><dd>${a.queue_equipment}</dd></dl></div>
    <div class="panel"><h2>Попытки передать контакты</h2>
      <p class="small muted" style="margin-top:-6px">За 30 дней, до подтверждения сделки. 3 и больше за неделю — повод проверить организацию.</p>
      ${bypass.length ? `<table class="table"><tbody>${bypass.map((b) => `<tr><td>${esc(b.org_name)}</td><td class="num"><b style="color:${b.attempts >= 3 ? 'var(--red)' : 'inherit'}">${b.attempts}</b></td><td class="small muted">${dateTime(b.last_at)}</td></tr>`).join('')}</tbody></table>`
        : '<p class="muted">Попыток не было.</p>'}</div></aside></div>`;
  box.querySelector('#sf').onsubmit = (e) => { e.preventDefault(); location.hash = '#/admin' + qs({ tab: 'stats', from: e.target.from.value, to: e.target.to.value }); };
}

async function reviews(box) {
  const rows = await q(sb.from('reviews').select('*, deals(number), au:organizations!reviews_author_org_id_fkey(name,type), su:organizations!reviews_subject_org_id_fkey(name,type)')
    .order('created_at', { ascending: false }).limit(200));
  const isPending = (r) => ['PENDING', 'SUBMITTED'].includes(r.status);
  const pending = rows.filter(isPending).reverse(); // старые сверху — проверять по очереди
  const rest = rows.filter((r) => !isPending(r));
  const ST = { PUBLISHED: ['ok', 'Опубликован'], TEXT_HIDDEN: ['warn', 'Без текста'], EXCLUDED: ['err', 'Исключён'], REJECTED: ['err', 'Отклонён'] };
  const who = (o) => esc(o?.type === 'PERSON' ? `${o?.name || ''} (частное лицо)` : o?.name || '');
  const head = (r) => `<span class="rating">${'★'.repeat(r.overall)}<span class="star-off">${'★'.repeat(5 - r.overall)}</span></span>
      <div><strong>${who(r.au)}</strong> → <strong>${who(r.su)}</strong></div><span class="small muted">${r.subject_role === 'PROVIDER' ? 'об исполнителе' : 'о заказчике'}
      · <a href="#/deals/${r.deal_id}">сделка ${esc(r.deals?.number || '')}</a> · ${dateTime(r.created_at)}</span>`;
  const CL = { ON_TIME: 'Сроки', AS_DESCRIBED: 'Соответствие описанию', EQUIPMENT_CONDITION: 'Состояние техники', COMMUNICATION: 'Общение',
    TERMS_COMPLIANCE: 'Договорённости', PAYMENT_DISCIPLINE: 'Оплата', SITE_READINESS: 'Готовность объекта' };
  const crit = (r) => Object.keys(r.criteria || {}).length ? `<div class="small muted">${Object.entries(r.criteria).map(([k, v]) => `${esc(CL[k] || k)}: ${Number(v)}★`).join(' · ')}</div>` : '';
  box.innerHTML = `
    <div class="panel"><h2>На проверке${pending.length ? ` (${pending.length})` : ''}</h2>
      ${pending.length ? pending.map((r) => `<div class="row-item" style="align-items:flex-start"><div class="grow">${head(r)}
          ${r.text ? `<p style="margin:6px 0;white-space:pre-wrap">${esc(r.text)}</p>` : '<p class="small muted" style="margin:6px 0">Без текста — только оценка</p>'}${crit(r)}</div>
        <div class="actions"><button class="btn sm" data-rv="${r.id}" data-s="PUBLISHED">Опубликовать</button>
          ${r.text ? `<button class="btn ghost sm" data-rv="${r.id}" data-s="TEXT_HIDDEN">Без текста</button>` : ''}
          <button class="btn danger sm" data-rv="${r.id}" data-s="REJECTED">Отклонить</button></div></div>`).join('')
        : '<p class="muted">Новых отзывов на проверке нет.</p>'}
      <p class="small muted">Публикуйте и негативные отзывы, если в них нет нарушений. «Без текста» — опубликовать только звёзды (оскорбления, контакты, персональные данные в тексте). «Отклонить» — отзыв не по сделке, накрутка, бессмыслица; автор увидит причину и сможет исправить.</p></div>
    ${rest.length ? `<div class="panel"><h2>Опубликованные и отклонённые</h2>${rest.map((r) => `<div class="row-item" style="align-items:flex-start"><div class="grow">${head(r)}
        <span class="st ${(ST[r.status] || ['', r.status])[0]}">${(ST[r.status] || ['', r.status])[1]}</span>
        ${r.text ? `<p class="small" style="margin:4px 0">${esc(r.text)}</p>` : ''}${r.moderation_comment ? `<div class="small warn-text">Модерация: ${esc(r.moderation_comment)}</div>` : ''}</div>
      <div class="actions">
        ${r.status === 'PUBLISHED' ? `<button class="btn ghost sm" data-rv="${r.id}" data-s="TEXT_HIDDEN">Скрыть текст</button>` : ''}
        ${['PUBLISHED', 'TEXT_HIDDEN'].includes(r.status) ? `<button class="btn danger sm" data-rv="${r.id}" data-s="EXCLUDED">Исключить</button>` : ''}
        ${['TEXT_HIDDEN', 'EXCLUDED'].includes(r.status) ? `<button class="btn ghost sm" data-rv="${r.id}" data-s="PUBLISHED">Вернуть</button>` : ''}
        <button class="btn danger sm" data-rvdel="${r.id}">Удалить</button></div></div>`).join('')}</div>` : ''}`;
  const ASK = {
    TEXT_HIDDEN: ['Опубликовать без текста', 'Отзыв будет виден только звёздами. Укажите, что не так с текстом — автор увидит причину.', 'Причина', 'Опубликовать без текста'],
    EXCLUDED: ['Исключить отзыв', 'Отзыв перестанет учитываться в рейтинге. Какое правило нарушено — это записывается в журнал.', 'Нарушение', 'Исключить'],
    REJECTED: ['Отклонить отзыв', 'Отзыв не будет опубликован. Автор увидит причину и сможет исправить отзыв.', 'Причина отклонения', 'Отклонить']
  };
  box.querySelectorAll('[data-rv]').forEach((b) => b.onclick = async () => {
    let c = null;
    if (ASK[b.dataset.s]) { c = await askReason(...ASK[b.dataset.s]); if (!c) return; }
    try {
      await rpc('admin_moderate_review', { p_review: b.dataset.rv, p_status: b.dataset.s, p_comment: c });
      toast({ PUBLISHED: 'Отзыв опубликован', TEXT_HIDDEN: 'Опубликован без текста', EXCLUDED: 'Отзыв исключён', REJECTED: 'Отзыв отклонён' }[b.dataset.s] || 'Готово'); route();
    } catch (e) { toast(e.message, true); }
  });
  // Полное удаление отзыва (например, тестового). Копия и причина остаются в журнале.
  box.querySelectorAll('[data-rvdel]').forEach((b) => b.onclick = async () => {
    const reason = await askReason('Удалить отзыв навсегда?', 'Отзыв исчезнет у всех, рейтинг пересчитается. Вернуть нельзя. Копия и причина сохранятся в журнале.', 'Причина удаления', 'Удалить');
    if (!reason) return;
    try { await rpc('admin_delete_review', { p_review: b.dataset.rvdel, p_reason: reason }); toast('Отзыв удалён'); route(); } catch (e) { toast(e.message, true); }
  });
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
      <b>${esc(o.name)}</b> ${o.closed_at ? `<span class="st err">Закрыта ${dateTime(o.closed_at)}</span>` : status('org', o.verification_status)}
      <div class="small">${ORG_TYPE[o.type]} · ИНН ${esc(o.inn || '—')} · ОГРН ${esc(o.ogrn || '—')} · ${esc(o.city || '')}</div>
      <div class="small muted">${esc(c[o.id]?.contact_person || '')} · ${esc(c[o.id]?.phone || '')} · ${esc(c[o.id]?.email || '')}</div>
      <div class="small muted">Роли: ${[o.can_order && 'заказчик', o.can_provide && 'исполнитель'].filter(Boolean).join(', ')} · обновлено ${dateTime(o.updated_at)}</div>
      <div class="small"><a href="https://egrul.nalog.ru/" target="_blank" rel="noopener">Проверить в ЕГРЮЛ/ЕГРИП →</a></div>
      ${o.verification_comment ? `<div class="small warn-text">Комментарий: ${esc(o.verification_comment)}</div>` : ''}</div>
      <div class="actions" style="justify-content:flex-end">
        ${o.closed_at ? '' : o.verification_status === 'VERIFIED'
          ? `<span class="small muted">Уже проверена</span><button class="btn danger sm" data-o="${o.id}" data-d="SUSPENDED">Приостановить</button>`
          : `<button class="btn sm" data-o="${o.id}" data-d="VERIFIED">Подтвердить</button>
             <button class="btn ghost sm" data-o="${o.id}" data-d="REQUIRES_UPDATE">На доработку</button>
             <button class="btn danger sm" data-o="${o.id}" data-d="REJECTED">Отклонить</button>`}
        ${o.closed_at ? '' : `<button class="btn ghost sm" data-delorg="${o.id}">Удалить организацию</button>`}
      </div></div>`).join('')}</div>` : emptyState(st ? 'Очередь пуста' : 'Ничего не найдено', st
        ? 'Новых заявок нет. Организация попадает сюда, когда её владелец нажимает «Отправить на проверку» в разделе «Профиль и организации».'
        : 'Попробуйте другое название или ИНН.')}`;
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
  box.querySelectorAll('[data-delorg]').forEach((b) => b.onclick = async () => {
    const { deleteOrgFlow } = await import('./account.js');
    if (await deleteOrgFlow(b.dataset.delorg)) { await loadMe(); refreshShell(); route(); }
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
