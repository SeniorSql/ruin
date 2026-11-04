// Подключение к Supabase и состояние пользователя (кто вошёл, от имени какой организации действует)
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const cfg = window.RUIN_CONFIG || {};
export const configured = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes('YOUR-PROJECT');

export const sb = configured ? createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
}) : null;

export const state = {
  user: null,        // auth user
  profile: null,     // profiles row
  orgs: [],          // [{...organization, role}]
  org: null,         // текущий рабочий контекст (BR-ORG-04)
  categories: [],
  counters: {}
};

const CTX_KEY = 'ruin.ctx';

// Понятные сообщения вместо технических ошибок
export function humanError(err) {
  const m = err?.message || String(err);
  if (/Invalid login credentials/i.test(m)) return 'Неверный email или пароль';
  if (/Email not confirmed/i.test(m)) return 'Подтвердите email по ссылке из письма';
  if (/User already registered/i.test(m)) return 'Пользователь с таким email уже есть. Попробуйте войти';
  if (/Password should be/i.test(m)) return 'Пароль слишком простой: минимум 10 символов';
  if (/rate limit/i.test(m)) return 'Слишком много попыток. Подождите немного';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Нет связи с сервером. Проверьте интернет';
  if (/JWT expired/i.test(m)) return 'Сессия истекла — войдите снова';
  if (/violates row-level security|permission denied/i.test(m)) return 'Недостаточно прав для этого действия';
  return m;
}

export async function rpc(name, args = {}) {
  const { data, error } = await sb.rpc(name, args);
  if (error) throw new Error(humanError(error));
  return data;
}

// Выполнить запрос PostgREST и вернуть data или выбросить понятную ошибку
export async function q(builder) {
  const { data, error, count } = await builder;
  if (error) throw new Error(humanError(error));
  return count != null && Array.isArray(data) ? Object.assign(data, { total: count }) : data;
}

export async function loadCategories() {
  if (state.categories.length) return state.categories;
  state.categories = await q(sb.from('categories').select('*').order('sort'));
  return state.categories;
}
export const categoryById = (id) => state.categories.find((c) => c.id === Number(id));

export async function loadMe() {
  const { data: { session } } = await sb.auth.getSession();
  state.user = session?.user || null;
  state.profile = null; state.orgs = []; state.org = null;
  if (!state.user) return;
  const [profile, members] = await Promise.all([
    q(sb.from('profiles').select('*').eq('id', state.user.id).maybeSingle()),
    q(sb.from('organization_members').select('role,status,organizations(*)').eq('user_id', state.user.id).eq('status', 'ACTIVE'))
  ]);
  state.profile = profile;
  state.orgs = (members || []).map((m) => ({ ...m.organizations, role: m.role }))
    .sort((a, b) => (a.type === 'PERSON') - (b.type === 'PERSON') || a.created_at.localeCompare(b.created_at));
  let saved = null;
  try { saved = localStorage.getItem(CTX_KEY); } catch {}
  state.org = state.orgs.find((o) => o.id === saved) || state.orgs[0] || null;
}

export function setOrg(id) {
  state.org = state.orgs.find((o) => o.id === id) || state.org;
  try { localStorage.setItem(CTX_KEY, state.org.id); } catch {}
}

export async function refreshCounters() {
  if (!state.org) { state.counters = {}; return; }
  try { state.counters = await rpc('my_counters', { p_org: state.org.id }) || {}; } catch { state.counters = {}; }
  // Раздельные счётчики «нужно ваше действие» для сделок заказчика и исполнителя
  // плюс «ждёт другую сторону» и действия, которые ждут вас в других ваших организациях
  try {
    const ids = state.orgs.map((o) => o.id);
    const [asProv, asCust] = await Promise.all([
      sb.from('deals').select('provider_org_id,status').in('provider_org_id', ids).in('status', ['AWAITING_CONFIRMATION', 'COMPLETION_PENDING']),
      sb.from('deals').select('customer_org_id,status').in('customer_org_id', ids).in('status', ['AWAITING_CONFIRMATION', 'COMPLETION_PENDING'])
    ]);
    const need = {};
    const c = state.counters;
    c.deals_provider = 0; c.deals_customer = 0; c.deals_provider_wait = 0; c.deals_customer_wait = 0;
    for (const d of asProv.data || []) {
      const mine = d.provider_org_id === state.org.id;
      if (d.status === 'AWAITING_CONFIRMATION') { if (mine) c.deals_provider++; else need[d.provider_org_id] = (need[d.provider_org_id] || 0) + 1; }
      else if (mine) c.deals_provider_wait++;
    }
    for (const d of asCust.data || []) {
      const mine = d.customer_org_id === state.org.id;
      if (d.status === 'COMPLETION_PENDING') { if (mine) c.deals_customer++; else need[d.customer_org_id] = (need[d.customer_org_id] || 0) + 1; }
      else if (mine) c.deals_customer_wait++;
    }
    // Продления, которые ждут ответа от моей стороны, — тоже «нужно ваше действие»
    const { data: exts } = await sb.from('deal_extensions').select('deal_id,requested_by_org,deals(customer_org_id,provider_org_id)').eq('status', 'REQUESTED');
    c.ext_wait = {};
    for (const x of exts || []) {
      const d = x.deals; if (!d) continue;
      const me = [d.customer_org_id, d.provider_org_id].find((id) => ids.includes(id) && id !== x.requested_by_org);
      if (!me) continue;
      if (me !== state.org.id) { need[me] = (need[me] || 0) + 1; continue; }
      c.ext_wait[x.deal_id] = true;
      if (me === d.provider_org_id) c.deals_provider++; else c.deals_customer++;
    }
    c.other_orgs = need;
  } catch {}
  await Promise.all([feedCounter(), crmCounter(), adminCounters()]);
}

// Просмотренные заказы ленты — отдельно для каждой организации (в этом браузере)
const seenKey = () => 'ruin.seenOrders:' + state.org?.id;
export function seenOrders() {
  try { return new Set(JSON.parse(localStorage.getItem(seenKey()) || '[]')); } catch { return new Set(); }
}
export function markOrderSeen(id) {
  const s = seenOrders(); s.add(id);
  try { localStorage.setItem(seenKey(), JSON.stringify([...s].slice(-500))); } catch {}
}

// «Лента заказов»: новые открытые заказы под мою технику (или личные запросы мне), которые я ещё не открывал и не ответил
async function feedCounter() {
  const o = state.org, c = state.counters;
  c.feed_new = 0;
  if (!o?.can_provide || o.verification_status !== 'VERIFIED') return;
  try {
    const [eq, orders] = await Promise.all([
      q(sb.from('equipment').select('category_id').eq('org_id', o.id).eq('status', 'PUBLISHED')),
      q(sb.from('orders').select('id,category_id,visibility,invited_org_id').in('status', ['PUBLISHED', 'OFFERS_RECEIVED'])
        .gt('deadline_at', new Date().toISOString()).neq('customer_org_id', o.id).limit(300))
    ]);
    const cats = new Set(eq.map((e) => e.category_id));
    const fit = orders.filter((x) => (x.visibility === 'DIRECT' ? x.invited_org_id === o.id : cats.has(x.category_id)));
    if (!fit.length) return;
    const offered = new Set((await q(sb.from('offers').select('order_id').eq('provider_org_id', o.id).in('order_id', fit.map((x) => x.id)))).map((x) => x.order_id));
    const seen = seenOrders();
    c.feed_new = fit.filter((x) => !offered.has(x.id) && !seen.has(x.id)).length;
    c.feed_new_ids = fit.filter((x) => !offered.has(x.id) && !seen.has(x.id)).map((x) => x.id);
  } catch {}
}

// «Рабочий стол»: напоминания, срок которых наступил (таблица появляется после 07_crm.sql)
async function crmCounter() {
  const c = state.counters;
  c.crm_due = 0;
  if (!state.org) return;
  try {
    const { count, error } = await sb.from('deal_notes').select('id', { count: 'exact', head: true })
      .eq('org_id', state.org.id).eq('done', false).not('remind_on', 'is', null).lte('remind_on', mskDate(0));
    if (!error) c.crm_due = count || 0;
  } catch {}
}

// Очереди админки: что ждёт решения администратора
async function adminCounters() {
  const c = state.counters;
  c.admin = null;
  if (!isAdmin()) return;
  const n = async (b) => { const { count, error } = await b; return error ? 0 : count || 0; };
  const head = { count: 'exact', head: true };
  try {
    const [orgs, equipment, disputes, reports] = await Promise.all([
      n(sb.from('organizations').select('id', head).eq('verification_status', 'PENDING_REVIEW')),
      n(sb.from('equipment').select('id', head).eq('status', 'PENDING_MODERATION')),
      n(sb.from('disputes').select('id', head).in('status', ['OPEN', 'IN_REVIEW'])),
      n(sb.from('listing_reports').select('id', head).eq('status', 'NEW'))
    ]);
    c.admin = { orgs, equipment, disputes, reports, total: orgs + equipment + disputes + reports };
  } catch {}
}

// Дата по Москве в формате ГГГГ-ММ-ДД со сдвигом в днях
export function mskDate(add = 0) {
  return new Date(Date.now() + add * 864e5).toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' });
}

export const isAdmin = () => !!state.profile?.is_platform_admin;
export const canManage = (org = state.org) => org && ['OWNER', 'ADMIN', 'MANAGER'].includes(org.role);
export const isOwnerAdmin = (org = state.org) => org && ['OWNER', 'ADMIN'].includes(org.role);

// Загрузка фото техники в Storage: папка = id организации (политика photos_insert)
export async function uploadPhoto(orgId, file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Можно JPEG, PNG или WebP');
  if (file.size > 10 * 1024 * 1024) throw new Error('Файл больше 10 МБ');
  const blob = await shrinkImage(file);
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${orgId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from('equipment-photos').upload(path, blob, { contentType: blob.type, upsert: false });
  if (error) throw new Error(humanError(error));
  return sb.storage.from('equipment-photos').getPublicUrl(path).data.publicUrl;
}

// Уменьшаем фото до 1600 px и пересохраняем через canvas — заодно удаляются EXIF и геометки (D8)
async function shrinkImage(file) {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return await new Promise((res) => c.toBlob((b) => res(b), 'image/jpeg', 0.85));
}
