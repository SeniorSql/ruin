// Каталог: поиск и фильтры в адресе страницы (AC-UX-06), пустая выдача с подсказками (BR-SRCH-06)
import { sb, state, q, rpc, loadCategories } from '../api.js';
import { esc, skeleton, qs, toMinor, mskToday, plural } from '../ui.js';
import { EQ_SELECT, productCard, loadFavs, bindFavs } from '../cards.js';

const PAGE = 48;
const STALE_DAYS = 7;

export async function render(app, _p, query) {
  const cats = await loadCategories();
  const f = { q: query.q || '', cat: query.cat || '', city: query.city || '', fmt: query.fmt || '',
    max: query.max || '', sort: query.sort || 'new', from: query.from || '', to: query.to || '', stale: query.stale || '' };
  const cat = cats.find((c) => c.code === f.cat);

  app.innerHTML = `
    <div class="crumbs"><a href="#/">RUIN</a> › <b>Каталог</b>${cat ? ' › ' + esc(cat.name) : ''}</div>
    <div class="page-head"><div><h1>${cat ? esc(cat.name) : 'Каталог техники'}</h1><p>Аренда с оператором и без. Цены от исполнителей, бронь онлайн.</p></div></div>
    <form class="filters" id="flt">
      <input class="inp" name="q" value="${esc(f.q)}" placeholder="Марка, модель, задача" aria-label="Поиск">
      <select class="inp" name="cat" aria-label="Категория"><option value="">Все категории</option>
        ${cats.map((c) => `<option value="${c.code}" ${c.code === f.cat ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
      <input class="inp" name="city" value="${esc(f.city)}" placeholder="Город" aria-label="Город" style="min-width:130px;width:140px">
      <select class="inp" name="fmt" aria-label="Формат"><option value="">Любой формат</option>
        <option value="op" ${f.fmt === 'op' ? 'selected' : ''}>С оператором</option><option value="noop" ${f.fmt === 'noop' ? 'selected' : ''}>Без оператора</option></select>
      <input class="inp" name="max" type="number" min="0" step="500" value="${esc(f.max)}" placeholder="Цена до, ₽" aria-label="Цена до" style="width:130px;min-width:0">
      <label class="small muted">Свободна с <input class="inp" type="date" name="from" value="${esc(f.from)}" min="${mskToday(1)}" style="width:150px;min-width:0"></label>
      <label class="small muted">по <input class="inp" type="date" name="to" value="${esc(f.to)}" min="${mskToday(1)}" style="width:150px;min-width:0"></label>
      <select class="inp" name="sort" aria-label="Сортировка">
        <option value="new" ${f.sort === 'new' ? 'selected' : ''}>Сначала новые</option>
        <option value="price_asc" ${f.sort === 'price_asc' ? 'selected' : ''}>Сначала дешевле</option>
        <option value="price_desc" ${f.sort === 'price_desc' ? 'selected' : ''}>Сначала дороже</option></select>
      ${f.from ? `<label class="check" style="margin:0"><input type="checkbox" name="stale" value="1" ${f.stale ? 'checked' : ''}> Показать с уточнением</label>` : ''}
      <button class="btn dark">Показать</button>
      ${Object.entries(f).some(([k, v]) => v && k !== 'sort') ? '<a class="pill" href="#/catalog">Сбросить</a>' : ''}
    </form>
    <div class="results-info" id="info"></div>
    <div id="res">${skeleton(8)}</div>
    <div style="text-align:center;margin-top:16px"><button class="btn ghost hidden" id="more">Показать ещё</button></div>`;

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
        ? `Найдено ${total} ${plural(total, 'предложение', 'предложения', 'предложений')}` : '';
      if (!rows.length) {
        res.innerHTML = `<div class="panel empty"><b>Ничего не нашлось</b>Попробуйте убрать часть фильтров или поискать другую категорию.
          Или разместите заказ — исполнители сами пришлют предложения.
          <div class="actions" style="justify-content:center"><a class="btn ghost" href="#/catalog">Сбросить фильтры</a><a class="btn" href="#/orders/new${qs({ cat: f.cat })}">Разместить заказ</a></div></div>`;
        return;
      }
      res.innerHTML = '<div class="products"></div>';
    }
    res.querySelector('.products').insertAdjacentHTML('beforeend', rows.map((e) => {
      let html = productCard(e, favs);
      const stale = Date.now() - new Date(e.availability_confirmed_at) > STALE_DAYS * 864e5;
      if (stale && !e.is_demo) html = html.replace('<div class="spacer">', '<div class="small" style="color:#9a3412;margin-top:6px">Доступность уточняется</div><div class="spacer">');
      return html;
    }).join(''));
    offset += rows.length; shown += rows.length;
    moreBtn.classList.toggle('hidden', shown >= total);
  }
  moreBtn.onclick = () => show(false);
  await show(true);
}
