// Отзывы организации: обо мне, ждут моего отзыва, мои отзывы (Модуль 8, «Моя репутация» упрощённо)
import { sb, state, q, rpc, canManage } from '../api.js';
import { esc, date, emptyState, errorState, toast, askReason, plural } from '../ui.js';
import { stars } from '../dealExtras.js';
import { route } from '../app.js';

export async function render(app, _p, query) {
  const o = state.org;
  const tab = query.tab || 'about';
  let about, mine, completed, rating;
  try {
    [about, mine, completed, rating] = await Promise.all([
      q(sb.from('reviews').select('*, deals(id,number), author:organizations!reviews_author_org_id_fkey(name,type)').eq('subject_org_id', o.id)
        .in('status', ['PUBLISHED', 'TEXT_HIDDEN']).order('published_at', { ascending: false })),
      q(sb.from('reviews').select('*, deals(id,number), subject:organizations!reviews_subject_org_id_fkey(name,type)').eq('author_org_id', o.id).order('created_at', { ascending: false })),
      q(sb.from('deals').select('id,number,completed_at,customer_org_id,provider_org_id,equipment(title)')
        .or(`customer_org_id.eq.${o.id},provider_org_id.eq.${o.id}`).eq('status', 'COMPLETED')
        .gte('completed_at', new Date(Date.now() - 14 * 864e5).toISOString()).order('completed_at', { ascending: false })),
      rpc('org_rating', { p_org: o.id, p_role: o.can_provide ? 'PROVIDER' : 'CUSTOMER' }).catch(() => null)
    ]);
  } catch (err) { app.innerHTML = errorState(err); return; }
  const reviewed = new Set(mine.map((r) => r.deal_id));
  const waiting = completed.filter((d) => !reviewed.has(d.id));
  const who = (org) => (org?.type === 'PERSON' ? 'Частное лицо' : org?.name || '');
  const daysLeft = (d) => Math.max(0, 14 - Math.floor((Date.now() - new Date(d.completed_at)) / 864e5));

  const tabs = [['about', `Обо мне (${about.length})`], ['waiting', `Ждут вашего отзыва (${waiting.length})`], ['mine', `Мои отзывы (${mine.length})`]];
  let body = '';
  if (tab === 'about') {
    body = about.length ? about.map((r) => `<div class="row-item" style="display:block">
        <div class="actions" style="justify-content:space-between"><span class="rating">${stars(r.overall)}</span>
          <a class="small" href="#/deals/${r.deal_id}">Сделка ${esc(r.deals?.number || '')} →</a></div>
        ${r.text && r.status !== 'TEXT_HIDDEN' ? `<p style="margin:6px 0">${esc(r.text)}</p>` : r.status === 'TEXT_HIDDEN' ? '<p class="small muted">Текст скрыт модератором</p>' : ''}
        <div class="small muted">${esc(who(r.author))} · ${date(r.published_at)} · ${r.subject_role === 'PROVIDER' ? 'вы как исполнитель' : 'вы как заказчик'}</div>
        ${r.reply_text ? `<div class="banner info small" style="margin:8px 0 0"><b>Ваш ответ:</b>&nbsp;${esc(r.reply_text)}</div>`
          : canManage() ? `<button class="btn ghost sm" data-reply="${r.id}" style="margin-top:8px">Ответить</button>` : ''}</div>`).join('')
      : `<div class="empty"><b>Опубликованных отзывов о вас пока нет</b>Отзыв второй стороны открывается, когда вы оставите свой по той же сделке, или через 14 дней после её завершения.
         ${waiting.length ? '<div><a class="btn" href="#/reviews?tab=waiting">Оставить отзыв</a></div>' : ''}</div>`;
  } else if (tab === 'waiting') {
    body = waiting.length ? `<div class="banner info">Отзывы открываются вслепую: отзыв второй стороны о вас станет виден, как только вы оставите свой (или через 14 дней).</div>`
      + waiting.map((d) => `<a class="row-item" href="#/deals/${d.id}"><div class="grow"><b>${esc(d.number)} · ${esc(d.equipment?.title || '')}</b>
          <div class="small muted">Завершена ${date(d.completed_at)} · ${d.customer_org_id === o.id ? 'вы заказчик' : 'вы исполнитель'} · осталось ${daysLeft(d)} ${plural(daysLeft(d), 'день', 'дня', 'дней')}</div></div>
          <span class="btn sm">Оставить отзыв</span></a>`).join('')
      : '<div class="empty"><b>Все отзывы оставлены</b>Здесь появятся завершённые сделки за последние 14 дней, по которым вы ещё не оставили отзыв.</div>';
  } else {
    body = mine.length ? mine.map((r) => `<div class="row-item" style="display:block">
        <div class="actions" style="justify-content:space-between"><span class="rating">${stars(r.overall)}</span>
          ${r.status === 'SUBMITTED' ? '<span class="st wait">Опубликуется, когда отзыв оставит вторая сторона или через 14 дней</span>' : '<span class="st ok">Опубликован</span>'}</div>
        ${r.text ? `<p style="margin:6px 0">${esc(r.text)}</p>` : ''}
        <div class="small muted">О ком: ${esc(who(r.subject))} · <a href="#/deals/${r.deal_id}">сделка ${esc(r.deals?.number || '')}</a> · ${date(r.created_at)}</div>
        ${r.reply_text ? `<div class="banner info small" style="margin:8px 0 0"><b>Ответ:</b>&nbsp;${esc(r.reply_text)}</div>` : ''}</div>`).join('')
      : '<div class="empty"><b>Вы ещё не оставляли отзывов</b>Оставить отзыв можно на странице завершённой сделки.</div>';
  }

  app.innerHTML = `
    <div class="page-head"><div><h1>Отзывы</h1><p>${esc(o.type === 'PERSON' ? 'Личный профиль' : o.name)}${rating?.n ? ` · рейтинг ${rating.rating ? '★ ' + rating.rating : '— мало оценок'} (${rating.n} ${plural(rating.n, 'отзыв', 'отзыва', 'отзывов')})` : ''}</p></div>
      ${o.type !== 'PERSON' && o.can_provide ? `<a class="btn ghost" href="#/company/${o.id}">Публичная страница компании</a>` : ''}</div>
    <div class="tabs">${tabs.map(([k, t]) => `<a href="#/reviews?tab=${k}" class="${k === tab ? 'on' : ''}">${t}</a>`).join('')}</div>
    <div class="panel">${body}</div>`;

  app.querySelectorAll('[data-reply]').forEach((b) => b.onclick = async () => {
    const r = await askReason('Ответ на отзыв', 'Ответ будет виден всем под отзывом. Изменить его нельзя.', 'Ответ', 'Опубликовать ответ');
    if (!r) return;
    try { await rpc('reply_review', { p_review: b.dataset.reply, p_text: r }); toast('Ответ опубликован'); route(); } catch (e) { toast(e.message, true); }
  });
}
