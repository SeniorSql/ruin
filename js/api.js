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
  try {
    const [prov, cust] = await Promise.all([
      sb.from('deals').select('id', { count: 'exact', head: true }).eq('provider_org_id', state.org.id).eq('status', 'AWAITING_CONFIRMATION'),
      sb.from('deals').select('id', { count: 'exact', head: true }).eq('customer_org_id', state.org.id).eq('status', 'COMPLETION_PENDING')
    ]);
    state.counters.deals_provider = prov.count || 0;
    state.counters.deals_customer = cust.count || 0;
  } catch {}
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
