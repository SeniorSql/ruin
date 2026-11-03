// Карточка техники в каталоге и избранное
import { sb, state, q } from './api.js';
import { esc, priceText, photoOf, initials, specValue, toast } from './ui.js';
export const EQ_SELECT = '*, organizations(id,name,verification_status,is_demo,type), categories(id,code,name)';

let favCache = null;
export async function loadFavs() {
  if (!state.user) return new Set();
  if (favCache) return favCache;
  const rows = await q(sb.from('favorites').select('equipment_id'));
  favCache = new Set(rows.map((r) => r.equipment_id));
  return favCache;
}

// Рейтинги исполнителей для набора карточек одним запросом
export async function loadRatings(rows) {
  const ids = [...new Set(rows.map((e) => e.org_id))];
  if (!ids.length) return new Map();
  try {
    const { data } = await sb.rpc('ratings_for', { p_orgs: ids });
    return new Map((data || []).map((r) => [r.org_id, r]));
  } catch { return new Map(); }
}

export function productCard(e, favs = new Set(), ratings = new Map()) {
  const rt = ratings.get(e.org_id);
  const rtHtml = e.is_demo ? '' : rt?.rating ? ` · <span class="rating">★ ${rt.rating}</span> <small class="muted">(${rt.n})</small>` : rt?.n ? ' · <small class="muted">мало оценок</small>' : ' · <small class="muted">новичок</small>';
  const p = photoOf(e);
  const specs = Object.entries(e.specs || {}).slice(0, 2).map(([k, v]) => `<span>${esc(specValue(k, v))}</span>`).join('');
  const fmt = [e.with_operator && 'с оператором', e.without_operator && 'без оператора'].filter(Boolean).join(' / ');
  const org = e.organizations || {};
  return `<a class="product" href="#/item/${e.id}">
    <div class="pv">
      ${p ? `<img src="${esc(p.url)}" alt="${esc(e.title)}" loading="lazy" referrerpolicy="no-referrer">` : ''}      ${e.is_demo ? '<span class="tag demo">Пример</span>' : org.verification_status === 'VERIFIED' ? '<span class="tag">✓ Проверен</span>' : ''}
      ${state.user ? `<button class="fav ${favs.has(e.id) ? 'on' : ''}" data-fav="${e.id}" aria-label="В избранное">${favs.has(e.id) ? '♥' : '♡'}</button>` : ''}
      ${p?.author ? `<span class="credit">Фото: ${esc(p.author)} · ${esc(p.license || '')}</span>` : ''}
    </div>
    <div class="pi">
      <span class="cat-name">${esc(e.categories?.name || '')}</span>
      <h3>${esc(e.title)}</h3>
      <div class="meta">${esc(e.city)}${e.district ? ' · ' + esc(e.district) : ''}${fmt ? ' · ' + fmt : ''}</div>
      <div class="seller"><span class="sa">${esc(initials(org.name))}</span><span><b>${esc(org.name || '')}</b>${rtHtml}</span></div>
      <div class="spec-chips">${specs}</div>
      <div class="spacer"></div>
      <div class="price-row"><div><strong class="num">${priceText(e)}</strong></div></div>
    </div></a>`;
}

// Делегированный обработчик «сердечек» в любом контейнере
export function bindFavs(root) {
  root.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-fav]');
    if (!b) return;
    ev.preventDefault(); ev.stopPropagation();
    const id = b.dataset.fav;
    const favs = await loadFavs();
    const on = !favs.has(id);
    const { error } = on
      ? await sb.from('favorites').insert({ user_id: state.user.id, equipment_id: id })
      : await sb.from('favorites').delete().eq('user_id', state.user.id).eq('equipment_id', id);
    if (error) { toast('Не удалось обновить избранное', true); return; }
    on ? favs.add(id) : favs.delete(id);
    b.classList.toggle('on', on); b.textContent = on ? '♥' : '♡';
    toast(on ? 'Добавлено в избранное' : 'Удалено из избранного');
  });
}
