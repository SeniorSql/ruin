// Блок «Документы» в сделке (11.11.2026, v=73): три одинаковые карточки по сетке —
// «Заявка-подтверждение» (+ акт выполненных работ), «Договор», «Путевые листы».
// — «Скачать форму договора»: файл Этибара files/contract-template.docx без изменений (данные не подставляются);
// — «Скачать форму путевого листа»: files/esm-forms.zip (ЭСМ-2, ЭСМ-3, ЭСМ-7 с логотипом RUIN);
// — загрузка подписанных файлов в закрытое хранилище deal-files (SQL 27): видят обе стороны, удаляет тот, кто загрузил.
import { sb, state, q } from './api.js';
import { esc, toast, busy, dateTime } from './ui.js';

const KINDS = { CONTRACT: 'contract', WAYBILL: 'waybill' };
const MAX = 20 * 1024 * 1024;
const TYPES = { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', zip: 'application/zip' };
const ACCEPT = Object.keys(TYPES).map((x) => '.' + x).join(',');
const kb = (n) => n >= 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' МБ' : Math.max(1, Math.round(n / 1024)) + ' КБ';
const SVG = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const I_DOWN = SVG('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>');
const I_UP = SVG('<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>');
const I_OPEN = SVG('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>');
const I_DOC = SVG('<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>');
const I_SIGN = SVG('<path d="M4 20h16M6 16l9-9 3 3-9 9H6z"/>');
const I_ROUTE = SVG('<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7"/>');

// ---------- Панель ----------
// withFiles = false — сделка ещё не подтверждена или отменена (и файлов нет): показываем только заявку
export function docFilesPanel(d, files, act, withFiles = true) {
  const list = (kind) => {
    const xs = files.filter((f) => f.kind === kind);
    if (!xs.length) return '<p class="small muted df-empty">Загруженных файлов пока нет.</p>';
    return `<ul class="df-list">${xs.map((f) => `<li>
      <button type="button" class="linkbtn" data-dfget="${f.id}" title="Скачать">${esc(f.name)}</button>
      <span class="small muted">${kb(f.size)} · ${f.org_id === d.customer_org_id ? 'заказчик' : 'исполнитель'} · ${dateTime(f.created_at)}</span>
      ${act && f.uploaded_by === state.user?.id ? `<button type="button" class="btn ghost sm" data-dfdel="${f.id}">Удалить</button>` : ''}</li>`).join('')}</ul>`;
  };
  // Карточка: шапка (значок, название, пояснение) → кнопки → список. Строки карточек выровнены сеткой (subgrid).
  const card = (ic, title, hint, buttons, bottom) => `<div class="df-box">
      <div class="df-head"><span class="df-ic">${ic}</span><div><h3>${title}</h3><p class="small muted">${hint}</p></div></div>
      <div class="df-btns">${buttons}</div>
      <div class="df-bottom">${bottom}</div></div>`;
  const up = (kind) => (act ? `<button type="button" class="btn ghost" data-dfup="${kind}">${I_UP}Загрузить файл</button>` : '');
  const request = card(I_DOC, 'Заявка-подтверждение', 'Формируется из данных сделки и откроется в новой вкладке. Сохранить в PDF — «Печать → Сохранить как PDF».',
    `<a class="btn" target="_blank" href="#/deals/${d.id}/doc/request">${I_OPEN}Открыть заявку</a>
     ${d.status === 'COMPLETED' ? `<a class="btn ghost" target="_blank" href="#/deals/${d.id}/doc/act">${I_OPEN}Акт выполненных работ</a>` : ''}`, '');
  if (!withFiles) return `<div class="df-grid">${request}</div>`;
  return `<div class="df-grid">
    ${request}
    ${card(I_SIGN, 'Договор', 'Скачайте форму, заполните и подпишите. Загрузите скан или файл — его увидит другая сторона.',
      `<a class="btn" href="files/contract-template.docx" download="Форма договора RUIN.docx">${I_DOWN}Скачать форму договора</a>${up('CONTRACT')}`, list('CONTRACT'))}
    ${card(I_ROUTE, 'Путевые листы', 'Бланки ЭСМ-2, ЭСМ-3 и ЭСМ-7 (Excel) в одном архиве. Заполните и загрузите сюда.',
      `<a class="btn" href="files/esm-forms.zip" download="ЭСМ (RUIN).zip">${I_DOWN}Скачать форму путевого листа</a>${up('WAYBILL')}`, list('WAYBILL'))}
  </div>
  <input type="file" id="dfInput" accept="${ACCEPT}" multiple style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none" tabindex="-1">
  <p class="small muted" style="margin:10px 0 0">Загрузить можно PDF, Word, Excel, фото или zip, до 20 МБ. Файлы видят только участники сделки.</p>`;
}

export function bindDocFiles(box, d, files, reload) {
  const inp = box.querySelector('#dfInput');
  let kind = null;
  box.querySelectorAll('[data-dfup]').forEach((b) => b.onclick = () => { kind = b.dataset.dfup; inp.value = ''; inp.click(); });
  if (inp) inp.onchange = async () => {
    const list = [...inp.files]; if (!list.length || !kind) return;
    const btn = box.querySelector(`[data-dfup="${kind}"]`);
    await busy(btn, async () => {
      let ok = 0;
      for (const f of list) {
        try { await upload(d, kind, f); ok++; } catch (e) { toast(`${f.name}: ${e.message}`, true); }
      }
      if (ok) { toast(ok === 1 ? 'Файл загружен' : `Загружено файлов: ${ok}`); reload(); }
    });
  };
  box.querySelectorAll('[data-dfget]').forEach((b) => b.onclick = () => busy(b, async () => {
    const f = files.find((x) => x.id === b.dataset.dfget); if (!f) return;
    try {
      const { data, error } = await sb.storage.from('deal-files').download(f.path);
      if (error) throw error;
      save(data, f.name);
    } catch (e) { toast('Не удалось скачать: ' + (e.message || e), true); }
  }));
  box.querySelectorAll('[data-dfdel]').forEach((b) => b.onclick = () => {
    const f = files.find((x) => x.id === b.dataset.dfdel); if (!f) return;
    if (!confirm(`Удалить файл «${f.name}»? Другая сторона его больше не увидит.`)) return;
    busy(b, async () => {
      try {
        await q(sb.from('deal_files').delete().eq('id', f.id));
        await sb.storage.from('deal-files').remove([f.path]);
        toast('Файл удалён'); reload();
      } catch (e) { toast(e.message, true); }
    });
  });
}

async function upload(d, kind, f) {
  const ext = (f.name.split('.').pop() || '').toLowerCase();
  if (!TYPES[ext]) throw new Error('такой тип файла не поддерживается');
  if (f.size > MAX) throw new Error('файл больше 20 МБ');
  if (!f.size) throw new Error('файл пустой');
  const org = state.org.id === d.customer_org_id || state.org.id === d.provider_org_id ? state.org.id : null;
  if (!org) throw new Error('нет доступа к сделке');
  const path = `${d.id}/${KINDS[kind]}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from('deal-files').upload(path, f, { contentType: TYPES[ext], upsert: false });
  if (error) throw error;
  try {
    await q(sb.from('deal_files').insert({ deal_id: d.id, kind, path, name: f.name.slice(0, 200), size: f.size, org_id: org }));
  } catch (e) { await sb.storage.from('deal-files').remove([path]); throw e; }
}

function save(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}

