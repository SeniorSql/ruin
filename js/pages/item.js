// Карточка техники: галерея, характеристики, календарь, калькулятор, бронь (SCR-CAT-03, раздел H)
import { sb, state, q, rpc, canManage } from '../api.js';
import { esc, money, priceText, photoOf, initials, specValue, SPEC_LABELS, POLICY, UNIT, status, modal, toast, busy,
  mskToday, date, idemKey, plural, errorState, safeUrl } from '../ui.js';
import { EQ_SELECT, productCard, loadFavs, bindFavs } from '../cards.js';
import { go } from '../app.js';
import { t, isEn, catName } from '../i18n.js';

const MONTHS = isEn() ? ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  : ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

export async function render(app, { id }) {
  let e;
  try { e = await q(sb.from('equipment').select(EQ_SELECT).eq('id', id).maybeSingle()); }
  catch (err) { app.innerHTML = errorState(err); return; }
  if (!e) {
    app.innerHTML = `<div class="panel empty"><b>${t('Карточка не найдена', 'Listing not found')}</b>${t('Возможно, техника снята с публикации.', 'The machine may have been unpublished.')}<div><a class="btn" href="#/catalog">${t('В каталог', 'To the catalogue')}</a></div></div>`;
    return;
  }
  const org = e.organizations || {};
  const mine = state.orgs.some((o) => o.id === e.org_id);
  const photos = (e.photos || []).map((p) => (typeof p === 'string' ? { url: p } : p));
  const [stats, favs, rating] = await Promise.all([rpc('public_org_stats', { p_org: e.org_id }).catch(() => ({})), loadFavs(),
    rpc('org_rating', { p_org: e.org_id, p_role: 'PROVIDER' }).catch(() => ({}))]);
  const stale = Date.now() - new Date(e.availability_confirmed_at) > 7 * 864e5;
  const negotiable = e.price_unit === 'NEGOTIABLE' || e.price_minor == null || e.delivery_minor == null;
  document.title = `${e.title} — ${t('аренда', 'rental')}, ${e.city} | RUIN`;

  app.innerHTML = `
    <div class="crumbs"><a href="#/">RUIN</a> › <a href="#/catalog">${t('Каталог', 'Catalogue')}</a> › <a href="#/catalog?cat=${e.categories?.code}">${esc(catName(e.categories))}</a> › <b>${esc(e.title)}</b></div>
    ${e.is_demo ? `<div class="banner warn">${t('<b>Пример карточки.</b>&nbsp;Так будет выглядеть реальное предложение. Забронировать или написать по ней нельзя.', '<b>Sample listing.</b>&nbsp;This is how a real offer will look. It cannot be booked or messaged.')}</div>` : ''}
    ${mine && e.status !== 'PUBLISHED' ? `<div class="banner info">${t('Это ваша техника, статус:', 'This is your machine, status:')} ${status('equipment', e.status)}. ${t('Покупатели её пока не видят.', 'Customers cannot see it yet.')} <a href="#/fleet/${e.id}">${t('Редактировать', 'Edit')}</a></div>` : ''}
    <div class="cols item-cols">
      <div class="item-main">
        <div class="gallery">${photos[0] ? `<img class="main-img" id="mainImg" src="${esc(photos[0].url)}" alt="${esc(e.title)}" referrerpolicy="no-referrer">` : '<div class="main-img" style="aspect-ratio:16/10"></div>'}
          <span class="credit" id="credit"></span></div>
        ${photos.length > 1 ? `<div class="thumbs">${photos.map((p, i) => `<button data-i="${i}" class="${i ? '' : 'on'}" aria-label="${t('Фото', 'Photo')} ${i + 1}"><img src="${esc(p.url)}" alt="" loading="lazy" referrerpolicy="no-referrer"></button>`).join('')}</div>` : ''}

        <div class="panel item-title" style="margin-top:14px">
          <span class="muted small">${esc(catName(e.categories))} · ${esc(e.brand)} ${esc(e.model)}${e.year ? ' · ' + e.year + t(' г.', '') : ''}</span>
          <h1 style="font-size:28px;margin:4px 0 6px">${esc(e.title)}</h1>
          <div class="muted">${esc(e.city)}${e.district ? ', ' + esc(e.district) : ''} · ${t('выезд до', 'travels up to')} ${e.service_radius_km} ${t('км', 'km')}</div>
          <div class="actions" style="margin-top:12px">
            ${state.user ? `<button class="btn ghost sm" id="favBtn">${favs.has(e.id) ? t('♥ В избранном', '♥ In favourites') : t('♡ В избранное', '♡ Add to favourites')}</button>` : ''}
            <button class="btn ghost sm" id="shareBtn">${t('Скопировать ссылку', 'Copy link')}</button>
            ${state.user && !mine ? `<button class="btn ghost sm" id="reportBtn">${t('Пожаловаться', 'Report')}</button>` : ''}
          </div>
        </div>

        <div class="panel"><h2>${t('Характеристики', 'Specifications')}</h2>
          <table class="spec-table">
            <tr><td>${t('Марка и модель', 'Brand and model')}</td><td>${esc(e.brand)} ${esc(e.model)}</td></tr>
            ${e.year ? `<tr><td>${t('Год выпуска', 'Year')}</td><td>${e.year}</td></tr>` : ''}
            ${Object.entries(e.specs || {}).map(([k, v]) => `<tr><td>${esc((SPEC_LABELS[k] || [k])[0])}</td><td>${esc(specValue(k, v))}</td></tr>`).join('')}
          </table>
          ${e.description ? `<h3 style="margin-top:18px">${t('Описание', 'Description')}</h3><p style="white-space:pre-wrap;margin:0">${esc(e.description)}</p>` : ''}
        </div>

        <div class="panel"><h2>${t('Условия аренды', 'Rental terms')}</h2>
          <dl class="kv">
            <dt>${t('Формат', 'Format')}</dt><dd>${[e.with_operator && t('с оператором', 'with operator'), e.without_operator && t('без оператора', 'without operator')].filter(Boolean).join(', ')}</dd>
            <dt>${t('Минимальный заказ', 'Minimum order')}</dt><dd>${e.min_units} ${UNIT[e.price_unit] || ''}${e.price_unit === 'SHIFT' ? ` (${t('смена', 'shift')} ${e.shift_hours} ${t('ч', 'h')})` : ''}</dd>
            ${e.operator_minor ? `<dt>${t('Оператор', 'Operator')}</dt><dd>+${money(e.operator_minor)} ${t('за', 'per')} ${UNIT[e.price_unit]}</dd>` : ''}
            <dt>${t('Доставка', 'Delivery')}</dt><dd>${e.delivery_minor == null ? t('по запросу', 'on request') : e.delivery_minor ? money(e.delivery_minor) + t(' (подача и возврат)', ' (delivery and return)') : t('включена', 'included')}</dd>
            <dt>${t('Залог', 'Deposit')}</dt><dd>${e.deposit_minor ? money(e.deposit_minor) + t(' — возвращается после возврата техники', ' — refunded when the machine is returned') : t('без залога', 'no deposit')}</dd>
            <dt>${t('Условия отмены', 'Cancellation terms')}</dt><dd>${esc(POLICY[e.cancel_policy])}</dd>
            <dt>${t('Оплата', 'Payment')}</dt><dd>${t('напрямую исполнителю по договорённости (платформа не принимает деньги)', 'directly to the provider as agreed (the platform does not take payments)')}</dd>
          </dl>
        </div>

        <div class="panel"><h2>${t('Календарь занятости', 'Availability calendar')}</h2>
          ${stale && !e.is_demo ? `<div class="banner warn">${t('Исполнитель давно не обновлял календарь — доступность уточняется.', 'The provider has not updated the calendar for a while — availability to be confirmed.')}</div>` : ''}
          <div class="cal-wrap" id="cal"><div class="skeleton" style="height:200px"></div></div>
          <div class="legend"><span><i class="free"></i>${t('свободно', 'free')}</span><span><i class="busy"></i>${t('занято', 'busy')}</span><span><i class="sel"></i>${t('ваш выбор', 'your selection')}</span></div>
        </div>

        <div class="panel"><h2>${t('Исполнитель', 'Provider')}</h2>
          <div class="provider-box"><span class="sa">${esc(initials(org.name))}</span>
            <div><b>${e.is_demo ? esc(org.name) : `<a href="#/company/${org.id}">${esc(org.name)}</a>`}</b><div class="small">${status('org', org.verification_status)}
              <span class="muted"> · ${t('завершено сделок', 'completed deals')}: ${stats.completed ?? 0} · ${t('на RUIN с', 'on RUIN since')} ${date(stats.since)}</span></div>
              <div class="small" style="margin-top:4px">${rating?.rating ? `<span class="rating">★ ${rating.rating}</span> <span class="muted">· ${rating.n} ${t('отзывов', 'reviews')}</span>` : rating?.n ? `<span class="muted">${t('Мало оценок для рейтинга', 'Not enough ratings yet')}</span>` : `<span class="muted">${t('Нет оценок — новичок на платформе', 'No ratings — new on the platform')}</span>`}</div></div></div>
          <p class="small muted" style="margin:12px 0 0">${t('Контакты исполнителя откроются после подтверждения сделки.', 'Provider contacts become visible once the deal is confirmed.')}${e.is_demo ? '' : ` <a href="#/company/${org.id}">${t('Все предложения и отзывы компании →', 'All company offers and reviews →')}</a>`}</p>
        </div>
      </div>

      <aside class="sticky">
        <div class="panel">
          <div class="price-big num">${priceText(e)}</div>
          <div class="muted small">${negotiable ? t('Стоимость рассчитает исполнитель по вашему запросу', 'The provider will quote on request') : t('Предварительный расчёт — по выбранным датам', 'Estimate for the selected dates')}</div>
          <div class="divider"></div>
          <form id="calc">
            <div class="grid2">
              <label class="f"><span>${t('Начало', 'Start')}</span><input class="inp" type="date" name="start" min="${mskToday(1)}" value="${mskToday(1)}" required></label>
              <label class="f"><span>${t('Окончание', 'End')}</span><input class="inp" type="date" name="end" min="${mskToday(1)}" value="${mskToday(1)}" required></label>
            </div>
            <label class="f"><span>${t('Формат', 'Format')}</span><select class="inp" name="op">
              ${e.with_operator ? `<option value="1">${t('С оператором', 'With operator')}</option>` : ''}${e.without_operator ? `<option value="0">${t('Без оператора', 'Without operator')}</option>` : ''}</select></label>
          </form>
          <div id="quote"></div>
          <div class="actions" style="flex-direction:column;align-items:stretch" id="cta"></div>
          ${mine ? `<a class="btn ghost wide" style="margin-top:8px" href="#/fleet/${e.id}">${t('Редактировать карточку', 'Edit listing')}</a>` : ''}
        </div>
      </aside>
    </div>
    <div class="section-head"><h2>${t('Похожая техника', 'Similar machinery')}</h2></div>
    <div id="similar"></div>`;

  // --- галерея ---
  const setCredit = (i) => {
    const p = photos[i]; const c = app.querySelector('#credit');
    if (!c) return;
    c.innerHTML = p?.author ? `${t('Фото', 'Photo')}: <a href="${safeUrl(p.page)}" target="_blank" rel="noopener">${esc(p.author)}</a> · ${esc(p.license || '')}` : '';
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
    try { await navigator.clipboard.writeText(location.href); toast(t('Ссылка скопирована', 'Link copied')); } catch { toast(location.href); }
  };
  const favBtn = app.querySelector('#favBtn');
  if (favBtn) favBtn.onclick = async () => {
    const on = !favs.has(e.id);
    const { error } = on ? await sb.from('favorites').insert({ user_id: state.user.id, equipment_id: e.id })
      : await sb.from('favorites').delete().eq('user_id', state.user.id).eq('equipment_id', e.id);
    if (error) return toast(t('Не удалось обновить избранное', 'Could not update favourites'), true);
    on ? favs.add(e.id) : favs.delete(e.id);
    favBtn.textContent = on ? t('♥ В избранном', '♥ In favourites') : t('♡ В избранное', '♡ Add to favourites');
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
    quoteEl.innerHTML = lastQuote.ok ? breakdownHtml(lastQuote) + (overlap ? `<div class="banner err">${t('На часть выбранных дат техника занята', 'The machine is busy on some of the selected dates')}</div>` : '')
      : `<div class="banner warn">${esc(lastQuote.error)}</div>`;
    if (overlap) lastQuote = { ...lastQuote, busy: true };
    renderCta();
  }
  function renderCta() {
    const canBook = lastQuote?.ok && !lastQuote.busy;
    // Блокируем только если действуем от организации-владельца: из личного профиля или другой компании запрос возможен
    const actingOwner = state.org?.id === e.org_id;
    const blocked = e.is_demo || actingOwner || e.status !== 'PUBLISHED';
    if (state.user && state.org && !canManage()) {
      const roleName = isEn() ? { APPROVER: 'Approver', FINANCE: 'Accountant', VIEWER: 'Viewer' } : { APPROVER: 'Согласующий', FINANCE: 'Бухгалтер', VIEWER: 'Наблюдатель' };
      cta.innerHTML = `<div class="banner info small">${t('У вас роль', 'Your role is')} «${roleName[state.org.role] || state.org.role}» — ${t('только просмотр. Бронировать могут владелец, администратор и менеджер.', 'view only. Only the owner, an administrator or a manager can book.')}</div>`;
      return;
    }
    // 12.11.2026 (Этибар): в карточке одна кнопка «Забронировать». Цена и доставка указаны — сразу бронь на выбранные даты;
    // иначе (доставка по запросу или старая «договорная» цена) та же кнопка открывает «Заявку на бронь» — исполнитель пришлёт цену.
    cta.innerHTML = `
      ${negotiable
        ? `<button class="btn wide" id="priceBtn" ${blocked ? 'disabled' : ''}>${t('Забронировать', 'Book')}</button>`
        : `<button class="btn wide" id="bookBtn" ${canBook && !blocked ? '' : 'disabled'}>${t('Забронировать', 'Book')}</button>`}
      <p class="small muted" style="margin:4px 0 0">${actingOwner ? t('Это техника организации, от имени которой вы сейчас действуете. Чтобы забронировать её как заказчик, переключитесь на другой профиль в меню под вашим именем (справа вверху).', 'This machine belongs to the organisation you are acting for. To book it as a customer, switch to another profile in the menu under your name (top right).')
        : negotiable ? t('Отправьте заявку на бронь — исполнитель ответит в течение 2 рабочих часов (8:00–21:00 МСК): посчитает итог с доставкой и пришлёт предложение, вы примете его в один клик. Это бесплатно.', 'Send a booking request — the provider replies within 2 working hours (8:00–21:00 Moscow time) with a total including delivery; accept it in one click. It is free.')
        : t('Бронь бесплатна. Исполнитель подтвердит её в течение 2 рабочих часов (8:00–21:00 МСК). Чат с исполнителем откроется после оформления брони, контакты — после подтверждения.', 'Booking is free. The provider confirms within 2 working hours (8:00–21:00 Moscow time). Chat opens after booking, contacts after confirmation.')}</p>`;
    const need = (fn) => () => {
      if (!state.user) return go('#/login?next=' + encodeURIComponent(location.hash));
      if (!state.org?.can_order) return toast(t('Переключитесь на организацию-заказчика в меню под вашим именем (справа вверху)', 'Switch to a customer organisation in the menu under your name (top right)'), true);
      fn();
    };
    cta.querySelector('#bookBtn')?.addEventListener('click', need(() => bookDialog(e, calcForm, lastQuote)));
    cta.querySelector('#priceBtn')?.addEventListener('click', need(() => priceRequestDialog(e, calcForm)));
  }
  calcForm.addEventListener('change', recalc);
  recalc();

  // --- похожие ---
  const sim = await q(sb.from('equipment').select(EQ_SELECT).eq('status', 'PUBLISHED').eq('category_id', e.category_id).neq('id', e.id).limit(4));
  const simEl = app.querySelector('#similar');
  simEl.innerHTML = sim.length ? `<div class="products">${sim.map((x) => productCard(x, favs)).join('')}</div>`
    : `<p class="muted">${t('Других предложений в этой категории пока нет.', 'No other offers in this category yet.')} <a href="#/orders/new?cat=${e.categories?.code}">${t('Разместите заказ', 'Post an order')}</a> ${t('— исполнители откликнутся сами.', '— providers will respond.')}</p>`;
  bindFavs(simEl);
}

function monthGrid(fromIso, add, busy, selS, selE) {
  const y0 = +fromIso.slice(0, 4), m0 = +fromIso.slice(5, 7) - 1;
  const first = new Date(Date.UTC(y0, m0 + add, 1));
  const y = first.getUTCFullYear(), m = first.getUTCMonth();
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const shift = (first.getUTCDay() + 6) % 7;
  let cells = (isEn() ? ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] : ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']).map((d) => `<div class="dow">${d}</div>`).join('');
  cells += '<div></div>'.repeat(shift);
  for (let d = 1; d <= days; d++) {
    const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isBusy = busy.some((b) => iso >= b.start_date && iso <= b.end_date);
    const past = iso <= fromIso;
    const sel = iso >= selS && iso <= selE;
    cells += `<div class="d ${past ? 'past' : isBusy ? 'busy' : ''} ${sel && !past ? 'sel' : ''}" title="${isBusy ? t('занято', 'busy') : ''}">${d}</div>`;
  }
  return `<div class="cal"><h4>${MONTHS[m]} ${y}</h4><div class="cal-grid">${cells}</div></div>`;
}

export function breakdownHtml(qt) {
  const lines = (qt.lines || []).filter((l) => l.amount > 0 || l.code === 'rent');
  return `<table class="breakdown num">${lines.map((l) => `<tr><td>${esc(l.label)}</td><td>${money(l.amount)}</td></tr>`).join('')}
    ${qt.fee ? `<tr><td>${t('Комиссия платформы', 'Platform fee')}</td><td>${money(qt.fee)}</td></tr>` : ''}
    <tr class="total"><td>${t(`Итого за ${qt.days} ${plural(qt.days, 'день', 'дня', 'дней')}`, `Total for ${qt.days} ${qt.days === 1 ? 'day' : 'days'}`)}</td><td>${money(qt.total)}</td></tr></table>
    ${qt.deposit ? `<div class="small muted">${t(`+ залог ${money(qt.deposit)} (возвращается, в итог не входит)`, `+ deposit ${money(qt.deposit)} (refundable, not included in the total)`)}</div>` : ''}`;
}

function bookDialog(e, form, qt) {
  const key = idemKey();
  const m = modal(`<h2>${t('Бронирование', 'Booking')}</h2>
    <p class="muted" style="margin-top:-6px">${esc(e.title)} · ${date(form.start.value)} — ${date(form.end.value)} · ${form.op.value === '1' ? t('с оператором', 'with operator') : t('без оператора', 'without operator')}</p>
    <div class="banner info">${t('Бронь от имени:', 'Booking on behalf of:')} <b>&nbsp;${esc(state.org.type === 'PERSON' ? t('вы как частное лицо', 'you as an individual') : state.org.name)}</b></div>
    ${breakdownHtml(qt)}
    <form id="bf">
      <label class="f"><span>${t('Адрес объекта', 'Site address')} <i>*</i></span><input class="inp" name="address" required maxlength="300" placeholder="${t('Город, улица, дом или ориентир', 'City, street, building or landmark')}"></label>
      <div class="hint" style="margin:-8px 0 12px">${t('Исполнитель увидит точный адрес только после подтверждения брони.', 'The provider sees the exact address only after confirming the booking.')}</div>
      <label class="f"><span>${t('Комментарий для исполнителя', 'Comment for the provider')}</span><textarea class="inp" name="comment" maxlength="1000" placeholder="${t('Что нужно сделать, условия подъезда, время подачи', 'What needs doing, site access, delivery time')}"></textarea></label>
      <label class="check"><input type="checkbox" name="agree" required> <span>${t(`Подтверждаю условия: итоговая сумма ${money(qt.total)}, ${esc(POLICY[e.cancel_policy].toLowerCase())}, оплата напрямую исполнителю. Согласен с <a href="#/terms" target="_blank">правилами сервиса</a>.`, `I confirm the terms: total ${money(qt.total)}, ${esc(POLICY[e.cancel_policy].toLowerCase())}, payment directly to the provider. I accept the <a href="#/terms" target="_blank">terms of service</a>.`)}</span></label>
      <div class="form-error hidden" id="err"></div>
      <button class="btn wide">${t('Отправить бронь', 'Send booking')}</button>
    </form>`);
  m.el.querySelector('#bf').onsubmit = (ev) => {
    ev.preventDefault();
    const f = ev.target;
    busy(f.querySelector('button'), async () => {
      try {
        const dealId = await rpc('book_equipment', {
          p_org: state.org.id, p_eq: e.id, p_start: form.start.value, p_end: form.end.value,
          p_with_operator: form.op.value === '1', p_address: f.address.value, p_comment: f.comment.value, p_key: key });
        m.close(); toast(t('Бронь отправлена исполнителю', 'Booking sent to the provider')); go('#/deals/' + dealId);
      } catch (err) { const el = m.el.querySelector('#err'); el.textContent = err.message; el.classList.remove('hidden'); }
    });
  };
}

function priceRequestDialog(e, form) {
  const m = modal(`<h2>${t('Заявка на бронь', 'Booking request')}</h2>
    <p class="muted" style="margin-top:-6px">${t('Заявку увидит только этот исполнитель. Он посчитает итог с доставкой и пришлёт предложение, которое можно принять в один клик.', 'Only this provider will see the request. They will calculate the total with delivery and send an offer you can accept in one click.')}</p>
    <form id="pf">
      <label class="f"><span>${t('Что нужно сделать', 'What needs doing')} <i>*</i></span><input class="inp" name="title" required minlength="3" maxlength="150" title="${t('От 3 до 150 символов', '3 to 150 characters')}" value="${esc(e.title)}"></label>
      <div class="grid2">
        <label class="f"><span>${t('Начало', 'Start')} <i>*</i></span><input class="inp" type="date" name="start" required min="${mskToday(1)}" value="${form.start.value}"></label>
        <label class="f"><span>${t('Окончание', 'End')} <i>*</i></span><input class="inp" type="date" name="end" required min="${mskToday(1)}" value="${form.end.value}"></label>
      </div>
      <div class="grid2">
        <label class="f"><span>${t('Город или посёлок объекта', 'Site city or town')} <i>*</i></span><input class="inp" name="city" required maxlength="100" placeholder="${t('Например: Подольск', 'E.g. Podolsk')}"></label>
        <label class="f"><span>${t('Район', 'District')}</span><input class="inp" name="district" maxlength="100" placeholder="${t('Необязательно', 'Optional')}"></label>
      </div>
      <div class="hint" style="margin:-8px 0 12px">${t('Город и район исполнитель увидит сразу — по ним он посчитает доставку.', 'The provider sees the city and district right away to calculate delivery.')}</div>
      <label class="f"><span>${t('Точный адрес объекта', 'Exact site address')} <i>*</i></span><input class="inp" name="address" required maxlength="300" placeholder="${t('Улица, дом или ориентир', 'Street, building or landmark')}">
        <div class="hint">${t('Откроется исполнителю только после подтверждения сделки.', 'Shown to the provider only after the deal is confirmed.')}</div></label>
      <label class="f"><span>${t('Бюджет, ₽', 'Budget, ₽')}</span><input class="inp" name="budget" type="number" min="0" step="1" max="1000000000"></label>
      <label class="f"><span>${t('Подробности для исполнителя', 'Details for the provider')}</span><textarea class="inp" name="desc" maxlength="3000" placeholder="${t('Объём работ, график, условия подъезда. Без телефонов и ссылок.', 'Scope, schedule, site access. No phone numbers or links.')}"></textarea></label>
      <div class="form-error hidden" id="err"></div>
      <button class="btn wide">${t('Отправить заявку', 'Send request')}</button>
    </form>`);
  m.el.querySelector('#pf').onsubmit = (ev) => {
    ev.preventDefault();
    const f = ev.target;
    busy(f.querySelector('button'), async () => {
      try {
        const id = await rpc('create_order', {
          p_org: state.org.id, p_title: f.title.value, p_description: f.desc.value, p_category: e.category_id, p_qty: 1,
          p_format: form.op.value === '1' ? 'WITH_OPERATOR' : 'WITHOUT_OPERATOR', p_start: f.start.value, p_end: f.end.value,
          p_city: f.city.value, p_district: f.district.value || null, p_address: f.address.value,
          p_budget: f.budget.value ? Math.round(+f.budget.value * 100) : null, p_budget_visible: !!f.budget.value,
          p_deadline_hours: 2, p_equipment: e.id }); // срок считает база: 2 рабочих часа, 8:00–21:00 МСК (SQL 34)
        m.close(); toast(t('Заявка отправлена исполнителю', 'Request sent to the provider')); go('#/orders/' + id);
      } catch (err) { const el = m.el.querySelector('#err'); el.textContent = err.message; el.classList.remove('hidden'); }
    });
  };
}

function reportDialog(e) {
  const REASONS = [['Недостоверные данные', 'Inaccurate details'], ['Чужие фото', 'Someone else\'s photos'], ['Мошенничество', 'Fraud'],
    ['Контакты в описании', 'Contacts in description'], ['Дубль', 'Duplicate'], ['Другое', 'Other']];
  const m = modal(`<h2>${t('Пожаловаться на карточку', 'Report this listing')}</h2>
    <form id="rf"><label class="f"><span>${t('Причина', 'Reason')} <i>*</i></span><select class="inp" name="reason" required>
      <option value="">${t('Выберите', 'Choose')}</option>${REASONS.map(([ru, en]) => `<option value="${ru}">${t(ru, en)}</option>`).join('')}</select></label>
      <label class="f"><span>${t('Комментарий', 'Comment')}</span><textarea class="inp" name="comment" maxlength="1000"></textarea></label>
      <button class="btn wide">${t('Отправить', 'Send')}</button></form>`);
  m.el.querySelector('#rf').onsubmit = async (ev) => {
    ev.preventDefault();
    const f = ev.target;
    const { error } = await sb.from('listing_reports').insert({ equipment_id: e.id, reporter_user_id: state.user.id, reason: f.reason.value, comment: f.comment.value || null });
    if (error) return toast(t('Не удалось отправить жалобу', 'Could not send the report'), true);
    m.close(); toast(t('Жалоба отправлена модератору', 'Report sent to the moderator'));
  };
}
