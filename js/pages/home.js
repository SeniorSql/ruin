// Главная: поиск, категории с реальными фото, свежие предложения (SCR-CAT-01)
import { sb, state, q, rpc, loadCategories } from '../api.js';
import { esc, photoOf, skeleton, plural } from '../ui.js';
import { EQ_SELECT, productCard, loadFavs, bindFavs, loadRatings } from '../cards.js';
import { icon } from '../app.js';
import { t, catName } from '../i18n.js';

// Картинки баннера заданы в css/app.css (.hero-img.day / .hero-img.night): в светлой теме — CAT 320,
// в тёмной — Zoomlion ZE215E с ночным затемнением (v=73). Грузится только картинка текущей темы.
// Фото ZE215E: Wikimedia Commons, автор Beeveevee, CC BY-SA 4.0.

export async function render(app) {
  const cats = await loadCategories();
  app.innerHTML = `
  <section class="hero">
    <div class="hero-copy">
      <h1>${t('Работа начинается <br>с <em>правильной техники</em>', 'Great work starts <br>with <em>the right machinery</em>')}</h1>
      <p>${t('Сравнивайте предложения, выбирайте проверенных исполнителей и бронируйте технику без лишних звонков.', 'Compare offers, choose verified providers and book machinery without endless calls.')}</p>
      <div class="hero-cta"><a class="btn" href="#/catalog">${t('Каталог техники', 'Machinery catalogue')} <span class="arr">→</span></a>
        <a class="btn ghost hero-ghost" href="#/orders/new">${t('Разместить заказ', 'Post an order')}</a></div>
    </div>
    <div class="hero-visual" role="img" aria-label="${t('Гусеничный экскаватор на объекте', 'Crawler excavator on site')}"><div class="hero-img day"></div><div class="hero-img night"></div>
      <div class="hero-sticker"><b id="heroCount">…</b><span>${t('единиц техники на RUIN', 'machines on RUIN')}</span></div></div>
  </section>
  <div class="benefits">
    <div class="benefit"><div class="benefit-ic">${icon('shield')}</div><div><b>${t('Проверенные исполнители', 'Verified providers')}</b><small>${t('Реквизиты сверены модератором', 'Company details checked by a moderator')}</small></div></div>
    <div class="benefit"><div class="benefit-ic">${icon('list')}</div><div><b>${t('Биржа заказов', 'Order exchange')}</b><small>${t('Опишите задачу — исполнители пришлют цены', 'Describe the job — providers send their prices')}</small></div></div>
    <div class="benefit"><div class="benefit-ic">${icon('deal')}</div><div><b>${t('Без двойных броней', 'No double bookings')}</b><small>${t('Календарь занятости обновляется сразу', 'Availability calendar updates instantly')}</small></div></div>
  </div>
  <div class="section-head"><div><div class="eyebrow">${t('БЫСТРЫЙ ДОСТУП', 'QUICK ACCESS')}</div><h2>${t('Найдите свою категорию', 'Find your category')}</h2></div><a class="see-all" href="#/catalog">${t('Весь каталог', 'Full catalogue')} <span>→</span></a></div>
  <section class="cats" id="cats">${cats.slice(0, 12).map(() => '<div class="skeleton" style="height:140px"></div>').join('')}</section>
  <div class="section-head"><div><div class="eyebrow">${t('ПРЕДЛОЖЕНИЯ ИСПОЛНИТЕЛЕЙ', 'PROVIDER OFFERS')}</div><h2>${t('Свежая техника в каталоге', 'New in the catalogue')}</h2></div><a class="see-all" href="#/catalog">${t('Смотреть все', 'See all')} <span>→</span></a></div>
  <section id="fresh">${skeleton(5)}</section>
  <div class="wide-banner"><div><b>${t('Есть своя техника? Находите заказчиков на RUIN', 'Own machinery? Find customers on RUIN')}</b><p>${t('Создайте организацию исполнителя, пройдите проверку и получайте заказы из вашего региона.', 'Create a provider organisation, get verified and receive orders from your region.')}</p></div>
    <a class="btn dark" href="${state.user ? '#/account?become=provider' : '#/register'}">${t('Стать исполнителем →', 'Become a provider →')}</a></div>
  <div class="wide-banner accent"><div><b>${t('Не нашли подходящую технику?', 'Could not find the right machine?')}</b><p id="ordersInfo">${t('Разместите заказ — исполнители сами пришлют предложения.', 'Post an order — providers will send you offers.')}</p></div>
    <a class="btn dark" href="#/orders/new">${t('Разместить заказ →', 'Post an order →')}</a></div>`;

  const [all, fresh, favs, openOrders] = await Promise.all([
    q(sb.from('equipment').select('id,category_id,photos').eq('status', 'PUBLISHED').limit(2000)),
    q(sb.from('equipment').select(EQ_SELECT).eq('status', 'PUBLISHED').order('is_demo').order('created_at', { ascending: false }).limit(10)),
    loadFavs(),
    rpc('open_orders_count').catch(() => 0)
  ]);
  app.querySelector('#heroCount').textContent = all.length;
  if (openOrders) app.querySelector('#ordersInfo').textContent = t(
    `Сейчас на бирже ${openOrders} ${plural(openOrders, 'открытый заказ', 'открытых заказа', 'открытых заказов')}. Разместите свой — исполнители пришлют предложения.`,
    `There ${openOrders === 1 ? 'is 1 open order' : `are ${openOrders} open orders`} on the exchange now. Post yours — providers will send offers.`);

  const byCat = {};
  all.forEach((e) => { (byCat[e.category_id] ||= []).push(e); });
  const shown = cats.filter((c) => byCat[c.id]).concat(cats.filter((c) => !byCat[c.id])).slice(0, 12);
  app.querySelector('#cats').innerHTML = shown.map((c) => {
    const list = byCat[c.id] || [];
    const p = list[0] && photoOf(list[0]);
    return `<a class="cat" href="#/catalog?cat=${c.code}"><div class="cat-img" style="${p ? `background-image:url('${esc(p.url)}')` : ''}"></div>
      <b>${esc(catName(c))}</b><small>${list.length ? `${list.length} ${t(plural(list.length, 'предложение', 'предложения', 'предложений'), list.length === 1 ? 'offer' : 'offers')}` : t('Пока нет предложений', 'No offers yet')}</small></a>`;
  }).join('');

  const freshEl = app.querySelector('#fresh');
  const ratings = await loadRatings(fresh);
  freshEl.innerHTML = fresh.length
    ? `<div class="products">${fresh.map((e) => productCard(e, favs, ratings)).join('')}</div>`
    : `<div class="panel empty"><b>${t('Каталог пока пуст', 'The catalogue is empty for now')}</b>${t('Станьте первым исполнителем на RUIN.', 'Become the first provider on RUIN.')}</div>`;
  bindFavs(freshEl);
}
