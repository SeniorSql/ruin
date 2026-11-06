// Админка: проверка организаций, модерация техники, жалобы (Модуль 12, SCR-ADM)
import { sb, q, rpc, isAdmin, state, refreshCounters, loadMe } from '../api.js';
import { esc, status, toast, askReason, emptyState, errorState, dateTime, ORG_TYPE, photoOf, priceText, qs, money, mskToday } from '../ui.js';
import { route, refreshShell } from '../app.js';

export async function render(app, _p, query) {
  if (!isAdmin()) { app.innerHTML = emptyState('Нет доступа', 'Раздел доступен только администраторам платформы.'); return; }
  await refreshCounters(); refreshShell();
  const n = state.counters.admin || {};
  // Если ничего не выбрано — открываем первую очередь, где есть работа
  const firstQueue = ['equipment', 'orgs', 'disputes', 'reports'].find((k) => n[k]);
  const tab = query.tab || firstQueue || 'stats';
  const tabs = [['stats', 'Статистика'], ['orgs', 'Проверка организаций', n.orgs], ['equipment', 'Модерация техники', n.equipment], ['disputes', 'Претензии', n.disputes],
    ['reviews', 'Отзывы'], ['reports', 'Жалобы', n.reports], ['all', 'Все организации']];
  app.innerHTML = `<div class="page-head"><div><h1>Админка</h1><p>Каждое решение записывается в журнал с автором, временем и причиной.</p></div></div>
    ${n.total ? `<div class="banner warn">Ждут вашего решения: ${[['orgs', 'организаций на проверке'], ['equipment', 'техники на модерации'], ['disputes', 'претензий'], ['reports', 'жалоб']]
      .filter(([k]) => n[k]).map(([k, t]) => `<a href="#/admin?tab=${k}"><b>${n[k]}</b> ${t}</a>`).join(' · ')}</div>` : ''}
    <div class="tabs">${tabs.map(([k, t, c]) => `<a href="#/admin?tab=${k}" class="${k === tab ? 'on' : ''} ${c ? 'need' : ''}">${t}${c ? `<span class="tab-cnt">${c}</span>` : ''}</a>`).join('')}</div><div id="box"></div>`;
  const box = app.querySelector('#box');
  try {
    if (tab === 'orgs') await orgs(box, { status: 'PENDING_REVIEW' });
    if (tab === 'all') await orgs(box, { search: query.s || '' });
    if (tab === 'equipment') await equipment(box);
    if (tab === 'reports') await reports(box);
    if (tab === 'stats') await stats(box, query);
    if (tab === 'disputes') await disputes(box);
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
      <dt><a href="#/admin?tab=equipment">Модерация техники</a></dt><dd>${a.queue_equipment}</dd>
      <dt><a href="#/admin?tab=disputes">Открытые претензии</a></dt><dd>${a.disputes_open}</dd></dl></div>
    <div class="panel"><h2>Попытки передать контакты</h2>
      <p class="small muted" style="margin-top:-6px">За 30 дней, до подтверждения сделки. 3 и больше за неделю — повод проверить организацию.</p>
      ${bypass.length ? `<table class="table"><tbody>${bypass.map((b) => `<tr><td>${esc(b.org_name)}</td><td class="num"><b style="color:${b.attempts >= 3 ? 'var(--red)' : 'inherit'}">${b.attempts}</b></td><td class="small muted">${dateTime(b.last_at)}</td></tr>`).join('')}</tbody></table>`
        : '<p class="muted">Попыток не было.</p>'}</div></aside></div>`;
  box.querySelector('#sf').onsubmit = (e) => { e.preventDefault(); location.hash = '#/admin' + qs({ tab: 'stats', from: e.target.from.value, to: e.target.to.value }); };
}

async function disputes(box) {
  const rows = await q(sb.from('disputes').select('*, deals(id,number,total_minor), op:organizations!disputes_opened_by_org_fkey(name), rs:organizations!disputes_respondent_org_fkey(name)')
    .in('status', ['OPEN', 'IN_REVIEW']).order('created_at').limit(200));
  box.innerHTML = rows.length ? `<div class="panel">${rows.map((x) => `<div class="row-item" style="align-items:flex-start"><div class="grow">
      <b>${esc(x.reason)}</b> · <a href="#/deals/${x.deal_id}">сделка ${esc(x.deals?.number)}</a> (${money(x.deals?.total_minor)})
      <div class="small">Заявитель: <b>${esc(x.op?.name)}</b> → ответчик: <b>${esc(x.rs?.name)}</b> · ${dateTime(x.created_at)}</div>
      <p class="small" style="white-space:pre-wrap;margin:6px 0">${esc(x.description)}</p>
      ${x.amount_minor ? `<div class="small">Сумма требования: ${money(x.amount_minor)}${x.desired_outcome ? ' · ' + esc(x.desired_outcome) : ''}</div>` : ''}
      <div class="small" style="margin-top:4px"><b>Ответ:</b> ${x.response_text ? esc(x.response_text) : '<span class="muted">ещё нет</span>'}</div></div>
      <div class="actions" style="justify-content:flex-end"><button class="btn sm" data-dec="${x.id}" data-s="RESOLVED">Признать</button>
        <button class="btn ghost sm" data-dec="${x.id}" data-s="REJECTED">Отклонить</button></div></div>`).join('')}</div>`
    : emptyState('Открытых претензий нет', 'Новые претензии по сделкам появятся здесь.');
  box.querySelectorAll('[data-dec]').forEach((b) => b.onclick = async () => {
    const t = await askReason(b.dataset.s === 'RESOLVED' ? 'Признать требование' : 'Отклонить требование',
      'Опишите решение и основания (переписка, акты, смены). Стороны увидят этот текст. Деньги платформа не переводит — стороны рассчитываются напрямую.', 'Решение', 'Сохранить решение');
    if (!t) return;
    try { await rpc('admin_decide_dispute', { p_id: b.dataset.dec, p_status: b.dataset.s, p_decision: t }); toast('Решение сохранено'); route(); } catch (e) { toast(e.message, true); }
  });
}

async function reviews(box) {
  const rows = await q(sb.from('reviews').select('*, au:organizations!reviews_author_org_id_fkey(name), su:organizations!reviews_subject_org_id_fkey(name)')
    .order('created_at', { ascending: false }).limit(100));
  box.innerHTML = rows.length ? `<div class="panel">${rows.map((r) => `<div class="row-item" style="align-items:flex-start"><div class="grow">
      <span class="rating">${'★'.repeat(r.overall)}</span> <b>${esc(r.au?.name)}</b> → ${esc(r.su?.name)} <span class="small muted">· ${dateTime(r.created_at)} · ${r.status}</span>
      ${r.text ? `<p class="small" style="margin:4px 0">${esc(r.text)}</p>` : ''}${r.moderation_comment ? `<div class="small warn-text">Модерация: ${esc(r.moderation_comment)}</div>` : ''}</div>
      <div class="actions" style="justify-content:flex-end">
        ${r.status !== 'TEXT_HIDDEN' ? `<button class="btn ghost sm" data-rv="${r.id}" data-s="TEXT_HIDDEN">Скрыть текст</button>` : ''}
        ${r.status !== 'EXCLUDED' ? `<button class="btn danger sm" data-rv="${r.id}" data-s="EXCLUDED">Исключить</button>` : ''}
        ${r.status !== 'PUBLISHED' && r.status !== 'SUBMITTED' ? `<button class="btn ghost sm" data-rv="${r.id}" data-s="PUBLISHED">Вернуть</button>` : ''}
        <button class="btn danger sm" data-rvdel="${r.id}">Удалить</button></div></div>`).join('')}
      <p class="small muted">Негативный отзыв без нарушений скрывать нельзя. Скрытие — только за оскорбления, контакты, персональные данные; исключение — за накрутку или отзыв не по сделке.</p></div>`
    : emptyState('Отзывов пока нет', 'Отзывы появятся после завершённых сделок.');
  box.querySelectorAll('[data-rv]').forEach((b) => b.onclick = async () => {
    let c = null;
    if (b.dataset.s !== 'PUBLISHED') { c = await askReason('Нарушение', 'Какое правило нарушено. Это записывается в журнал.', 'Нарушение', 'Применить'); if (!c) return; }
    try { await rpc('admin_moderate_review', { p_review: b.dataset.rv, p_status: b.dataset.s, p_comment: c }); toast('Готово'); route(); } catch (e) { toast(e.message, true); }
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
