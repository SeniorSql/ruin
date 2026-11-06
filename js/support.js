// Поддержка: контакты, частые вопросы и бот-подсказчик (кнопка в правом нижнем углу на всех страницах).
// Бот бесплатный: ищет ответ по ключевым словам в списке FAQ ниже. Новый вопрос — просто добавьте элемент в FAQ.
import { esc } from './ui.js';
import { t, isEn } from './i18n.js';

export const SUPPORT = {
  email: 'info@ru-in.ru',
  address: t('г. Москва, Алтуфьевское шоссе, д. 26А, кв. 72', 'Altufyevskoye Shosse 26A, apt. 72, Moscow, Russia'),
  operator: t('ИП Исмаилов Этибар Худавердиевич', 'Sole proprietor Etibar Khudaverdiyevich Ismailov'),
  hours: t('Отвечаем на письма в будни с 9:00 до 19:00 МСК, обычно в течение рабочего дня.', 'We answer emails on weekdays 9:00–19:00 Moscow time, usually within one business day.')
};

// k — ключевые слова (русские и английские, в нижнем регистре, можно начало слова)
export const FAQ = [
  { k: ['заброн', 'бронь', 'аренд', 'арендова', 'взять', 'book', 'rent'],
    q: ['Как забронировать технику?', 'How do I book a machine?'],
    a: ['Откройте <a href="#/catalog">каталог</a>, выберите технику и даты — калькулятор покажет стоимость. Нажмите «Забронировать», укажите адрес объекта. Исполнитель подтвердит бронь в течение 12 часов, после этого откроются контакты.',
      'Open the <a href="#/catalog">catalogue</a>, choose a machine and dates — the calculator shows the price. Click “Book” and enter the site address. The provider confirms within 12 hours, then contacts become visible.'] },
  { k: ['заказ', 'разместить', 'предложени', 'биржа', 'order', 'offer'],
    q: ['Как получить предложения от нескольких исполнителей?', 'How do I get offers from several providers?'],
    a: ['<a href="#/orders/new">Разместите заказ</a>: категория, даты, город. Проверенные исполнители пришлют цены — их можно сравнить и выбрать лучшее.',
      '<a href="#/orders/new">Post an order</a>: category, dates, city. Verified providers send prices — compare and pick the best.'] },
  { k: ['сдать', 'сдаю', 'исполнител', 'своя техника', 'добавить техник', 'provider', 'list my', 'own machine'],
    q: ['Как сдавать свою технику?', 'How do I rent out my machinery?'],
    a: ['В разделе <a href="#/account">«Профиль и организации»</a> создайте организацию (ИП, юрлицо или самозанятый) и отправьте на проверку. Затем добавьте технику: характеристики, минимум 3 фото, цены. После модерации карточку увидят заказчики.',
      'In <a href="#/account">Profile and organisations</a> create an organisation (sole proprietor, company or self-employed) and submit it for review. Then add machinery: specs, at least 3 photos, prices. After moderation customers will see it.'] },
  { k: ['провер', 'модерац', 'верифик', 'verify', 'review', 'moderat'],
    q: ['Сколько длится проверка организации?', 'How long does verification take?'],
    a: ['Обычно 1 рабочий день. Если что-то нужно исправить, в карточке организации появится комментарий модератора.',
      'Usually one business day. If something needs fixing, the moderator leaves a comment on the organisation card.'] },
  { k: ['контакт', 'телефон', 'скрыт', 'номер', 'contact', 'phone', 'hidden'],
    q: ['Почему скрыты телефоны?', 'Why are phone numbers hidden?'],
    a: ['Контакты открываются после подтверждения сделки — так обе стороны защищены её условиями. До этого можно писать в чат сделки.',
      'Contacts open once the deal is confirmed, so both parties are protected by its terms. Before that you can use the deal chat.'] },
  { k: ['код', 'telegram', 'телеграм', ' max', ' макс', 'уведомлен', 'code', 'notification'],
    q: ['Где взять код подтверждения?', 'Where do I get the confirmation code?'],
    a: ['Код приходит в Telegram или MAX, если мессенджер подключён в <a href="#/account">профиле</a> (блок «Уведомления в мессенджерах»). Код действует 10 минут, даётся 5 попыток. Не пришёл — нажмите «Отправить ещё раз».',
      'The code is sent to Telegram or MAX if connected in your <a href="#/account">profile</a> (“Messenger notifications”). It is valid for 10 minutes, 5 attempts. Not received — click “Send again”.'] },
  { k: ['пароль', 'войти', 'вход', 'забыл', 'password', 'log in', 'login', 'forgot'],
    q: ['Не могу войти / забыл пароль', 'I cannot log in / forgot my password'],
    a: ['Нажмите <a href="#/forgot">«Забыли пароль?»</a> — пришлём ссылку для смены пароля. Откройте её сразу и один раз. Письма нет — проверьте «Спам».',
      'Click <a href="#/forgot">“Forgot password?”</a> — we will send a reset link. Open it right away, once. No email — check your spam folder.'] },
  { k: ['отмен', 'cancel'],
    q: ['Как отменить бронь или сделку?', 'How do I cancel a booking or deal?'],
    a: ['Откройте сделку в разделе «Сделки» и нажмите «Отменить сделку». Условия бесплатной отмены указаны в карточке техники и в сделке.',
      'Open the deal under “Deals” and click “Cancel deal”. Free-cancellation terms are shown on the listing and in the deal.'] },
  { k: ['оплат', 'деньг', 'платит', 'комисси', 'pay', 'money', 'fee'],
    q: ['Как происходит оплата?', 'How does payment work?'],
    a: ['Сейчас сервис бесплатный: расчёты идут напрямую между заказчиком и исполнителем. Платформа деньги не принимает и данные карт не хранит.',
      'The service is currently free: payments go directly between customer and provider. The platform does not take money or store card details.'] },
  { k: ['удал', 'организац', 'закры', 'delete', 'remove', 'organisation', 'organization'],
    q: ['Как удалить организацию?', 'How do I delete an organisation?'],
    a: ['Владелец нажимает «Удалить» в <a href="#/account">«Моих организациях»</a>, вводит название и код. Если были сделки, организация закрывается (документы остаются у контрагентов). При незавершённых сделках удалить нельзя.',
      'The owner clicks “Delete” in <a href="#/account">My organisations</a>, types the name and the code. If there were deals, the organisation is closed (documents stay with counterparties). It cannot be deleted while deals are in progress.'] },
  { k: ['документ', ' акт', 'договор', 'pdf', 'печат', 'document', 'contract', 'act'],
    q: ['Где документы по сделке?', 'Where are the deal documents?'],
    a: ['В карточке сделки — блок «Документы»: заявка, договор, акты приёма-передачи и выполненных работ. Их можно распечатать или сохранить в PDF.',
      'On the deal page, “Documents” block: request, contract, handover and completion acts. Print them or save as PDF.'] },
  { k: ['претензи', 'спор', 'жалоб', 'dispute', 'complain', 'claim'],
    q: ['Что делать, если возник спор?', 'What if there is a dispute?'],
    a: ['Откройте претензию в карточке сделки — её рассмотрит модератор. Пожаловаться на объявление можно кнопкой «Пожаловаться» в карточке техники.',
      'Open a claim on the deal page — a moderator will review it. To report a listing, use “Report” on the machine page.'] },
  { k: ['персональн', 'данные', 'удалить аккаунт', 'согласи', 'personal data', 'privacy', 'delete account'],
    q: ['Как удалить мои данные или аккаунт?', 'How do I delete my data or account?'],
    a: [`Напишите на <a href="mailto:info@ru-in.ru">info@ru-in.ru</a> — ответим в течение 10 рабочих дней. Подробнее — в <a href="#/privacy">политике обработки ПДн</a>.`,
      `Email <a href="mailto:info@ru-in.ru">info@ru-in.ru</a> — we reply within 10 business days. Details in the <a href="#/privacy">privacy policy</a>.`] }
];

const L = (pair) => (isEn() ? pair[1] : pair[0]);

// Поиск ответа: считаем совпадения ключевых слов
export function findAnswers(text) {
  const s = ' ' + String(text || '').toLowerCase().replace(/ё/g, 'е') + ' ';
  return FAQ.map((f) => ({ f, score: f.k.reduce((n, w) => n + (s.includes(w.replace(/ё/g, 'е')) ? 1 : 0), 0) }))
    .filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 2).map((x) => x.f);
}

export const contactsHtml = () => `<dl class="kv">
  <dt>Email</dt><dd><a href="mailto:${SUPPORT.email}">${SUPPORT.email}</a></dd>
  <dt>${t('Почтовый адрес', 'Postal address')}</dt><dd>${esc(SUPPORT.address)}</dd>
  <dt>${t('Оператор', 'Operator')}</dt><dd>${esc(SUPPORT.operator)}</dd>
  <dt>${t('Часы работы', 'Hours')}</dt><dd>${esc(SUPPORT.hours)}</dd></dl>`;

export const faqHtml = () => FAQ.map((f) => `<details class="faq"><summary>${esc(L(f.q))}</summary><p>${L(f.a)}</p></details>`).join('');

// ---------- бот-подсказчик ----------
export function mountHelpBot() {
  if (document.getElementById('helpBot')) return;
  const root = document.createElement('div');
  root.id = 'helpBot';
  root.innerHTML = `<button class="hb-fab" type="button" aria-label="${t('Помощь', 'Help')}" title="${t('Помощь и поддержка', 'Help and support')}">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5M12 16.5h.01"/></svg></button>
    <section class="hb-panel hidden" role="dialog" aria-label="${t('Помощник RUIN', 'RUIN assistant')}">
      <header><b>${t('Помощник RUIN', 'RUIN assistant')}</b><button class="hb-x" type="button" aria-label="${t('Закрыть', 'Close')}">×</button></header>
      <div class="hb-log" aria-live="polite"></div>
      <div class="hb-quick"></div>
      <form class="hb-form"><input name="q" maxlength="200" autocomplete="off" placeholder="${t('Напишите вопрос…', 'Type your question…')}" aria-label="${t('Ваш вопрос', 'Your question')}"><button class="btn sm">${t('Спросить', 'Ask')}</button></form>
    </section>`;
  document.body.appendChild(root);
  const panel = root.querySelector('.hb-panel'), log = root.querySelector('.hb-log'), quick = root.querySelector('.hb-quick');
  const say = (html, who = 'bot') => { log.insertAdjacentHTML('beforeend', `<div class="hb-msg ${who}">${html}</div>`); log.scrollTop = log.scrollHeight; };
  const fallback = () => t(`Не нашёл точного ответа. Напишите нам на <a href="mailto:${SUPPORT.email}">${SUPPORT.email}</a> — ответим в рабочее время. Все контакты — на странице <a href="#/support">«Поддержка»</a>.`,
    `I could not find an exact answer. Email us at <a href="mailto:${SUPPORT.email}">${SUPPORT.email}</a> — we reply during business hours. All contacts are on the <a href="#/support">Support</a> page.`);
  const answer = (text) => {
    say(esc(text), 'me');
    const found = findAnswers(text);
    say(found.length ? found.map((f) => `<b>${esc(L(f.q))}</b><br>${L(f.a)}`).join('<hr>') : fallback());
  };
  let started = false;
  const open = () => {
    panel.classList.remove('hidden'); root.classList.add('open');
    if (!started) {
      started = true;
      say(t('Здравствуйте! Я подскажу, как пользоваться RUIN. Выберите вопрос или напишите свой.', 'Hello! I can help you use RUIN. Pick a question or type your own.'));
      quick.innerHTML = FAQ.slice(0, 6).map((f, i) => `<button type="button" class="pill" data-i="${i}">${esc(L(f.q))}</button>`).join('');
    }
    root.querySelector('.hb-form input').focus();
  };
  const close = () => { panel.classList.add('hidden'); root.classList.remove('open'); };
  root.querySelector('.hb-fab').onclick = () => (panel.classList.contains('hidden') ? open() : close());
  root.querySelector('.hb-x').onclick = close;
  quick.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) answer(L(FAQ[b.dataset.i].q)); });
  root.querySelector('.hb-form').onsubmit = (e) => { e.preventDefault(); const v = e.target.q.value.trim(); if (v) { answer(v); e.target.q.value = ''; } };
  // Ссылки внутри ответов ведут по сайту — панель закрываем
  log.addEventListener('click', (e) => { if (e.target.closest('a[href^="#/"]')) close(); });
}
