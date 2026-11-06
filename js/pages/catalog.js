// Каталог: поиск и фильтры в адресе страницы (AC-UX-06), пустая выдача с подсказками (BR-SRCH-06)
import { sb, state, q, rpc, loadCategories } from '../api.js';
import { esc, skeleton, qs, toMinor, mskToday, plural } from '../ui.js';
import { EQ_SELECT, productCard, loadFavs, bindFavs, loadRatings } from '../cards.js';
import { t, catName } from '../i18n.js';

const PAGE = 48;
const STALE_DAYS = 7;

export async function render(app, _p, query) {
  const cats = await loadCategories();
  const f = { q: query.q || '', cat: query.cat || '', city: query.city || '', fmt: query.fmt || '',
    max: query.max || '', sort: query.sort || 'new', from: query.from || '', to: query.to || '', stale: query.stale || '' };
  const cat = cats.find((c) => c.code === f.cat);

  app.innerHTML = `
    <div class="crumbs"><a href="#/">RUIN</a> › <b>${t('Каталог', 'Catalogue')}</b>${cat ? ' › ' + esc(catName(cat)) : ''}</div>
    <div class="page-head"><div><h1>${cat ? esc(catName(cat)) : t('Каталог техники', 'Machinery catalogue')}</h1><p>${t('Аренда с оператором и без. Цены от исполнителей, бронь онлайн.', 'Rental with or without an operator. Prices from providers, online booking.')}</p></div></div>
    <form class="filters" id="flt">
      <input class="inp" name="q" value="${esc(f.q)}" placeholder="${t('Марка, модель, задача', 'Brand, model, task')}" aria-label="${t('Поиск', 'Search')}">
      <select class="inp" name="cat" aria-label="${t('Категория', 'Category')}"><option value="">${t('Все категории', 'All categories')}</option>
        ${cats.map((c) => `<option value="${c.code}" ${c.code === f.cat ? 'selected' : ''}>${esc(catName(c))}</option>`).join('')}</select>
      <input class="inp" name="city" value="${esc(f.city)}" placeholder="${t('Город', 'City')}" aria-label="${t('Город', 'City')}" style="min-width:130px;width:140px">
      <select class="inp" name="fmt" aria-label="${t('Формат', 'Format')}"><option value="">${t('Любой формат', 'Any format')}</option>
        <option value="op" ${f.fmt === 'op' ? 'selected' : ''}>${t('С оператором', 'With operator')}</option><option value="noop" ${f.fmt === 'noop' ? 'selected' : ''}>${t('Без оператора', 'Without operator')}</option></select>
      <input class="inp" name="max" type="number" min="0" step="1" max="1000000000" value="${esc(f.max)}" placeholder="${t('Цена до, ₽', 'Max price, ₽')}" aria-label="${t('Цена до', 'Max price')}" style="width:130px;min-width:0">
      <label class="small muted">${t('Свободна с', 'Free from')} <input class="inp" type="date" name="from" value="${esc(f.from)}" min="${mskToday(1)}" style="width:150px;min-width:0"></label>
      <label class="small muted">${t('по', 'to')} <input class="inp" type="date" name="to" value="${esc(f.to)}" min="${mskToday(1)}" style="width:150px;min-width:0"></label>
      <select class="inp" name="sort" aria-label="${t('Сортировка', 'Sort')}">
        <option value="new" ${f.sort === 'new' ? 'selected' : ''}>${t('Сначала новые', 'Newest first')}</option>
        <option value="price_asc" ${f.sort === 'price_asc' ? 'selected' : ''}>${t('Сначала дешевле', 'Cheapest first')}</option>
        <option value="price_desc" ${f.sort === 'price_desc' ? 'selected' : ''}>${t('Сначала дороже', 'Most expensive first')}</option></select>
      ${f.from ? `<label class="check" style="margin:0"><input type="checkbox" name="stale" value="1" ${f.stale ? 'checked' : ''}> ${t('Показать с уточнением', 'Include unconfirmed')}</label>` : ''}
      <button class="btn dark">${t('Показать', 'Show')}</button>
      ${Object.entries(f).some(([k, v]) => v && k !== 'sort') ? `<a class="pill" href="#/catalog">${t('Сбросить', 'Reset')}</a>` : ''}
    </form>
    <div class="results-info" id="info"></div>
    <div id="res">${skeleton(8)}</div>
    <div style="text-align:center;margin-top:16px"><button class="btn ghost hidden" id="more">${t('Показать ещё', 'Show more')}</button></div>`;

  app.querySelector('#flt').onsubmit = (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    if (d.from && !d.to) d.to = d.from;
    location.hash = '#/catalog' + qs({ ...d, sort: d.sort === 'new' ? '' : d.sort });
  };

  const favs = await loadFavs();
  let busy = new Set();
  if (f.from) busy = new Set(await rpc('busy_equipment_ids', { p_from: f.from, p_to: f.to || f.from }));

  let offset = 0, shown = 0;
  const res = app.querySelector('#res');
  const moreBtn = app.querySelector('#more');
  bindFavs(res);

  async function load() {
    let b = sb.from('equipment').select(EQ_SELECT, { count: 'exact' }).eq('status', 'PUBLISHED');
    if (cat) b = b.eq('category_id', cat.id);
    if (f.city) b = b.ilike('city', `%${f.city}%`);
    if (f.fmt === 'op') b = b.eq('with_operator', true);
    if (f.fmt === 'noop') b = b.eq('without_operator', true);
    if (f.max) b = b.lte('price_minor', toMinor(f.max));
    if (f.q) {
      const words = f.q.replace(/[%,()]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 4);
      for (const w of words) b = b.or(`title.ilike.%${w}%,brand.ilike.%${w}%,model.ilike.%${w}%,description.ilike.%${w}%`);
    }
    if (f.from) {
      if (busy.size) b = b.not('id', 'in', `(${[...busy].join(',')})`);
      // BR-BOOK-07: устаревший календарь исключается, если не включён режим «с уточнением»
      if (!f.stale) b = b.gte('availability_confirmed_at', new Date(Date.now() - STALE_DAYS * 864e5).toISOString());
    }
    if (f.sort === 'price_asc') b = b.order('price_minor', { ascending: true, nullsFirst: false });
    else if (f.sort === 'price_desc') b = b.order('price_minor', { ascending: false, nullsFirst: false });
    else b = b.order('is_demo').order('created_at', { ascending: false });
    const rows = await q(b.range(offset, offset + PAGE - 1));
    return rows;
  }

  async function show(first) {
    const rows = await load();
    const total = rows.total ?? rows.length;
    if (first) {
      app.querySelector('#info').textContent = total
        ? t(`Найдено ${total} ${plural(total, 'предложение', 'предложения', 'предложений')}`, `Found ${total} ${total === 1 ? 'offer' : 'offers'}`) : '';
      if (!rows.length) {
        res.innerHTML = `<div class="panel empty"><b>${t('Ничего не нашлось', 'Nothing found')}</b>${t('Попробуйте убрать часть фильтров или поискать другую категорию. Или разместите заказ — исполнители сами пришлют предложения.', 'Try removing some filters or another category. Or post an order — providers will send you offers.')}
          <div class="actions" style="justify-content:center"><a class="btn ghost" href="#/catalog">${t('Сбросить фильтры', 'Reset filters')}</a><a class="btn" href="#/orders/new${qs({ cat: f.cat })}">${t('Разместить заказ', 'Post an order')}</a></div></div>`;
        return;
      }
      res.innerHTML = '<div class="products"></div>';
    }
    const ratings = await loadRatings(rows);
    res.querySelector('.products').insertAdjacentHTML('beforeend', rows.map((e) => {
      let html = productCard(e, favs, ratings);
      const stale = Date.now() - new Date(e.availability_confirmed_at) > STALE_DAYS * 864e5;
      if (stale && !e.is_demo) html = html.replace('<div class="spacer">', '<div class="small warn-text" style="margin-top:6px">' + t('Доступность уточняется', 'Availability to be confirmed') + '</div><div class="spacer">');
      return html;
    }).join(''));
    offset += rows.length; shown += rows.length;
    moreBtn.classList.toggle('hidden', shown >= total);
  }
  moreBtn.onclick = () => show(false);
  await show(true);
}
