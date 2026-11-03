// Главная: поиск, категории с реальными фото, свежие предложения (SCR-CAT-01)
import { sb, state, q, rpc, loadCategories } from '../api.js';
import { esc, photoOf, skeleton, plural } from '../ui.js';
import { EQ_SELECT, productCard, loadFavs, bindFavs, loadRatings } from '../cards.js';
import { icon } from '../app.js';

const HERO = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Caterpillar_320.jpg/960px-Caterpillar_320.jpg';

export async function render(app) {
  const cats = await loadCategories();
  app.innerHTML = `
  <section class="hero">
    <div class="hero-copy">
      <div class="overline"><i></i> МАРКЕТПЛЕЙС СТРОИТЕЛЬНОЙ ТЕХНИКИ</div>
      <h1>Работа начинается<br>с <em>правильной техники</em></h1>
      <p>Сравнивайте предложения, выбирайте проверенных исполнителей и бронируйте технику без лишних звонков.</p>
      <form class="hero-search" id="heroSearch"><input name="q" placeholder="Какая техника нужна вашему проекту?" aria-label="Поиск"><button class="btn">Подобрать</button></form>
      <div class="chips"><span>Ищут сейчас:</span>
        <a href="#/catalog?cat=excavators">Экскаваторы</a><a href="#/catalog?cat=truck_cranes">Автокраны</a><a href="#/catalog?cat=dump_trucks">Самосвалы</a></div>
    </div>
    <div class="hero-visual"><img src="${HERO}" alt="Гусеничный экскаватор на объекте" referrerpolicy="no-referrer">
      <div class="hero-sticker"><b id="heroCount">…</b><span>единиц техники на RUIN</span></div></div>
  </section>
  <div class="benefits">
    <div class="benefit"><div class="benefit-ic">${icon('shield')}</div><div><b>Проверенные исполнители</b><small>Реквизиты сверены модератором</small></div></div>
    <div class="benefit"><div class="benefit-ic">${icon('list')}</div><div><b>Биржа заказов</b><small>Опишите задачу — исполнители пришлют цены</small></div></div>
    <div class="benefit"><div class="benefit-ic">${icon('deal')}</div><div><b>Без двойных броней</b><small>Календарь занятости обновляется сразу</small></div></div>
  </div>
  <div class="section-head"><div><div class="eyebrow">БЫСТРЫЙ ДОСТУП</div><h2>Найдите свою категорию</h2></div><a class="see-all" href="#/catalog">Весь каталог <span>→</span></a></div>
  <section class="cats" id="cats">${cats.slice(0, 12).map(() => '<div class="skeleton" style="height:140px"></div>').join('')}</section>
  <div class="section-head"><div><div class="eyebrow">ПРЕДЛОЖЕНИЯ ИСПОЛНИТЕЛЕЙ</div><h2>Свежая техника в каталоге</h2></div><a class="see-all" href="#/catalog">Смотреть все <span>→</span></a></div>
  <section id="fresh">${skeleton(5)}</section>
  <div class="wide-banner"><div><b>Есть своя техника? Находите заказчиков на RUIN</b><p>Создайте организацию исполнителя, пройдите проверку и получайте заказы из вашего региона.</p></div>
    <a class="btn dark" href="${state.user ? '#/account' : '#/register'}">Стать исполнителем →</a></div>
  <div class="wide-banner" style="background:#fff4c7"><div><b>Не нашли подходящую технику?</b><p id="ordersInfo">Разместите заказ — исполнители сами пришлют предложения.</p></div>
    <a class="btn dark" href="#/orders/new">Разместить заказ →</a></div>`;

  app.querySelector('#heroSearch').onsubmit = (e) => {
    e.preventDefault();
    location.hash = '#/catalog?q=' + encodeURIComponent(e.target.q.value.trim());
  };

  const [all, fresh, favs, openOrders] = await Promise.all([
    q(sb.from('equipment').select('id,category_id,photos').eq('status', 'PUBLISHED').limit(2000)),
    q(sb.from('equipment').select(EQ_SELECT).eq('status', 'PUBLISHED').order('is_demo').order('created_at', { ascending: false }).limit(10)),
    loadFavs(),
    rpc('open_orders_count').catch(() => 0)
  ]);
  app.querySelector('#heroCount').textContent = all.length;
  if (openOrders) app.querySelector('#ordersInfo').textContent =
    `Сейчас на бирже ${openOrders} ${plural(openOrders, 'открытый заказ', 'открытых заказа', 'открытых заказов')}. Разместите свой — исполнители пришлют предложения.`;

  const byCat = {};
  all.forEach((e) => { (byCat[e.category_id] ||= []).push(e); });
  const shown = cats.filter((c) => byCat[c.id]).concat(cats.filter((c) => !byCat[c.id])).slice(0, 12);
  app.querySelector('#cats').innerHTML = shown.map((c) => {
    const list = byCat[c.id] || [];
    const p = list[0] && photoOf(list[0]);
    return `<a class="cat" href="#/catalog?cat=${c.code}"><div class="cat-img" style="${p ? `background-image:url('${esc(p.url)}')` : 'background:#ecebe5'}"></div>
      <b>${esc(c.name)}</b><small>${list.length ? `${list.length} ${plural(list.length, 'предложение', 'предложения', 'предложений')}` : 'Пока нет предложений'}</small></a>`;
  }).join('');

  const freshEl = app.querySelector('#fresh');
  const ratings = await loadRatings(fresh);
  freshEl.innerHTML = fresh.length
    ? `<div class="products">${fresh.map((e) => productCard(e, favs, ratings)).join('')}</div>`
    : '<div class="panel empty"><b>Каталог пока пуст</b>Станьте первым исполнителем на RUIN.</div>';
  bindFavs(freshEl);
}
