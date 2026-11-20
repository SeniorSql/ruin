// Маскировка контактов на фото техники (20.11.2026, просьба Этибара): телефоны, сайты и названия организаций
// закрываются плашкой «RUIN». Автоматически — сразу после загрузки (служба на нашем сервере, /opt/ruin-photo/photo_mask.py),
// вручную — кнопкой «Закрыть надпись»: выделить область пальцем или мышью. Исходник сервер хранит в закрытой папке.
import { sb } from './api.js';
import { modal, toast, busy, esc } from './ui.js';

const cfg = window.RUIN_CONFIG || {};
const API = String(cfg.SUPABASE_URL || '').replace(/\/$/, '');

// Путь файла в хранилище по публичной ссылке на фото
export const photoPath = (url) => {
  const m = String(url || '').match(/\/object\/public\/equipment-photos\/([^?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
};

async function call(route, body) {
  const { data } = await sb.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('Войдите в аккаунт');
  const r = await fetch(`${API}/photo-mask/${route}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Не удалось обработать фото');
  return j;
}

// Автопроверка: { masked: число закрытых надписей, kinds: [...], url: новая ссылка или null }
export function autoMask(url) {
  const path = photoPath(url);
  return path ? call('auto', { path }) : Promise.resolve({ masked: 0, kinds: [] });
}

// Ручное закрытие: открывает окно с фото, пользователь выделяет одну или несколько областей. Возвращает новую ссылку или null.
export function manualMask(url) {
  const path = photoPath(url);
  if (!path) { toast('Это фото нельзя изменить', true); return Promise.resolve(null); }
  return new Promise((resolve) => {
    let done = null;
    const m = modal(`<h2>Закрыть надпись</h2>
      <p class="muted small" style="margin-top:-6px">Проведите пальцем или мышью по телефону, сайту или названию компании — область закроется плашкой «RUIN». Можно выделить несколько.</p>
      <div class="pm-wrap"><div class="pm-box"><img class="pm-img" alt="" referrerpolicy="no-referrer" src="${esc(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now())}"><div class="pm-layer" aria-label="Область для выделения"></div></div></div>
      <div class="actions" style="margin-top:12px"><button type="button" class="btn" id="pmGo" disabled>Закрыть выделенное</button>
        <button type="button" class="btn ghost" id="pmUndo" disabled>Отменить последнее</button></div>`, { onClose: () => resolve(done) });
    const layer = m.el.querySelector('.pm-layer');
    const go = m.el.querySelector('#pmGo'), undo = m.el.querySelector('#pmUndo');
    const rects = [];
    let start = null, cur = null;
    const pos = (e) => { const r = layer.getBoundingClientRect(); return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))]; };
    const draw = () => {
      layer.innerHTML = rects.map(([x, y, w, h]) => `<div class="pm-rect" style="left:${x * 100}%;top:${y * 100}%;width:${w * 100}%;height:${h * 100}%"><span>RUIN</span></div>`).join('');
      go.disabled = undo.disabled = !rects.length;
    };
    layer.addEventListener('pointerdown', (e) => {
      e.preventDefault(); layer.setPointerCapture(e.pointerId);
      start = pos(e);
      cur = document.createElement('div'); cur.className = 'pm-rect pm-new'; layer.appendChild(cur);
    });
    layer.addEventListener('pointermove', (e) => {
      if (!start || !cur) return;
      const [x, y] = pos(e);
      const l = Math.min(x, start[0]), t = Math.min(y, start[1]);
      Object.assign(cur.style, { left: l * 100 + '%', top: t * 100 + '%', width: Math.abs(x - start[0]) * 100 + '%', height: Math.abs(y - start[1]) * 100 + '%' });
    });
    const end = (e) => {
      if (!start) return;
      const [x, y] = pos(e);
      const r = [Math.min(x, start[0]), Math.min(y, start[1]), Math.abs(x - start[0]), Math.abs(y - start[1])];
      start = null; cur = null;
      if (r[2] > 0.01 && r[3] > 0.01) rects.push(r);
      draw();
    };
    layer.addEventListener('pointerup', end);
    layer.addEventListener('pointercancel', () => { start = null; cur = null; draw(); });
    undo.onclick = () => { rects.pop(); draw(); };
    go.onclick = () => busy(go, async () => {
      try {
        const r = await call('manual', { path, rects });
        done = r.url; toast('Готово: надпись закрыта плашкой RUIN'); m.close();
      } catch (err) { toast(err.message, true); }
    });
  });
}
