// Блок «Договор и путевые листы» в сделке (11.11.2026):
// — «Скачать форму договора»: шаблон Этибара files/contract-template.docx, в метки {{…}} подставляются известные данные сделки,
//   остальное печатается линиями как в шаблоне (оформление, логотип и шрифты не меняются);
// — «Скачать форму путевого листа»: files/esm-forms.zip (ЭСМ-2, ЭСМ-3, ЭСМ-7 с логотипом RUIN);
// — загрузка подписанных файлов в закрытое хранилище deal-files (SQL 27): видят обе стороны, удаляет тот, кто загрузил.
import { sb, state, q, rpc } from './api.js';
import { esc, money, plural, offerParts, toast, busy, dateTime } from './ui.js';

const KINDS = { CONTRACT: 'contract', WAYBILL: 'waybill' };
const MAX = 20 * 1024 * 1024;
const TYPES = { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', zip: 'application/zip' };
const ACCEPT = Object.keys(TYPES).map((x) => '.' + x).join(',');
const UNIT_TXT = { HOUR: 'час', SHIFT: 'смену', DAY: 'сутки' };
const kb = (n) => n >= 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' МБ' : Math.max(1, Math.round(n / 1024)) + ' КБ';

// ---------- Панель ----------
export function docFilesPanel(d, files, act) {
  const list = (kind) => {
    const xs = files.filter((f) => f.kind === kind);
    if (!xs.length) return '<p class="small muted" style="margin:6px 0">Файлов пока нет.</p>';
    return `<ul class="df-list">${xs.map((f) => `<li>
      <button type="button" class="linkbtn" data-dfget="${f.id}" title="Скачать">${esc(f.name)}</button>
      <span class="small muted">${kb(f.size)} · ${f.org_id === d.customer_org_id ? 'заказчик' : 'исполнитель'} · ${dateTime(f.created_at)}</span>
      ${act && f.uploaded_by === state.user?.id ? `<button type="button" class="btn ghost sm" data-dfdel="${f.id}">Удалить</button>` : ''}</li>`).join('')}</ul>`;
  };
  const box = (kind, title, hint, dl) => `<div class="df-box"><h3>${title}</h3><p class="small muted">${hint}</p>
      <div class="actions">${dl}${act ? `<button type="button" class="btn sm" data-dfup="${kind}">Загрузить файл</button>` : ''}</div>
      ${list(kind)}</div>`;
  return `<div class="df-grid">
    ${box('CONTRACT', 'Договор', 'Скачайте форму — данные сделки уже подставлены. Подпишите и загрузите скан или файл: его увидит другая сторона.',
      '<button type="button" class="btn ghost sm" data-dfcontract>Скачать форму договора</button>')}
    ${box('WAYBILL', 'Путевые листы', 'Бланки ЭСМ-2, ЭСМ-3 и ЭСМ-7 (Excel). Заполните и загрузите сюда.',
      '<a class="btn ghost sm" href="files/esm-forms.zip" download="ЭСМ (RUIN).zip">Скачать форму путевого листа</a>')}
  </div>
  <input type="file" id="dfInput" accept="${ACCEPT}" multiple style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none" tabindex="-1">
  <p class="small muted" style="margin-top:8px">PDF, Word, Excel, фото или zip, до 20 МБ. Файлы видят только участники сделки.</p>`;
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
  const cb = box.querySelector('[data-dfcontract]');
  if (cb) cb.onclick = () => busy(cb, async () => {
    try { const blob = await contractDocx(d.id); save(blob, `Договор RUIN № ${(d.number || '').replace(/[\\/:*?"<>|]/g, '-')}.docx`); }
    catch (e) { toast('Не удалось сформировать договор: ' + (e.message || e), true); }
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

// ---------- Договор: данные сделки → метки шаблона ----------
async function contractDocx(id) {
  const d = await q(sb.from('deals').select('*, equipment(id,title,brand,model,year,city,price_unit,price_minor,shift_hours), cust:organizations!deals_customer_org_id_fkey(id,name,type,inn,ogrn,city), prov:organizations!deals_provider_org_id_fkey(id,name,type,inn,ogrn,city)').eq('id', id).maybeSingle());
  if (!d) throw new Error('сделка не найдена');
  const [priv, fc, tpl] = await Promise.all([
    rpc('get_deal_private', { p_deal: id }).catch(() => null),
    sb.from('fleet_cards').select('reg_number').eq('equipment_id', d.equipment_id).maybeSingle().then((r) => r.data, () => null),
    fetch('files/contract-template.docx', { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error('шаблон не найден'); return r.arrayBuffer(); })
  ]);
  return fillDocx(new Uint8Array(tpl), contractValues(d, priv, fc?.reg_number || ''));
}

export function contractValues(d, priv, reg) {
  const e = d.equipment || {};
  const side = (o = {}, c) => {
    const solo = ['PERSON', 'SELF_EMPLOYED', 'SOLE_PROP'].includes(o.type);
    return {
      name: o.name || '', person: '', basis: o.type === 'SOLE_PROP' && o.ogrn ? `записи в ЕГРИП (ОГРНИП ${o.ogrn})` : '',
      addr: o.city ? `г. ${o.city}` : '', innkpp: o.inn ? (o.type === 'LEGAL' ? `${o.inn} / _________` : o.inn) : '',
      ogrn: o.ogrn || '', contact: [c?.phone, c?.email].filter(Boolean).join(', '),
      sign: c?.contact_person || (solo ? o.name || '' : '')
    };
  };
  const c = side(d.cust, priv?.customer), p = side(d.prov, priv?.provider);
  const del = offerParts(d).mode;
  const dd = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('.') : '');
  const days = d.start_date && d.end_date ? Math.round((new Date(d.end_date) - new Date(d.start_date)) / 864e5) + 1 : 0;
  const v = {
    num: d.number || '', city: e.city || d.cust?.city || '',
    supply: d.start_date ? `${dd(d.start_date)}, время: ________` : '',
    task: d.customer_comment || '',
    dP: del === 'INCLUDED' ? '☒' : '', dC: del === 'PAID' ? '☒' : '',
    a1: '1',
    a2: `${e.title || ''}${e.brand ? ` (${e.brand} ${e.model || ''}${e.year ? ', ' + e.year + ' г.' : ''})` : ''}`.trim(),
    a3: reg, a4: priv?.address || '',
    a5: e.price_minor && UNIT_TXT[e.price_unit] ? `${money(e.price_minor)} за ${UNIT_TXT[e.price_unit]}; итого ${money(d.total_minor)}` : (d.total_minor ? `итого ${money(d.total_minor)}` : ''),
    a6: e.shift_hours ? `${e.shift_hours} ч` : '',
    a7: d.start_date ? `${dd(d.start_date)} – ${dd(d.end_date)} (${days} ${plural(days, 'день', 'дня', 'дней')}); ${d.with_operator ? 'с экипажем Исполнителя' : 'без экипажа'}` : ''
  };
  for (const k in c) { v['c.' + k] = c[k]; v['p.' + k] = p[k]; }
  return v;
}

const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// {{ключ|как в шаблоне}} — в тексте; {{ключ+|…}} — то же, но с добивкой пробелов (строка «г. … дата»); {{R:ключ}} — пустая ячейка таблицы
export function fillXml(xml, v) {
  return xml
    .replace(/\{\{R:([\w.]+)\}\}/g, (_, k) => (v[k] ? `<w:t xml:space="preserve">${xmlEsc(v[k])}</w:t>` : '<w:br/>'))
    .replace(/\{\{([\w.]+)(\+?)\|([^}]*)\}\}/g, (_, k, pad, def) => {
      const s = (v[k] ?? '').toString().trim();
      if (!s) return def;
      // подчёркивание шире буквы примерно на 10 %, пробел — вдвое уже: сохраняем положение даты справа
      return xmlEsc(s) + (pad ? ' '.repeat(Math.max(1, Math.round((def.length * 0.5 - s.length * 0.47) / 0.25))) : '');
    });
}

// ---------- Минимальная работа с zip (чтение stored/deflate, запись без пересжатия остальных частей) ----------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (u8) => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };

function readZip(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('повреждён шаблон');
  const count = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true);
  const out = [];
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('повреждён шаблон');
    const method = dv.getUint16(p + 10, true), time = dv.getUint16(p + 12, true), day = dv.getUint16(p + 14, true);
    const crc = dv.getUint32(p + 16, true), csize = dv.getUint32(p + 20, true), size = dv.getUint32(p + 24, true);
    const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const nameB = u8.slice(p + 46, p + 46 + nl);
    const lnl = dv.getUint16(off + 26, true), lxl = dv.getUint16(off + 28, true), start = off + 30 + lnl + lxl;
    out.push({ nameB, name: new TextDecoder().decode(nameB), method, time, day, crc, csize, size, raw: u8.slice(start, start + csize) });
    p += 46 + nl + xl + cl;
  }
  return out;
}

async function inflate(e) {
  if (e.method === 0) return e.raw;
  if (e.method !== 8 || typeof DecompressionStream === 'undefined') throw new Error('браузер не поддерживает распаковку — обновите браузер');
  const s = new Blob([e.raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

function writeZip(entries) {
  const parts = [], central = []; let off = 0;
  for (const e of entries) {
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, e.method, true);
    h.setUint16(10, e.time, true); h.setUint16(12, e.day, true);
    h.setUint32(14, e.crc, true); h.setUint32(18, e.raw.length, true); h.setUint32(22, e.size, true); h.setUint16(26, e.nameB.length, true);
    parts.push(new Uint8Array(h.buffer), e.nameB, e.raw);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, e.method, true);
    c.setUint16(12, e.time, true); c.setUint16(14, e.day, true);
    c.setUint32(16, e.crc, true); c.setUint32(20, e.raw.length, true); c.setUint32(24, e.size, true); c.setUint16(28, e.nameB.length, true);
    c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), e.nameB);
    off += 30 + e.nameB.length + e.raw.length;
  }
  const cs = central.reduce((s, x) => s + x.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
  end.setUint32(12, cs, true); end.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

export async function fillDocx(u8, values) {
  const entries = readZip(u8);
  const doc = entries.find((e) => e.name === 'word/document.xml');
  if (!doc) throw new Error('повреждён шаблон');
  const xml = fillXml(new TextDecoder().decode(await inflate(doc)), values);
  const data = new TextEncoder().encode(xml);
  Object.assign(doc, { method: 0, raw: data, size: data.length, crc: crc32(data) });
  return writeZip(entries);
}
