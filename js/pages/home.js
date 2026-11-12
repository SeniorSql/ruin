// Главная: поиск, категории с реальными фото, свежие предложения (SCR-CAT-01)
import { sb, state, q, rpc, loadCategories } from '../api.js';
import { esc, photoOf, skeleton, plural, money, UNIT } from '../ui.js';
import { EQ_SELECT, productCard, loadFavs, bindFavs, loadRatings } from '../cards.js';
import { t, catName } from '../i18n.js';

// Картинки баннера заданы в css/app.css (.hero-img.day / .hero-img.night): в светлой теме — Komatsu днём (img/hero-day.jpg),
// в тёмной — Zoomlion ночью (img/hero-night.jpg), фото Этибара. Грузится только картинка текущей темы.
// Счётчик техники с v=77 — в шапке сайта (app.js, .top-count).

// Цена «от» в карточке категории: первая единица, по которой есть цены (час → смена → сутки),
// чтобы не сравнивать цену за час с ценой за смену.
function fromPrice(list) {
  for (const u of ['HOUR', 'SHIFT', 'DAY']) {
    const v = list.filter((e) => e.price_unit === u && e.price_minor != null).map((e) => Number(e.price_minor));
    if (v.length) return `${t('от', 'from')} ${money(Math.min(...v))} / ${UNIT[u]}`;
  }
  return t('Цена договорная', 'Price on request');
}

function catCard(c, list) {
  const withPhoto = list.find((e) => photoOf(e));
  const p = withPhoto && photoOf(withPhoto);
  const cities = [...new Set(list.map((e) => e.city).filter(Boolean))];
  const cityTxt = cities.slice(0, 2).join(' · ') + (cities.length > 2 ? ` +${cities.length - 2}` : '');
  const n = list.length;
  return `<a class="cat" href="#/catalog?cat=${esc(c.code)}">
    <div class="cat-img" style="${p ? `background-image:url('${esc(p.url)}')` : ''}"></div>
    <span class="cat-count">${n} ${t(plural(n, 'предложение', 'предложения', 'предложений'), n === 1 ? 'offer' : 'offers')}</span>
    <span class="cat-go" aria-hidden="true">→</span>
    <div class="cat-body"><b>${esc(catName(c))}</b><span class="cat-price">${fromPrice(list)}</span>${cityTxt ? `<span class="cat-cities">${esc(cityTxt)}</span>` : ''}</div></a>`;
}

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
    <div class="hero-visual" role="img" aria-label="${t('Гусеничный экскаватор на объекте', 'Crawler excavator on site')}"><div class="hero-img day"></div><div class="hero-img night"></div></div>
  </section>
  <div class="section-head" id="catsHead"><div><div class="eyebrow">${t('БЫСТРЫЙ ДОСТУП', 'QUICK ACCESS')}</div><h2>${t('Найдите свою категорию', 'Find your category')}</h2></div><a class="see-all" href="#/catalog">${t('Весь каталог', 'Full catalogue')} <span>→</span></a></div>
  <section class="cats few" id="cats">${'<div class="skeleton" style="height:190px;border-radius:18px"></div>'.repeat(2)}</section>
  <div class="section-head"><div><div class="eyebrow">${t('ПРЕДЛОЖЕНИЯ ИСПОЛНИТЕЛЕЙ', 'PROVIDER OFFERS')}</div><h2>${t('Свежая техника в каталоге', 'New in the catalogue')}</h2></div><a class="see-all" href="#/catalog">${t('Смотреть все', 'See all')} <span>→</span></a></div>
  <section id="fresh">${skeleton(5)}</section>
  <div class="wide-banner"><div><b>${t('Есть своя техника? Находите заказчиков на RUIN', 'Own machinery? Find customers on RUIN')}</b><p>${t('Создайте организацию исполнителя, пройдите проверку и получайте заказы из вашего региона.', 'Create a provider organisation, get verified and receive orders from your region.')}</p></div>
    <a class="btn dark" href="${state.user ? '#/account?become=provider' : '#/register'}">${t('Стать исполнителем →', 'Become a provider →')}</a></div>
  <div class="wide-banner accent"><div><b>${t('Не нашли подходящую технику?', 'Could not find the right machine?')}</b><p id="ordersInfo">${t('Разместите заказ — исполнители сами пришлют предложения.', 'Post an order — providers will send you offers.')}</p></div>
    <a class="btn dark" href="#/orders/new">${t('Разместить заказ →', 'Post an order →')}</a></div>`;

  const [all, fresh, favs, openOrders] = await Promise.all([
    q(sb.from('equipment').select('id,category_id,photos,price_minor,price_unit,city').eq('status', 'PUBLISHED').limit(2000)),
    q(sb.from('equipment').select(EQ_SELECT).eq('status', 'PUBLISHED').order('is_demo').order('created_at', { ascending: false }).limit(10)),
    loadFavs(),
    rpc('open_orders_count').catch(() => 0)
  ]);
  if (openOrders) app.querySelector('#ordersInfo').textContent = t(
    `Сейчас на бирже ${openOrders} ${plural(openOrders, 'открытый заказ', 'открытых заказа', 'открытых заказов')}. Разместите свой — исполнители пришлют предложения.`,
    `There ${openOrders === 1 ? 'is 1 open order' : `are ${openOrders} open orders`} on the exchange now. Post yours — providers will send offers.`);

  const byCat = {};
  all.forEach((e) => { (byCat[e.category_id] ||= []).push(e); });
  // Только категории, где есть техника (пустые скрыты с 12.11.2026), — самые наполненные первыми, не больше 8.
  const shown = cats.filter((c) => byCat[c.id]).sort((a, b) => byCat[b.id].length - byCat[a.id].length).slice(0, 8);
  const catsEl = app.querySelector('#cats');
  if (!shown.length) { catsEl.remove(); app.querySelector('#catsHead').remove(); }
  else {
    // Если категорий мало — карточки шире, а в конце приглашение для исполнителей (чтобы ряд не выглядел пустым)
    const few = shown.length < 4;
    catsEl.classList.toggle('few', few);
    catsEl.innerHTML = shown.map((c) => catCard(c, byCat[c.id])).join('') + (few ? `
      <a class="cat cat-invite" href="${state.user ? '#/account?become=provider' : '#/register'}">
        <span class="inv-ic">+</span>
        <b>${t('Сдаёте технику в аренду?', 'Rent out machinery?')}</b>
        <small>${t('Разместите её на RUIN бесплатно — заказчики увидят её здесь.', 'List it on RUIN for free — customers will see it here.')}</small>
        <span class="inv-link">${t('Разместить технику →', 'List machinery →')}</span></a>` : '');
  }

  const freshEl = app.querySelector('#fresh');
  const ratings = await loadRatings(fresh);
  freshEl.innerHTML = fresh.length
    ? `<div class="products">${fresh.map((e) => productCard(e, favs, ratings)).join('')}</div>`
    : `<div class="panel empty"><b>${t('Каталог пока пуст', 'The catalogue is empty for now')}</b>${t('Станьте первым исполнителем на RUIN.', 'Become the first provider on RUIN.')}</div>`;
  bindFavs(freshEl);
}
