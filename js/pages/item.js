// Карточка техники: галерея, характеристики, календарь, калькулятор, бронь (SCR-CAT-03, раздел H)
import { sb, state, q, rpc, canManage } from '../api.js';
import { esc, money, priceText, photoOf, initials, specValue, SPEC_LABELS, POLICY, UNIT, status, modal, toast, busy,
  mskToday, date, idemKey, plural, errorState } from '../ui.js';
import { EQ_SELECT, productCard, loadFavs, bindFavs } from '../cards.js';
import { go } from '../app.js';

const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

export async function render(app, { id }) {
  let e;
  try { e = await q(sb.from('equipment').select(EQ_SELECT).eq('id', id).maybeSingle()); }
  catch (err) { app.innerHTML = errorState(err); return; }
  if (!e) {
    app.innerHTML = `<div class="panel empty"><b>Карточка не найдена</b>Возможно, техника снята с публикации.<div><a class="btn" href="#/catalog">В каталог</a></div></div>`;
    return;
  }
  const org = e.organizations || {};
  const mine = state.orgs.some((o) => o.id === e.org_id);
  const photos = (e.photos || []).map((p) => (typeof p === 'string' ? { url: p } : p));
  const [stats, favs, rating] = await Promise.all([rpc('public_org_stats', { p_org: e.org_id }).catch(() => ({})), loadFavs(),
    rpc('org_rating', { p_org: e.org_id, p_role: 'PROVIDER' }).catch(() => ({}))]);
  const stale = Date.now() - new Date(e.availability_confirmed_at) > 7 * 864e5;
  const negotiable = e.price_unit === 'NEGOTIABLE' || e.price_minor == null || e.delivery_minor == null;
  document.title = `${e.title} — аренда, ${e.city} | RUIN`;

  app.innerHTML = `
    <div class="crumbs"><a href="#/">RUIN</a> › <a href="#/catalog">Каталог</a> › <a href="#/catalog?cat=${e.categories?.code}">${esc(e.categories?.name)}</a> › <b>${esc(e.title)}</b></div>
    ${e.is_demo ? `<div class="banner warn"><b>Пример карточки.</b>&nbsp;Так будет выглядеть реальное предложение. Забронировать или написать по ней нельзя.</div>` : ''}
    ${mine && e.status !== 'PUBLISHED' ? `<div class="banner info">Это ваша техника, статус: ${status('equipment', e.status)}. Покупатели её пока не видят. <a href="#/fleet/${e.id}">Редактировать</a></div>` : ''}
    <div class="cols">
      <div>
        <div class="gallery">${photos[0] ? `<img class="main-img" id="mainImg" src="${esc(photos[0].url)}" alt="${esc(e.title)}" referrerpolicy="no-referrer">` : '<div class="main-img" style="aspect-ratio:16/10"></div>'}
          <span class="credit" id="credit"></span></div>
        ${photos.length > 1 ? `<div class="thumbs">${photos.map((p, i) => `<button data-i="${i}" class="${i ? '' : 'on'}" aria-label="Фото ${i + 1}"><img src="${esc(p.url)}" alt="" loading="lazy" referrerpolicy="no-referrer"></button>`).join('')}</div>` : ''}

        <div class="panel" style="margin-top:14px">
          <span class="muted small">${esc(e.categories?.name)} · ${esc(e.brand)} ${esc(e.model)}${e.year ? ' · ' + e.year + ' г.' : ''}</span>
          <h1 style="font-size:28px;margin:4px 0 6px">${esc(e.title)}</h1>
          <div class="muted">${esc(e.city)}${e.district ? ', ' + esc(e.district) : ''} · выезд до ${e.service_radius_km} км</div>
          <div class="actions" style="margin-top:12px">
            ${state.user ? `<button class="btn ghost sm" id="favBtn">${favs.has(e.id) ? '♥ В избранном' : '♡ В избранное'}</button>` : ''}
            <button class="btn ghost sm" id="shareBtn">Скопировать ссылку</button>
            ${state.user && !mine ? '<button class="btn ghost sm" id="reportBtn">Пожаловаться</button>' : ''}
          </div>
        </div>

        <div class="panel"><h2>Характеристики</h2>
          <table class="spec-table">
            <tr><td>Марка и модель</td><td>${esc(e.brand)} ${esc(e.model)}</td></tr>
            ${e.year ? `<tr><td>Год выпуска</td><td>${e.year}</td></tr>` : ''}
            ${Object.entries(e.specs || {}).map(([k, v]) => `<tr><td>${esc((SPEC_LABELS[k] || [k])[0])}</td><td>${esc(specValue(k, v))}</td></tr>`).join('')}
          </table>
          ${e.description ? `<h3 style="margin-top:18px">Описание</h3><p style="white-space:pre-wrap;margin:0">${esc(e.description)}</p>` : ''}
        </div>

        <div class="panel"><h2>Условия аренды</h2>
          <dl class="kv">
            <dt>Формат</dt><dd>${[e.with_operator && 'с оператором', e.without_operator && 'без оператора'].filter(Boolean).join(', ')}</dd>
            <dt>Минимальный заказ</dt><dd>${e.min_units} ${UNIT[e.price_unit] || ''}${e.price_unit === 'SHIFT' ? ` (смена ${e.shift_hours} ч)` : ''}</dd>
            ${e.operator_minor ? `<dt>Оператор</dt><dd>+${money(e.operator_minor)} за ${UNIT[e.price_unit]}</dd>` : ''}
            <dt>Доставка</dt><dd>${e.delivery_minor == null ? 'по запросу' : e.delivery_minor ? money(e.delivery_minor) + ' (подача и возврат)' : 'включена'}</dd>
            <dt>Залог</dt><dd>${e.deposit_minor ? money(e.deposit_minor) + ' — возвращается после возврата техники' : 'без залога'}</dd>
            <dt>Отмена</dt><dd>${esc(POLICY[e.cancel_policy])}</dd>
            <dt>Оплата</dt><dd>напрямую исполнителю по договорённости (платформа не принимает деньги)</dd>
          </dl>
        </div>

        <div class="panel"><h2>Календарь занятости</h2>
          ${stale && !e.is_demo ? '<div class="banner warn">Исполнитель давно не обновлял календарь — доступность уточняется.</div>' : ''}
          <div class="cal-wrap" id="cal"><div class="skeleton" style="height:200px"></div></div>
          <div class="legend"><span><i style="background:#f2f6f1"></i>свободно</span><span><i style="background:#f3d9d9"></i>занято</span><span><i style="background:var(--yellow)"></i>ваш выбор</span></div>
        </div>

        <div class="panel"><h2>Исполнитель</h2>
          <div class="provider-box"><span class="sa">${esc(initials(org.name))}</span>
            <div><b>${e.is_demo ? esc(org.name) : `<a href="#/company/${org.id}">${esc(org.name)}</a>`}</b><div class="small">${status('org', org.verification_status)}
              <span class="muted"> · завершено сделок: ${stats.completed ?? 0} · на RUIN с ${date(stats.since)}</span></div>
              <div class="small" style="margin-top:4px">${rating?.rating ? `<span class="rating">★ ${rating.rating}</span> <span class="muted">· ${rating.n} отзывов</span>` : rating?.n ? '<span class="muted">Мало оценок для рейтинга</span>' : '<span class="muted">Нет оценок — новичок на платформе</span>'}</div></div></div>
          <p class="small muted" style="margin:12px 0 0">Контакты исполнителя откроются после подтверждения сделки.${e.is_demo ? '' : ` <a href="#/company/${org.id}">Все предложения и отзывы компании →</a>`}</p>
        </div>
      </div>

      <aside class="sticky">
        <div class="panel">
          <div class="price-big num">${priceText(e)}</div>
          <div class="muted small">${negotiable ? 'Стоимость рассчитает исполнитель по вашему запросу' : 'Предварительный расчёт — по выбранным датам'}</div>
          <div class="divider"></div>
          <form id="calc">
            <div class="grid2">
              <label class="f"><span>Начало</span><input class="inp" type="date" name="start" min="${mskToday(1)}" value="${mskToday(1)}" required></label>
              <label class="f"><span>Окончание</span><input class="inp" type="date" name="end" min="${mskToday(1)}" value="${mskToday(1)}" required></label>
            </div>
            <label class="f"><span>Формат</span><select class="inp" name="op">
              ${e.with_operator ? '<option value="1">С оператором</option>' : ''}${e.without_operator ? '<option value="0">Без оператора</option>' : ''}</select></label>
          </form>
          <div id="quote"></div>
          <div class="actions" style="flex-direction:column;align-items:stretch" id="cta"></div>
          ${mine ? `<a class="btn ghost wide" style="margin-top:8px" href="#/fleet/${e.id}">Редактировать карточку</a>` : ''}
        </div>
      </aside>
    </div>
    <div class="section-head"><h2>Похожая техника</h2></div>
    <div id="similar"></div>`;

  // --- галерея ---
  const setCredit = (i) => {
    const p = photos[i]; const c = app.querySelector('#credit');
    if (!c) return;
    c.innerHTML = p?.author ? `Фото: <a href="${esc(p.page)}" target="_blank" rel="noopener">${esc(p.author)}</a> · ${esc(p.license || '')}` : '';
    c.style.display = p?.author ? '' : 'none';
  };
  setCredit(0);
  app.querySelectorAll('.thumbs button').forEach((b) => b.onclick = () => {
    app.querySelectorAll('.thumbs button').forEach((x) => x.classList.remove('on'));
    b.classList.add('on');
    app.querySelector('#mainImg').src = photos[b.dataset.i].url;
    setCredit(Number(b.dataset.i));
  });

  app.querySelector('#shareBtn').onclick = async () => {
    try { await navigator.clipboard.writeText(location.href); toast('Ссылка скопирована'); } catch { toast(location.href); }
  };
  const favBtn = app.querySelector('#favBtn');
  if (favBtn) favBtn.onclick = async () => {
    const on = !favs.has(e.id);
    const { error } = on ? await sb.from('favorites').insert({ user_id: state.user.id, equipment_id: e.id })
      : await sb.from('favorites').delete().eq('user_id', state.user.id).eq('equipment_id', e.id);
    if (error) return toast('Не удалось обновить избранное', true);
    on ? favs.add(e.id) : favs.delete(e.id);
    favBtn.textContent = on ? '♥ В избранном' : '♡ В избранное';
  };
  const reportBtn = app.querySelector('#reportBtn');
  if (reportBtn) reportBtn.onclick = () => reportDialog(e);

  // --- календарь и калькулятор ---
  const calcForm = app.querySelector('#calc');
  let busyDays = [];
  const from = mskToday(0);
  const to = new Date(Date.UTC(+from.slice(0, 4), +from.slice(5, 7) + 1, 0)).toISOString().slice(0, 10);
  try { busyDays = await rpc('get_busy', { p_eq: e.id, p_from: from, p_to: to }); } catch {}
  const drawCal = () => {
    const s = calcForm.start.value, en = calcForm.end.value;
    app.querySelector('#cal').innerHTML = [0, 1].map((k) => monthGrid(from, k, busyDays, s, en)).join('');
  };
  drawCal();

  let lastQuote = null;
  const quoteEl = app.querySelector('#quote');
  const cta = app.querySelector('#cta');
  async function recalc() {
    const s = calcForm.start.value, en = calcForm.end.value;
    if (en < s) { calcForm.end.value = s; }
    drawCal();
    if (negotiable) { lastQuote = null; renderCta(); return; }
    quoteEl.innerHTML = '<div class="skeleton" style="height:90px"></div>';
    try {
      lastQuote = await rpc('calc_quote', { p_eq: e.id, p_start: calcForm.start.value, p_end: calcForm.end.value, p_with_operator: calcForm.op.value === '1' });
    } catch (err) { lastQuote = { ok: false, error: err.message }; }
    const overlap = busyDays.some((b) => !(b.end_date < calcForm.start.value || b.start_date > calcForm.end.value));
    quoteEl.innerHTML = lastQuote.ok ? breakdownHtml(lastQuote) + (overlap ? '<div class="banner err">На часть выбранных дат техника занята</div>' : '')
      : `<div class="banner warn">${esc(lastQuote.error)}</div>`;
    if (overlap) lastQuote = { ...lastQuote, busy: true };
    renderCta();
  }
  function renderCta() {
    const canBook = lastQuote?.ok && !lastQuote.busy;
    // Блокируем только если действуем от организации-владельца: из личного профиля или другой компании запрос возможен
    const actingOwner = state.org?.id === e.org_id;
    const blocked = e.is_demo || actingOwner || e.status !== 'PUBLISHED';
    cta.innerHTML = `
      ${!negotiable ? `<button class="btn wide" id="bookBtn" ${canBook && !blocked ? '' : 'disabled'}>Забронировать</button>` : ''}
      <button class="btn ${negotiable ? '' : 'ghost'} wide" id="priceBtn" ${blocked ? 'disabled' : ''}>Запросить цену</button>
      <button class="btn ghost wide" id="askBtn" ${blocked ? 'disabled' : ''}>Задать вопрос</button>
      <p class="small muted" style="margin:4px 0 0">${actingOwner ? 'Это техника организации, от имени которой вы сейчас действуете. Чтобы запросить цену как заказчик, переключитесь в меню слева на другой профиль.' : 'Бронь бесплатна. Исполнитель подтвердит её в течение 12 часов, после этого откроются контакты.'}</p>`;
    const need = (fn) => () => {
      if (!state.user) return go('#/login?next=' + encodeURIComponent(location.hash));
      if (!state.org?.can_order) return toast('Переключитесь на организацию-заказчика в меню слева', true);
      fn();
    };
    cta.querySelector('#bookBtn')?.addEventListener('click', need(() => bookDialog(e, calcForm, lastQuote)));
    cta.querySelector('#priceBtn').addEventListener('click', need(() => priceRequestDialog(e, calcForm)));
    cta.querySelector('#askBtn').addEventListener('click', need(async () => {
      try { const c = await rpc('open_conversation', { p_org: state.org.id, p_equipment: e.id, p_order: null }); go('#/messages/' + c); }
      catch (err) { toast(err.message, true); }
    }));
  }
  calcForm.addEventListener('change', recalc);
  recalc();

  // --- похожие ---
  const sim = await q(sb.from('equipment').select(EQ_SELECT).eq('status', 'PUBLISHED').eq('category_id', e.category_id).neq('id', e.id).limit(4));
  const simEl = app.querySelector('#similar');
  simEl.innerHTML = sim.length ? `<div class="products">${sim.map((x) => productCard(x, favs)).join('')}</div>`
    : `<p class="muted">Других предложений в этой категории пока нет. <a href="#/orders/new?cat=${e.categories?.code}">Разместите заказ</a> — исполнители откликнутся сами.</p>`;
  bindFavs(simEl);
}

function monthGrid(fromIso, add, busy, selS, selE) {
  const y0 = +fromIso.slice(0, 4), m0 = +fromIso.slice(5, 7) - 1;
  const first = new Date(Date.UTC(y0, m0 + add, 1));
  const y = first.getUTCFullYear(), m = first.getUTCMonth();
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const shift = (first.getUTCDay() + 6) % 7;
  let cells = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].map((d) => `<div class="dow">${d}</div>`).join('');
  cells += '<div></div>'.repeat(shift);
  for (let d = 1; d <= days; d++) {
    const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isBusy = busy.some((b) => iso >= b.start_date && iso <= b.end_date);
    const past = iso <= fromIso;
    const sel = iso >= selS && iso <= selE;
    cells += `<div class="d ${past ? 'past' : isBusy ? 'busy' : ''} ${sel && !past ? 'sel' : ''}" title="${isBusy ? 'занято' : ''}">${d}</div>`;
  }
  return `<div class="cal"><h4>${MONTHS[m]} ${y}</h4><div class="cal-grid">${cells}</div></div>`;
}

export function breakdownHtml(qt) {
  const lines = (qt.lines || []).filter((l) => l.amount > 0 || l.code === 'rent');
  return `<table class="breakdown num">${lines.map((l) => `<tr><td>${esc(l.label)}</td><td>${money(l.amount)}</td></tr>`).join('')}
    ${qt.fee ? `<tr><td>Комиссия платформы</td><td>${money(qt.fee)}</td></tr>` : ''}
    <tr class="total"><td>Итого за ${qt.days} ${plural(qt.days, 'день', 'дня', 'дней')}</td><td>${money(qt.total)}</td></tr></table>
    ${qt.deposit ? `<div class="small muted">+ залог ${money(qt.deposit)} (возвращается, в итог не входит)</div>` : ''}`;
}

function bookDialog(e, form, qt) {
  const key = idemKey();
  const m = modal(`<h2>Бронирование</h2>
    <p class="muted" style="margin-top:-6px">${esc(e.title)} · ${date(form.start.value)} — ${date(form.end.value)} · ${form.op.value === '1' ? 'с оператором' : 'без оператора'}</p>
    <div class="banner info">Бронь от имени: <b>&nbsp;${esc(state.org.type === 'PERSON' ? 'вы как частное лицо' : state.org.name)}</b></div>
    ${breakdownHtml(qt)}
    <form id="bf">
      <label class="f"><span>Адрес объекта <i>*</i></span><input class="inp" name="address" required maxlength="300" placeholder="Город, улица, дом или ориентир"></label>
      <div class="hint" style="margin:-8px 0 12px">Исполнитель увидит точный адрес только после подтверждения брони.</div>
      <label class="f"><span>Комментарий для исполнителя</span><textarea class="inp" name="comment" maxlength="1000" placeholder="Что нужно сделать, условия подъезда, время подачи"></textarea></label>
      <label class="check"><input type="checkbox" name="agree" required> <span>Подтверждаю условия: итоговая сумма ${money(qt.total)}, ${esc(POLICY[e.cancel_policy].toLowerCase())}, оплата напрямую исполнителю. Согласен с <a href="#/terms" target="_blank">правилами сервиса</a>.</span></label>
      <div class="form-error hidden" id="err"></div>
      <button class="btn wide">Отправить бронь</button>
    </form>`);
  m.el.querySelector('#bf').onsubmit = (ev) => {
    ev.preventDefault();
    const f = ev.target;
    busy(f.querySelector('button'), async () => {
      try {
        const dealId = await rpc('book_equipment', {
          p_org: state.org.id, p_eq: e.id, p_start: form.start.value, p_end: form.end.value,
          p_with_operator: form.op.value === '1', p_address: f.address.value, p_comment: f.comment.value, p_key: key });
        m.close(); toast('Бронь отправлена исполнителю'); go('#/deals/' + dealId);
      } catch (err) { const el = m.el.querySelector('#err'); el.textContent = err.message; el.classList.remove('hidden'); }
    });
  };
}

function priceRequestDialog(e, form) {
  const m = modal(`<h2>Запросить цену</h2>
    <p class="muted" style="margin-top:-6px">Запрос увидит только этот исполнитель. Он пришлёт предложение, которое можно принять в один клик.</p>
    <form id="pf">
      <label class="f"><span>Что нужно сделать <i>*</i></span><input class="inp" name="title" required maxlength="150" value="${esc(e.title)}"></label>
      <div class="grid2">
        <label class="f"><span>Начало <i>*</i></span><input class="inp" type="date" name="start" required min="${mskToday(1)}" value="${form.start.value}"></label>
        <label class="f"><span>Окончание <i>*</i></span><input class="inp" type="date" name="end" required min="${mskToday(1)}" value="${form.end.value}"></label>
      </div>
      <div class="grid2">
        <label class="f"><span>Город <i>*</i></span><input class="inp" name="city" required value="${esc(e.city)}"></label>
        <label class="f"><span>Бюджет, ₽</span><input class="inp" name="budget" type="number" min="0" step="1" max="1000000000"></label>
      </div>
      <label class="f"><span>Адрес объекта <i>*</i></span><input class="inp" name="address" required maxlength="300"></label>
      <label class="f"><span>Подробности</span><textarea class="inp" name="desc" maxlength="3000" placeholder="Объём работ, график, условия подъезда"></textarea></label>
      <div class="form-error hidden" id="err"></div>
      <button class="btn wide">Отправить запрос</button>
    </form>`);
  m.el.querySelector('#pf').onsubmit = (ev) => {
    ev.preventDefault();
    const f = ev.target;
    busy(f.querySelector('button'), async () => {
      try {
        const id = await rpc('create_order', {
          p_org: state.org.id, p_title: f.title.value, p_description: f.desc.value, p_category: e.category_id, p_qty: 1,
          p_format: form.op.value === '1' ? 'WITH_OPERATOR' : 'WITHOUT_OPERATOR', p_start: f.start.value, p_end: f.end.value,
          p_city: f.city.value, p_district: null, p_address: f.address.value,
          p_budget: f.budget.value ? Math.round(+f.budget.value * 100) : null, p_budget_visible: !!f.budget.value,
          p_deadline_hours: 72, p_equipment: e.id });
        m.close(); toast('Запрос отправлен исполнителю'); go('#/orders/' + id);
      } catch (err) { const el = m.el.querySelector('#err'); el.textContent = err.message; el.classList.remove('hidden'); }
    });
  };
}

function reportDialog(e) {
  const m = modal(`<h2>Пожаловаться на карточку</h2>
    <form id="rf"><label class="f"><span>Причина <i>*</i></span><select class="inp" name="reason" required>
      <option value="">Выберите</option><option>Недостоверные данные</option><option>Чужие фото</option><option>Мошенничество</option>
      <option>Контакты в описании</option><option>Дубль</option><option>Другое</option></select></label>
      <label class="f"><span>Комментарий</span><textarea class="inp" name="comment" maxlength="1000"></textarea></label>
      <button class="btn wide">Отправить</button></form>`);
  m.el.querySelector('#rf').onsubmit = async (ev) => {
    ev.preventDefault();
    const f = ev.target;
    const { error } = await sb.from('listing_reports').insert({ equipment_id: e.id, reporter_user_id: state.user.id, reason: f.reason.value, comment: f.comment.value || null });
    if (error) return toast('Не удалось отправить жалобу', true);
    m.close(); toast('Жалоба отправлена модератору');
  };
}
