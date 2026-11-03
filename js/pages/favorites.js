// Избранное (FR-CAT-009)
import { sb, q } from '../api.js';
import { emptyState, errorState } from '../ui.js';
import { EQ_SELECT, productCard, loadFavs, bindFavs } from '../cards.js';

export async function render(app) {
  let rows;
  try {
    const favs = await loadFavs();
    rows = favs.size ? await q(sb.from('equipment').select(EQ_SELECT).in('id', [...favs])) : [];
    app.innerHTML = `<div class="page-head"><div><h1>Избранное</h1><p>Техника, которую вы отметили сердечком.</p></div></div>
      ${rows.length ? `<div class="products">${rows.map((e) => productCard(e, favs)).join('')}</div>`
      : emptyState('В избранном пусто', 'Нажмите ♡ на карточке техники, чтобы сохранить её здесь.', '<a class="btn" href="#/catalog">В каталог</a>')}`;
    bindFavs(app);
  } catch (err) { app.innerHTML = errorState(err); }
}
