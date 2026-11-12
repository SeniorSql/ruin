// Справочные страницы. Тексты соглашений — черновики, до запуска их должен утвердить юрист (L-01, L-54)
import { isEn } from '../i18n.js';
import { contactsHtml, faqHtml } from '../support.js';
import { sb, q } from '../api.js';

const DRAFT = '<div class="banner warn"><b>Черновик.</b>&nbsp;Текст подготовлен как основа и должен быть проверен и утверждён юристом до открытия сервиса для всех.</div>';

// Оператор персональных данных и платформы (данные ЕГРИП)
const OP = 'Индивидуальный предприниматель Исмаилов Этибар Худавердиевич (ИНН 771572170870, ОГРНИП 326774600325074), адрес: г. Москва, Алтуфьевское шоссе, д. 26А, кв. 72';
const MAIL = 'info@ru-in.ru';
const EDITION = '<p class="small muted">Редакция от 11.11.2026</p>';
const EDITION_PRIVACY = '<p class="small muted">Редакция от 12.11.2026 (раздел 10: файлы cookie и Яндекс Метрика)</p>';
const EDITION_TERMS = '<p class="small muted">Редакция от 12.11.2026 (п. 3: срок ответа исполнителя — 2 рабочих часа)</p>';

const PAGES = {
  terms: `<h1>Пользовательское соглашение</h1>${DRAFT}
    <h2>1. О сервисе</h2><p>RUIN — онлайн-площадка, на которой заказчики находят спецтехнику, а владельцы техники (исполнители) публикуют предложения. Платформа не является стороной договора аренды или оказания услуг: договор заключается напрямую между заказчиком и исполнителем.</p>
    <h2>2. Регистрация и организации</h2><p>Пользователь указывает достоверные данные. Действия на платформе совершаются от имени организации (в том числе личного профиля частного лица). Исполнители проходят проверку реквизитов до публикации техники.</p>
    <h2>3. Бронь и сделки</h2><p>Бронь или выбор предложения означает согласие заказчика с условиями, показанными перед подтверждением. Сделка считается подтверждённой после подтверждения исполнителем. Исполнитель отвечает на бронь и заявку на бронь в течение 2 рабочих часов (рабочее время — с 8:00 до 21:00 по московскому времени); неподтверждённая в срок бронь снимается автоматически, заявка без ответа закрывается.</p>
    <h2>4. Оплата</h2><p>На текущем этапе расчёты производятся напрямую между сторонами. Платформа не принимает и не хранит денежные средства и данные банковских карт.</p>
    <h2>5. Отмена</h2><p>Условия отмены указываются в карточке техники и фиксируются в сделке: «Бесплатная отмена» (в любое время до начала работ) или «По согласованию сторон» (порядок и стоимость отмены стороны согласуют между собой). Платформа не участвует в урегулировании споров между сторонами. Поздние отмены и неявки учитываются в репутации сторон.</p>
    <h2>6. Контакты и обход площадки</h2><p>Контакты сторон открываются после подтверждения сделки. Телефоны, почта и ссылки в описаниях и сообщениях до подтверждения скрываются автоматически.</p>
    <h2>7. Контент</h2><p>Исполнитель отвечает за достоверность описаний и права на опубликованные фотографии. Платформа вправе скрывать карточки, нарушающие правила.</p>
    <h2>8. Контакты платформы</h2><p>${OP}. Email: <a href="mailto:${MAIL}">${MAIL}</a>.</p>${EDITION_TERMS}`,
  privacy: `<h1>Политика обработки персональных данных</h1>${DRAFT}
    <h2>1. Оператор</h2><p>${OP}. Email для обращений: <a href="mailto:${MAIL}">${MAIL}</a>.</p>
    <h2>2. Какие данные мы обрабатываем</h2><p>Имя, email, телефон; данные организаций и ИП (наименование, ИНН, ОГРН/ОГРНИП, город, контактное лицо); сведения о технике, заказах и сделках; переписку в чатах сделок; адреса объектов; технические данные входа (дата и время, сведения о браузере).</p>
    <h2>3. Зачем</h2><p>Регистрация и вход; работа каталога, биржи заказов и сделок; связь сторон сделки; уведомления (в том числе в Telegram и MAX — по желанию пользователя); проверка организаций; разбор жалоб и обращений; выполнение требований закона.</p>
    <h2>4. Основания</h2><p>Согласие пользователя (<a href="#/consent">Согласие на обработку персональных данных</a>), договор с пользователем (<a href="#/terms">Пользовательское соглашение</a>), исполнение обязанностей по закону.</p>
    <h2>5. Кто видит ваши данные</h2><p>Контакты и точный адрес объекта видит только контрагент по подтверждённой сделке. Оператор получает доступ к данным только для проверки организаций, модерации и разбора обращений. В Telegram и MAX уведомления отправляются без имён и контактов.</p>
    <h2>6. Где хранятся данные</h2><p>Все персональные данные пользователей (база данных, фотографии, файлы) хранятся и обрабатываются на сервере, расположенном на территории Российской Федерации (хостинг-провайдер AdminVPS), в соответствии с ч. 5 ст. 18 Федерального закона № 152-ФЗ. Трансграничная передача персональных данных не осуществляется.</p>
    <h2>7. Сроки</h2><p>Данные хранятся, пока действует аккаунт, и удаляются в течение 30 дней после отзыва согласия или удаления аккаунта. Сведения о сделках и документы хранятся в сроки, установленные законом (в том числе 5 лет для первичных документов).</p>
    <h2>8. Защита</h2><p>Доступ к данным разграничен по ролям; соединение защищено (HTTPS); пароли хранятся только в виде хеша; важные действия подтверждаются кодом.</p>
    <h2>9. Ваши права</h2><p>Вы можете узнать, какие данные мы обрабатываем, исправить их, отозвать согласие или удалить аккаунт, написав на <a href="mailto:${MAIL}">${MAIL}</a>. Ответим в течение 10 рабочих дней.</p>
    <h2>10. Файлы cookie и хранение данных в браузере</h2><p><b>Необходимые</b> — без них сайт не работает: вход в аккаунт и продление сессии, выбранные тема и язык, черновики форм, ваш выбор по cookie. Хранятся в вашем браузере (cookie и localStorage), никому не передаются, для них согласие не требуется. <b>Аналитические</b> — сервис Яндекс Метрика (ООО «Яндекс», Россия) для статистики посещений: какие страницы открывают, откуда пришли, тип устройства и браузера, примерный регион по IP-адресу. Включаются <b>только если вы нажали «Принять»</b> в уведомлении о cookie; при выборе «Только необходимые» Метрика не загружается. Запись действий на экране (Вебвизор) не используется, введённые в формы данные в Метрику не передаются. Данные обрабатываются Яндексом по его политике конфиденциальности и используются нами только в обезличенном виде для улучшения сайта. Уведомление можно открыть снова по ссылке «Настройки cookie» внизу страницы. Cookie также можно удалить в настройках браузера.</p>${EDITION_PRIVACY}`,
  consent: `<h1>Согласие на обработку персональных данных</h1>${DRAFT}
    <p>Я, регистрируясь на сайте ru-in.ru (RUIN), свободно, своей волей и в своём интересе даю согласие оператору — ${OP} — на обработку моих персональных данных на следующих условиях.</p>
    <h2>1. Цель</h2><p>Регистрация и использование сервиса RUIN: каталог техники, заказы, сделки, связь со сторонами сделки, уведомления, проверка организаций, разбор обращений.</p>
    <h2>2. Какие данные</h2><p>Фамилия, имя, отчество; email; телефон; данные организации или ИП, от имени которой я действую; сведения о технике, заказах и сделках; переписка в чатах сделок; адреса объектов.</p>
    <h2>3. Какие действия</h2><p>Сбор, запись, систематизация, накопление, хранение, уточнение (обновление, изменение), извлечение, использование, передача (предоставление, доступ) контрагенту по подтверждённой сделке, блокирование, удаление, уничтожение — с использованием средств автоматизации и без них.</p>
    <h2>4. Срок и отзыв</h2><p>Согласие действует до его отзыва. Отозвать согласие можно, написав на <a href="mailto:${MAIL}">${MAIL}</a>. После отзыва оператор прекращает обработку и удаляет данные в течение 30 дней, кроме данных, которые нужно хранить по закону.</p>
    <p>Подробнее — в <a href="#/privacy">Политике обработки персональных данных</a>.</p>${EDITION}`,
  help: `<h1>Помощь</h1>
    <h2>Как арендовать технику</h2><ol><li>Найдите технику в каталоге и выберите даты — калькулятор покажет стоимость.</li><li>Нажмите «Забронировать», укажите адрес объекта и подтвердите условия.</li><li>Исполнитель подтвердит бронь в течение 2 рабочих часов (8:00–21:00 МСК). После этого откроются контакты и чат.</li><li>После работ подтвердите завершение сделки.</li></ol>
    <h2>Как получить предложения от нескольких исполнителей</h2><p>Разместите заказ: укажите категорию, даты и адрес. Проверенные исполнители пришлют предложения, их можно сравнить в таблице и выбрать лучшее.</p>
    <h2>Как сдавать свою технику</h2><ol><li>В разделе «Профиль и организации» создайте организацию (ИП, юрлицо или самозанятый) и отправьте её на проверку.</li><li>Добавьте технику: характеристики, минимум 3 фото, цены и условия.</li><li>После проверки организации отправьте карточку на модерацию — после публикации её увидят заказчики.</li><li>Отвечайте на брони и заказы из ленты, держите календарь актуальным.</li></ol>
    <h2>Почему скрыты телефоны</h2><p>Чтобы обе стороны были защищены правилами сделки, контакты открываются после её подтверждения.</p>
    <h2>Связаться с поддержкой</h2><p>Все контакты и ответы на частые вопросы — на странице <a href="#/support">«Поддержка»</a>.</p>`
};

// ---------- English version (for information; the Russian version prevails) ----------
const OP_EN = 'Sole proprietor Etibar Khudaverdiyevich Ismailov (INN 771572170870, OGRNIP 326774600325074), address: Altufyevskoye Shosse 26A, apt. 72, Moscow, Russia';
const DRAFT_EN = '<div class="banner warn"><b>Draft.</b>&nbsp;This text is a working basis and must be reviewed and approved by a lawyer before the service opens to everyone.</div>';
const NOTE_EN = '<div class="banner info">English translation for information only. In case of any discrepancy, the Russian version prevails.</div>';
const EDITION_EN = '<p class="small muted">Version of 11 November 2026</p>';
const EDITION_PRIVACY_EN = '<p class="small muted">Version of 12 November 2026 (section 10: cookies and Yandex Metrica)</p>';

const PAGES_EN = {
  terms: `<h1>Terms of use</h1>${NOTE_EN}${DRAFT_EN}
    <h2>1. About the service</h2><p>RUIN is an online marketplace where customers find construction machinery and owners (providers) publish their offers. The platform is not a party to the rental or service agreement: the agreement is made directly between the customer and the provider.</p>
    <h2>2. Registration and organisations</h2><p>Users provide accurate details. Actions on the platform are performed on behalf of an organisation (including an individual's personal profile). Providers have their company details verified before publishing machinery.</p>
    <h2>3. Bookings and deals</h2><p>Booking or selecting an offer means the customer agrees to the terms shown before confirmation. A deal is confirmed once the provider confirms it. The provider replies to a booking or booking request within 2 working hours (8:00–21:00 Moscow time); a booking not confirmed in time is cancelled automatically and an unanswered request is closed.</p>
    <h2>4. Payment</h2><p>At this stage payments are made directly between the parties. The platform does not accept or hold money or bank card details.</p>
    <h2>5. Cancellation</h2><p>Cancellation terms are shown on the listing and recorded in the deal: “Free cancellation” (any time before work starts) or “By agreement” (the parties agree on cancellation terms and costs). The platform does not take part in settling disputes between the parties. Late cancellations and no-shows affect the parties' reputation.</p>
    <h2>6. Contacts and bypassing the platform</h2><p>The parties' contacts open after the deal is confirmed. Phone numbers, emails and links in descriptions and messages are hidden automatically before that.</p>
    <h2>7. Content</h2><p>The provider is responsible for accurate descriptions and the rights to published photos. The platform may hide listings that break the rules.</p>
    <h2>8. Platform contacts</h2><p>${OP_EN}. Email: <a href="mailto:${MAIL}">${MAIL}</a>.</p>${EDITION_EN}`,
  privacy: `<h1>Personal data processing policy</h1>${NOTE_EN}${DRAFT_EN}
    <h2>1. Operator</h2><p>${OP_EN}. Email for requests: <a href="mailto:${MAIL}">${MAIL}</a>.</p>
    <h2>2. What data we process</h2><p>Name, email, phone; details of organisations and sole proprietors (name, INN, OGRN/OGRNIP, city, contact person); information about machinery, orders and deals; messages in deal chats; site addresses; technical login data (date and time, browser information).</p>
    <h2>3. Why</h2><p>Registration and login; running the catalogue, order exchange and deals; communication between deal parties; notifications (including Telegram and MAX — at the user's choice); verification of organisations; handling complaints and requests; compliance with the law.</p>
    <h2>4. Legal grounds</h2><p>The user's consent (<a href="#/consent">Personal data consent</a>), the agreement with the user (<a href="#/terms">Terms of use</a>), and legal obligations.</p>
    <h2>5. Who sees your data</h2><p>Contacts and the exact site address are visible only to the counterparty of a confirmed deal. The operator accesses data only to verify organisations, moderate and handle requests. Telegram and MAX notifications are sent without names or contacts.</p>
    <h2>6. Where data is stored</h2><p>All users' personal data (database, photos, files) is stored and processed on a server located in the Russian Federation (hosting provider AdminVPS), in accordance with Part 5 of Article 18 of Federal Law 152-FZ. Personal data is not transferred across borders.</p>
    <h2>7. Retention</h2><p>Data is kept while the account exists and deleted within 30 days after consent is withdrawn or the account is deleted. Deal records and documents are kept for the periods required by law (including 5 years for primary documents).</p>
    <h2>8. Protection</h2><p>Access to data is role-based; connections are encrypted (HTTPS); passwords are stored only as hashes; important actions are confirmed with a code.</p>
    <h2>9. Your rights</h2><p>You can find out what data we process, correct it, withdraw your consent or delete your account by writing to <a href="mailto:${MAIL}">${MAIL}</a>. We reply within 10 business days.</p>
    <h2>10. Cookies and browser storage</h2><p><b>Necessary</b> — the site does not work without them: logging in and keeping your session, the chosen theme and language, form drafts, your cookie choice. They are stored in your browser (cookies and localStorage), are not shared with anyone and do not require consent. <b>Analytics</b> — Yandex Metrica (Yandex LLC, Russia) for visit statistics: pages viewed, traffic source, device and browser type, approximate region by IP address. Enabled <b>only if you click “Accept”</b> in the cookie notice; with “Necessary only” Metrica is not loaded. Session recording (Webvisor) is not used and form input is not sent to Metrica. Data is processed by Yandex under its privacy policy and used by us only in aggregated form to improve the site. You can reopen the notice via the “Cookie settings” link at the bottom of the page, or delete cookies in your browser settings.</p>${EDITION_PRIVACY_EN}`,
  consent: `<h1>Consent to personal data processing</h1>${NOTE_EN}${DRAFT_EN}
    <p>By registering on ru-in.ru (RUIN), I freely, of my own will and in my own interest, give my consent to the operator — ${OP_EN} — to process my personal data on the following terms.</p>
    <h2>1. Purpose</h2><p>Registration and use of the RUIN service: machinery catalogue, orders, deals, communication with deal parties, notifications, verification of organisations, handling requests.</p>
    <h2>2. What data</h2><p>Surname, first name, patronymic; email; phone; details of the organisation or sole proprietor I act for; information about machinery, orders and deals; messages in deal chats; site addresses.</p>
    <h2>3. What actions</h2><p>Collection, recording, systematisation, accumulation, storage, clarification (updating, changing), retrieval, use, transfer (provision, access) to the counterparty of a confirmed deal, blocking, deletion and destruction — with or without automation.</p>
    <h2>4. Term and withdrawal</h2><p>The consent is valid until withdrawn. You can withdraw it by writing to <a href="mailto:${MAIL}">${MAIL}</a>. After withdrawal the operator stops processing and deletes the data within 30 days, except data that must be kept by law.</p>
    <p>More details in the <a href="#/privacy">Personal data processing policy</a>.</p>${EDITION_EN}`,
  help: `<h1>Help</h1>
    <h2>How to rent machinery</h2><ol><li>Find a machine in the catalogue and choose dates — the calculator shows the price.</li><li>Click “Book”, enter the site address and confirm the terms.</li><li>The provider confirms the booking within 2 working hours (8:00–21:00 Moscow time). Then contacts and chat open.</li><li>After the work is done, confirm completion of the deal.</li></ol>
    <h2>How to get offers from several providers</h2><p>Post an order: category, dates and address. Verified providers will send offers — compare them in a table and choose the best one.</p>
    <h2>How to rent out your machinery</h2><ol><li>In “Profile and organisations” create an organisation (sole proprietor, company or self-employed) and submit it for review.</li><li>Add machinery: specs, at least 3 photos, prices and terms.</li><li>After verification send the listing to moderation — once published, customers will see it.</li><li>Respond to bookings and orders from the feed and keep your calendar up to date.</li></ol>
    <h2>Why phone numbers are hidden</h2><p>Contacts open after the deal is confirmed so both parties are protected by its terms.</p>
    <h2>Contact support</h2><p>See the <a href="#/support">Support</a> page.</p>`
};

function supportPage() {
  const en = isEn();
  return `<h1>${en ? 'Support' : 'Поддержка'}</h1>
    <p class="muted">${en ? 'Answers to common questions are below. You can also ask the assistant — the round button in the bottom-right corner.' : 'Ниже — ответы на частые вопросы. Можно спросить помощника — круглая кнопка в правом нижнем углу.'}</p>
    <h2>${en ? 'Contacts' : 'Контакты'}</h2>${contactsHtml()}
    <h2>${en ? 'Frequently asked questions' : 'Частые вопросы'}</h2>${faqHtml()}`;
}

// Статьи «Договор аренды спецтехники» и «Сдать спецтехнику в аренду» (12.11.2026): текст один — его делает сервер
// для Яндекса (server/seo_gen.py), здесь берём ту же статью с этой страницы.
async function serverArticle(app, url, crumb) {
  app.innerHTML = '<div class="panel"><div class="skeleton" style="height:240px"></div></div>';
  const r = await fetch(url, { cache: 'no-cache' });
  const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
  const art = doc.querySelector('.prerender article');
  if (!r.ok || !art) throw new Error('no article');
  art.querySelectorAll('script').forEach((s) => s.remove());
  app.innerHTML = `<div class="crumbs"><a href="#/">RUIN</a> › <b>${crumb}</b></div><div class="panel prose">${art.innerHTML}</div>`;
}

async function sdatPage(app) {
  try { await serverArticle(app, '/sdat-spetstehniku-v-arendu/', 'Сдать спецтехнику в аренду'); } catch {
    app.innerHTML = `<div class="panel prose"><h1>Сдать спецтехнику в аренду</h1><p>Разместите технику на RUIN бесплатно и получайте заказы
      из Санкт-Петербурга, Ленинградской области и всей России — оплата напрямую вам.</p>
      <p><a class="btn" href="#/register">Разместить технику бесплатно</a> <a class="btn ghost" href="#/catalog">Посмотреть каталог</a></p></div>`;
  }
}

async function dogovorPage(app) {
  try {
    await serverArticle(app, '/dogovor-arendy-spetstehniki/', 'Договор аренды спецтехники');
  } catch {
    app.innerHTML = `<div class="panel prose"><h1>Договор аренды спецтехники</h1>
      <p><a class="btn" href="files/contract-template.docx" download="Договор аренды спецтехники — форма RUIN.docx">Скачать форму договора</a>
      <a class="btn ghost" href="files/esm-forms.zip" download="Путевые листы ЭСМ-2, ЭСМ-3, ЭСМ-7 (RUIN).zip">Скачать бланки ЭСМ</a></p>
      <p>Те же формы есть в каждой сделке на RUIN, в блоке «Документы»: скачайте, заполните и загрузите подписанные файлы обратно в сделку.</p>
      <p><a class="btn" href="#/catalog">Выбрать технику</a> <a class="btn ghost" href="#/orders/new">Разместить заказ</a></p></div>`;
  }
}

// ---------- «О компании» (#/about, 12.11.2026) ----------
// Оформление как у главной: баннер с фото (день/ночь — css .hero-img), карточки с иконками, шаги, живые цифры, контакты.
// Тот же текст для Яндекса делает сервер: server/seo_gen.py → /o-kompanii/ (ABOUT_*). Меняете текст — поменяйте и там.
const AI = (d) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const AB_IC = {
  shield: AI('<path d="m12 3 8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/><path d="m8 12 2.5 2.5L16 9"/>'),
  hand: AI('<path d="M7 11V6a2 2 0 0 1 4 0v5M11 10V4a2 2 0 0 1 4 0v6M15 10V6a2 2 0 0 1 4 0v8a7 7 0 0 1-7 7h-1a7 7 0 0 1-6-3.5L3 14a2 2 0 0 1 3.4-2L7 13"/>'),
  cal: AI('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M8 14h2M14 14h2M8 17h2"/>'),
  doc: AI('<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M8 13h8M8 17h5"/>'),
  bell: AI('<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>'),
  gauge: AI('<path d="M3.5 17a9 9 0 1 1 17 0"/><path d="m12 13 4-5"/><circle cx="12" cy="13" r="1.4"/><path d="M6 21h12"/>'),
  map: AI('<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>'),
  target: AI('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>'),
  mail: AI('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'),
  phone: AI('<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2"/>')
};
const plural3 = (n, a, b, c) => (n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? b : c);

async function aboutPage(app) {
  const card = (ic, title, text) => `<div class="ab-card"><span class="ab-ic">${AB_IC[ic]}</span><b>${title}</b><p>${text}</p></div>`;
  const steps = (list) => `<ol class="ab-steps">${list.map(([b, s]) => `<li><b>${b}</b><span>${s}</span></li>`).join('')}</ol>`;
  app.innerHTML = `
  <section class="hero ab-hero">
    <div class="hero-copy">
      <div class="eyebrow ab-eyebrow">О КОМПАНИИ</div>
      <h1>RUIN — аренда <em>спецтехники</em></h1>
      <p>Маркетплейс, на котором заказчики находят технику, а владельцы техники — заказы. Санкт-Петербург, Ленинградская область и вся Россия.</p>
      <div class="hero-cta"><a class="btn" href="#/catalog">Каталог техники <span class="arr">→</span></a>
        <a class="btn ghost hero-ghost" href="#/sdat">Разместить технику</a></div>
    </div>
    <div class="hero-visual" role="img" aria-label="Спецтехника на объекте"><div class="hero-img day"></div><div class="hero-img night"></div></div>
  </section>

  <div class="ab-two">
    <div class="ab-block"><span class="ab-ic big">${AB_IC.target}</span><div>
      <h2>Кто мы</h2>
      <p>RUIN — онлайн-площадка аренды спецтехники: экскаваторов, автокранов, автовышек, манипуляторов, самосвалов, погрузчиков, катков и другой техники. Мы начали с Санкт-Петербурга и Ленинградской области и работаем по всей России — техника может приехать в любой город.</p></div></div>
    <div class="ab-block"><span class="ab-ic big">${AB_IC.hand}</span><div>
      <h2>Наша миссия</h2>
      <p>Сделать аренду техники быстрой и честной: без бесконечных звонков, посредников и наценок. Заказчик сразу видит цены и свободные даты, исполнитель получает заказы напрямую и без комиссии — сейчас площадка бесплатна для всех.</p></div></div>
  </div>

  <div class="ab-stats" id="abStats">
    <div class="ab-stat"><b data-k="eq">—</b><span>единиц техники в каталоге</span></div>
    <div class="ab-stat"><b data-k="orgs">—</b><span>исполнителей с техникой</span></div>
    <div class="ab-stat"><b data-k="cities">—</b><span>городов, где стоит техника</span></div>
    <div class="ab-stat"><b>0 ₽</b><span>за размещение и заказы</span></div>
  </div>

  <div class="section-head"><div><div class="eyebrow">КАК ЭТО РАБОТАЕТ</div><h2>Просто для обеих сторон</h2></div></div>
  <div class="ab-two">
    <div class="ab-block col"><h3>${AB_IC.cal} Заказчику</h3>${steps([
      ['Найдите технику', 'в каталоге — по виду, городу, цене и свободным датам'],
      ['Забронируйте', 'онлайн или разместите заказ — исполнители сами пришлют предложения'],
      ['Работайте по сделке', 'контакты, договор, путевые листы и акт — в одном месте'],
      ['Оставьте отзыв', 'и помогите другим выбрать надёжного исполнителя']])}
      <a class="btn" href="#/catalog">Выбрать технику</a></div>
    <div class="ab-block col"><h3>${AB_IC.gauge} Исполнителю</h3>${steps([
      ['Зарегистрируйтесь', 'и создайте организацию — ООО, ИП или самозанятый'],
      ['Пройдите проверку', 'администратор подтвердит реквизиты — заказчики доверяют больше'],
      ['Добавьте технику', 'фото, характеристики, цена за час или смену, календарь занятости'],
      ['Получайте заказы', 'бронь из каталога и задачи с биржи заказов — напрямую, без посредников']])}
      <a class="btn" href="#/sdat">Разместить технику</a></div>
  </div>

  <div class="section-head"><div><div class="eyebrow">ПРЕИМУЩЕСТВА</div><h2>Почему RUIN</h2></div></div>
  <div class="ab-grid">
    ${card('shield', 'Проверенные исполнители', 'Организации проходят проверку реквизитов до публикации техники.')}
    ${card('hand', 'Без посредников', 'Договариваетесь и платите напрямую. Контакты открываются после подтверждения сделки.')}
    ${card('cal', 'Бронь онлайн', 'Свободные даты видны в карточке техники — бронь без лишних звонков.')}
    ${card('doc', 'Документы в сделке', 'Форма договора, путевые листы ЭСМ, заявка и акт выполненных работ.')}
    ${card('bell', 'Уведомления', 'О новых заказах и бронях — в Telegram, MAX или на почту.')}
    ${card('map', 'Вся Россия', 'Основа — Петербург и Ленобласть, но техника может поехать в любой город.')}
  </div>

  <div class="ab-contacts">
    <div><div class="eyebrow">КОНТАКТЫ</div><h2>Свяжитесь с нами</h2><p class="muted">Ответим на вопросы о площадке, поможем разместить технику или подобрать исполнителя.</p></div>
    <div class="ab-contact-list">
      <a class="ab-contact" href="mailto:${MAIL}"><span class="ab-ic">${AB_IC.mail}</span><span><small>Почта</small><b>${MAIL}</b></span></a>
      <a class="ab-contact" href="tel:+79161454220"><span class="ab-ic">${AB_IC.phone}</span><span><small>Телефон</small><b>+7 916 145-42-20</b></span></a>
    </div>
  </div>`;

  // Живые цифры — из каталога (опубликованная техника)
  try {
    const rows = await q(sb.from('equipment').select('org_id,city').eq('status', 'PUBLISHED').limit(5000));
    const vals = { eq: rows.length, orgs: new Set(rows.map((r) => r.org_id)).size, cities: new Set(rows.map((r) => r.city).filter(Boolean)).size };
    const box = app.querySelector('#abStats');
    if (!box) return;
    box.querySelector('[data-k="eq"]').textContent = vals.eq;
    box.querySelector('[data-k="orgs"]').textContent = vals.orgs;
    box.querySelector('[data-k="cities"]').textContent = vals.cities;
    const lbl = box.querySelectorAll('.ab-stat span');
    lbl[0].textContent = `${plural3(vals.eq, 'единица', 'единицы', 'единиц')} техники в каталоге`;
    lbl[1].textContent = `${plural3(vals.orgs, 'исполнитель', 'исполнителя', 'исполнителей')} с техникой`;
    lbl[2].textContent = `${plural3(vals.cities, 'город', 'города', 'городов')}, где стоит техника`;
  } catch { app.querySelector('#abStats')?.remove(); }
}

export async function render(app, _p, _q, pattern) {
  if (pattern === 'about') { await aboutPage(app); return; }
  if (pattern === 'support') { app.innerHTML = `<div class="panel prose">${supportPage()}</div>`; return; }
  if (pattern === 'dogovor') { await dogovorPage(app); return; }
  if (pattern === 'sdat') { await sdatPage(app); return; }
  const html = (isEn() && PAGES_EN[pattern]) || PAGES[pattern];
  app.innerHTML = `<div class="panel prose">${html}</div>`;
}
