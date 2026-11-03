// Черновики форм: всё введённое сохраняется в браузере и возвращается после обновления страницы.
// Черновик стирается, когда форма успешно отправлена (поля очистились или форма закрылась/сменилась страница).

const PREFIX = 'ruin.draft:';
const SKIP_FORMS = '.filters, .search, .hero-search, #topSearch, [data-nodraft]';
const SKIP_TYPES = new Set(['password', 'file', 'hidden', 'submit', 'button']);
const TTL = 7 * 864e5;

const store = {
  get(k) { try { const v = JSON.parse(localStorage.getItem(PREFIX + k)); return v && Date.now() - v.t < TTL ? v.f : null; } catch { return null; } },
  set(k, f) { try { localStorage.setItem(PREFIX + k, JSON.stringify({ t: Date.now(), f })); } catch {} },
  del(k) { try { localStorage.removeItem(PREFIX + k); } catch {} }
};

const fieldKey = (el) => el.name || el.dataset.spec || el.id || '';
const fields = (form) => [...form.querySelectorAll('input, textarea, select')]
  .filter((el) => fieldKey(el) && !SKIP_TYPES.has(el.type) && !el.disabled);

function formKey(form) {
  const path = location.hash.split('?')[0] || '#/';
  const modalTitle = form.closest('.modal')?.querySelector('h2')?.textContent || '';
  const forms = [...document.querySelectorAll('form')];
  return `${path}|${modalTitle}|${form.id || forms.indexOf(form)}`;
}

function snapshot(form) {
  const data = {};
  let hasText = false;
  for (const el of fields(form)) {
    const v = el.type === 'checkbox' || el.type === 'radio' ? el.checked : el.value;
    data[fieldKey(el) + (el.type === 'radio' ? ':' + el.value : '')] = v;
    if (el.tagName === 'TEXTAREA' && String(v).trim()) hasText = true;
    if (el.tagName === 'INPUT' && el.type !== 'checkbox' && el.type !== 'radio' && el.type !== 'date' && String(v).trim() && el.dataset.touched) hasText = true;
  }
  return { data, hasText };
}

function save(form) {
  const { data, hasText } = snapshot(form);
  if (hasText) store.set(form.__draftKey, data); else store.del(form.__draftKey);
}

function restore(form) {
  const saved = store.get(form.__draftKey);
  if (!saved) return false;
  let changed = false;
  for (const el of fields(form)) {
    const k = fieldKey(el) + (el.type === 'radio' ? ':' + el.value : '');
    if (!(k in saved)) continue;
    if (el.type === 'checkbox' || el.type === 'radio') {
      if (el.checked !== saved[k]) { el.checked = saved[k]; changed = true; }
    } else if (el.value !== saved[k] && (el.tagName !== 'SELECT' || [...el.options].some((o) => o.value === saved[k]))) {
      el.value = saved[k]; el.dataset.touched = '1'; changed = true;
    } else continue;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  return changed;
}

// Ключи форм, отправленных только что: если страница перерисовалась после успешной отправки,
// новая форма не должна заполняться старым черновиком
const justSubmitted = new Map();

function attach(form) {
  if (form.__draftKey || form.matches(SKIP_FORMS)) return;
  form.__draftKey = formKey(form);
  const sentAt = justSubmitted.get(form.__draftKey);
  if (sentAt && Date.now() - sentAt < 10000) {
    store.del(form.__draftKey);
    justSubmitted.delete(form.__draftKey);
  } else if (restore(form)) {
    const note = document.createElement('div');
    note.className = 'banner info small draft-note';
    note.innerHTML = `Восстановлен несохранённый черновик. <button type="button" class="link">Сбросить</button>`;
    note.querySelector('button').onclick = () => { store.del(form.__draftKey); note.remove(); location.reload(); };
    form.prepend(note);
  }
  let timer;
  const onEdit = (e) => {
    if (e.target?.dataset) e.target.dataset.touched = '1';
    clearTimeout(timer); timer = setTimeout(() => save(form), 300);
  };
  form.addEventListener('input', onEdit);
  form.addEventListener('change', onEdit);
  // После отправки: если форма закрылась или очистилась — черновик больше не нужен
  form.addEventListener('submit', () => {
    const key = form.__draftKey;
    justSubmitted.set(key, Date.now());
    // Ждём до 10 секунд результата: форма закрылась/перерисовалась или очистилась — черновик удаляем;
    // осталась заполненной (ошибка) — черновик сохраняем
    let n = 0;
    const check = setInterval(() => {
      n++;
      if (!form.isConnected || !snapshot(form).hasText) { clearInterval(check); store.del(key); return; }
      if (n >= 20) { clearInterval(check); justSubmitted.delete(key); form.querySelector('.draft-note')?.remove(); save(form); }
    }, 500);
  });
}

export function initDrafts() {
  const scan = () => document.querySelectorAll('#app form, .modal form').forEach(attach);
  new MutationObserver(() => scan()).observe(document.body, { childList: true, subtree: true });
  scan();
}
