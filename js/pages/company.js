// Публичная страница компании-исполнителя: реквизиты, проверка, рейтинг, отзывы, техника (Модуль 8, I1)
import { sb, q, rpc } from '../api.js';
import { esc, status, ORG_TYPE, date, dateTime, initials, emptyState, errorState, plural } from '../ui.js';
import { EQ_SELECT, productCard, loadFavs, bindFavs } from '../cards.js';
import { stars } from '../dealExtras.js';

export async function render(app, { id }) {
  let o, eq, revs, stats, rating, favs;
  try {
    o = await q(sb.from('organizations').select('*').eq('id', id).maybeSingle());
    if (!o || o.type === 'PERSON') { app.innerHTML = emptyState('Компания не найдена', 'Возможно, ссылка устарела.'); return; }
    [eq, revs, stats, rating, favs] = await Promise.all([
      q(sb.from('equipment').select(EQ_SELECT).eq('org_id', id).eq('status', 'PUBLISHED').order('created_at', { ascending: false })),
      q(sb.from('reviews').select('*').eq('subject_org_id', id).eq('subject_role', 'PROVIDER').in('status', ['PUBLISHED', 'TEXT_HIDDEN']).order('published_at', { ascending: false }).limit(50)),
      rpc('public_org_stats', { p_org: id }), rpc('org_rating', { p_org: id, p_role: 'PROVIDER' }), loadFavs()
    ]);
  } catch (err) { app.innerHTML = errorState(err); return; }
  const n = rating?.n || 0;
  document.title = `${o.name} — аренда спецтехники | RUIN`;
  app.innerHTML = `
    <div class="crumbs"><a href="#/">RUIN</a> › <a href="#/catalog">Каталог</a> › <b>${esc(o.name)}</b></div>
    ${o.is_demo ? '<div class="banner warn"><b>Пример компании.</b>&nbsp;Демонстрационные данные.</div>' : ''}
    <div class="cols">
      <div>
        <div class="panel"><div class="provider-box"><span class="sa" style="width:56px;height:56px;font-size:18px">${esc(initials(o.name))}</span>
          <div><h1 style="font-size:26px">${esc(o.name)}</h1><div style="margin-top:4px">${status('org', o.verification_status)}
            <span class="muted small"> · ${ORG_TYPE[o.type]}${o.city ? ' · ' + esc(o.city) : ''}</span></div></div></div></div>
        <div class="section-head"><h2>Техника в аренду <span class="muted">(${eq.length})</span></h2></div>
        <div id="eq">${eq.length ? `<div class="products">${eq.map((e) => productCard(e, favs, new Map([[id, { rating: rating?.rating, n }]]))).join('')}</div>` : '<p class="muted">Опубликованной техники пока нет.</p>'}</div>
        <div class="section-head"><h2>Отзывы заказчиков</h2></div>
        <div class="panel">${revs.length ? revs.map((r) => `<div class="row-item" style="display:block">
            <div class="rating">${stars(r.overall)}</div>
            ${r.text && r.status !== 'TEXT_HIDDEN' ? `<p style="margin:6px 0">${esc(r.text)}</p>` : r.status === 'TEXT_HIDDEN' ? '<p class="small muted">Текст скрыт модератором</p>' : ''}
            <div class="small muted">Заказчик · ${date(r.published_at)}</div>
            ${r.reply_text ? `<div class="banner info small" style="margin:8px 0 0"><b>Ответ компании:</b>&nbsp;${esc(r.reply_text)}</div>` : ''}</div>`).join('')
          : '<p class="muted">Отзывов пока нет. Они появляются после завершённых сделок.</p>'}</div>
      </div>
      <aside class="sticky"><div class="panel"><h2>О компании</h2>
        <dl class="kv"><dt>ИНН</dt><dd>${esc(o.inn || '—')}</dd>${o.ogrn ? `<dt>ОГРН</dt><dd>${esc(o.ogrn)}</dd>` : ''}
          <dt>На RUIN с</dt><dd>${date(o.created_at)}</dd><dt>Завершено сделок</dt><dd>${stats.completed ?? 0}</dd>
          <dt>Техники</dt><dd>${stats.listings ?? 0}</dd></dl>
        <div class="divider"></div>
        <h3>Рейтинг</h3>
        ${rating?.rating ? `<div class="price-big rating">★ ${rating.rating}</div><div class="small muted">${n} ${plural(n, 'отзыв', 'отзыва', 'отзывов')}</div>
          <div class="bars" style="margin-top:10px">${[5, 4, 3, 2, 1].map((s) => `<span>${s}★</span><span class="bar"><i style="width:${n ? Math.round(100 * rating.dist[s] / n) : 0}%"></i></span><span>${rating.dist[s]}</span>`).join('')}</div>`
          : `<p class="muted" style="margin:0">Нет оценок — новичок на платформе</p>`}
        <p class="small muted" style="margin:12px 0 0">Контакты компании откроются после подтверждения сделки.</p>
      </div></aside>
    </div>`;
  bindFavs(app.querySelector('#eq'));
}
