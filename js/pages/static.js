// Справочные страницы. Тексты соглашений — черновики, до запуска их должен утвердить юрист (L-01, L-54)
import { isEn } from '../i18n.js';
import { contactsHtml, faqHtml } from '../support.js';

const DRAFT = '<div class="banner warn"><b>Черновик.</b>&nbsp;Текст подготовлен как основа и должен быть проверен и утверждён юристом до открытия сервиса для всех.</div>';

// Оператор персональных данных и платформы (данные ЕГРИП)
const OP = 'Индивидуальный предприниматель Исмаилов Этибар Худавердиевич (ИНН 771572170870, ОГРНИП 326774600325074), адрес: г. Москва, Алтуфьевское шоссе, д. 26А, кв. 72';
const MAIL = 'info@ru-in.ru';
const EDITION = '<p class="small muted">Редакция от 11.11.2026</p>';

const PAGES = {
  terms: `<h1>Пользовательское соглашение</h1>${DRAFT}
    <h2>1. О сервисе</h2><p>RUIN — онлайн-площадка, на которой заказчики находят спецтехнику, а владельцы техники (исполнители) публикуют предложения. Платформа не является стороной договора аренды или оказания услуг: договор заключается напрямую между заказчиком и исполнителем.</p>
    <h2>2. Регистрация и организации</h2><p>Пользователь указывает достоверные данные. Действия на платформе совершаются от имени организации (в том числе личного профиля частного лица). Исполнители проходят проверку реквизитов до публикации техники.</p>
    <h2>3. Бронь и сделки</h2><p>Бронь или выбор предложения означает согласие заказчика с условиями, показанными перед подтверждением. Сделка считается подтверждённой после подтверждения исполнителем. Неподтверждённая в течение 12 часов бронь снимается автоматически.</p>
    <h2>4. Оплата</h2><p>На текущем этапе расчёты производятся напрямую между сторонами. Платформа не принимает и не хранит денежные средства и данные банковских карт.</p>
    <h2>5. Отмена</h2><p>Условия отмены указываются в карточке техники и фиксируются в сделке: «Бесплатная отмена» (в любое время до начала работ) или «По согласованию сторон» (порядок и стоимость отмены стороны согласуют между собой). Платформа не участвует в урегулировании споров между сторонами. Поздние отмены и неявки учитываются в репутации сторон.</p>
    <h2>6. Контакты и обход площадки</h2><p>Контакты сторон открываются после подтверждения сделки. Телефоны, почта и ссылки в описаниях и сообщениях до подтверждения скрываются автоматически.</p>
    <h2>7. Контент</h2><p>Исполнитель отвечает за достоверность описаний и права на опубликованные фотографии. Платформа вправе скрывать карточки, нарушающие правила.</p>
    <h2>8. Контакты платформы</h2><p>${OP}. Email: <a href="mailto:${MAIL}">${MAIL}</a>.</p>${EDITION}`,
  privacy: `<h1>Политика обработки персональных данных</h1>${DRAFT}
    <h2>1. Оператор</h2><p>${OP}. Email для обращений: <a href="mailto:${MAIL}">${MAIL}</a>.</p>
    <h2>2. Какие данные мы обрабатываем</h2><p>Имя, email, телефон; данные организаций и ИП (наименование, ИНН, ОГРН/ОГРНИП, город, контактное лицо); сведения о технике, заказах и сделках; переписку в чатах сделок; адреса объектов; технические данные входа (дата и время, сведения о браузере).</p>
    <h2>3. Зачем</h2><p>Регистрация и вход; работа каталога, биржи заказов и сделок; связь сторон сделки; уведомления (в том числе в Telegram и MAX — по желанию пользователя); проверка организаций; разбор жалоб и обращений; выполнение требований закона.</p>
    <h2>4. Основания</h2><p>Согласие пользователя (<a href="#/consent">Согласие на обработку персональных данных</a>), договор с пользователем (<a href="#/terms">Пользовательское соглашение</a>), исполнение обязанностей по закону.</p>
    <h2>5. Кто видит ваши данные</h2><p>Контакты и точный адрес объекта видит только контрагент по подтверждённой сделке. Оператор получает доступ к данным только для проверки организаций, модерации и разбора обращений. В Telegram и MAX уведомления отправляются без имён и контактов.</p>
    <h2>6. Где хранятся данные</h2><p>Все персональные данные пользователей (база данных, фотографии, файлы) хранятся и обрабатываются на сервере, расположенном на территории Российской Федерации (хостинг-провайдер AdminVPS), в соответствии с ч. 5 ст. 18 Федерального закона № 152-ФЗ. Трансграничная передача персональных данных не осуществляется.</p>
    <h2>7. Сроки</h2><p>Данные хранятся, пока действует аккаунт, и удаляются в течение 30 дней после отзыва согласия или удаления аккаунта. Сведения о сделках и документы хранятся в сроки, установленные законом (в том числе 5 лет для первичных документов).</p>
    <h2>8. Защита</h2><p>Доступ к данным разграничен по ролям; соединение защищено (HTTPS); пароли хранятся только в виде хеша; важные действия подтверждаются кодом.</p>
    <h2>9. Ваши права</h2><p>Вы можете узнать, какие данные мы обрабатываем, исправить их, отозвать согласие или удалить аккаунт, написав на <a href="mailto:${MAIL}">${MAIL}</a>. Ответим в течение 10 рабочих дней.</p>${EDITION}`,
  consent: `<h1>Согласие на обработку персональных данных</h1>${DRAFT}
    <p>Я, регистрируясь на сайте ru-in.ru (RUIN), свободно, своей волей и в своём интересе даю согласие оператору — ${OP} — на обработку моих персональных данных на следующих условиях.</p>
    <h2>1. Цель</h2><p>Регистрация и использование сервиса RUIN: каталог техники, заказы, сделки, связь со сторонами сделки, уведомления, проверка организаций, разбор обращений.</p>
    <h2>2. Какие данные</h2><p>Фамилия, имя, отчество; email; телефон; данные организации или ИП, от имени которой я действую; сведения о технике, заказах и сделках; переписка в чатах сделок; адреса объектов.</p>
    <h2>3. Какие действия</h2><p>Сбор, запись, систематизация, накопление, хранение, уточнение (обновление, изменение), извлечение, использование, передача (предоставление, доступ) контрагенту по подтверждённой сделке, блокирование, удаление, уничтожение — с использованием средств автоматизации и без них.</p>
    <h2>4. Срок и отзыв</h2><p>Согласие действует до его отзыва. Отозвать согласие можно, написав на <a href="mailto:${MAIL}">${MAIL}</a>. После отзыва оператор прекращает обработку и удаляет данные в течение 30 дней, кроме данных, которые нужно хранить по закону.</p>
    <p>Подробнее — в <a href="#/privacy">Политике обработки персональных данных</a>.</p>${EDITION}`,
  help: `<h1>Помощь</h1>
    <h2>Как арендовать технику</h2><ol><li>Найдите технику в каталоге и выберите даты — калькулятор покажет стоимость.</li><li>Нажмите «Забронировать», укажите адрес объекта и подтвердите условия.</li><li>Исполнитель подтвердит бронь в течение 12 часов. После этого откроются контакты и чат.</li><li>После работ подтвердите завершение сделки.</li></ol>
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

const PAGES_EN = {
  terms: `<h1>Terms of use</h1>${NOTE_EN}${DRAFT_EN}
    <h2>1. About the service</h2><p>RUIN is an online marketplace where customers find construction machinery and owners (providers) publish their offers. The platform is not a party to the rental or service agreement: the agreement is made directly between the customer and the provider.</p>
    <h2>2. Registration and organisations</h2><p>Users provide accurate details. Actions on the platform are performed on behalf of an organisation (including an individual's personal profile). Providers have their company details verified before publishing machinery.</p>
    <h2>3. Bookings and deals</h2><p>Booking or selecting an offer means the customer agrees to the terms shown before confirmation. A deal is confirmed once the provider confirms it. A booking not confirmed within 12 hours is cancelled automatically.</p>
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
    <h2>9. Your rights</h2><p>You can find out what data we process, correct it, withdraw your consent or delete your account by writing to <a href="mailto:${MAIL}">${MAIL}</a>. We reply within 10 business days.</p>${EDITION_EN}`,
  consent: `<h1>Consent to personal data processing</h1>${NOTE_EN}${DRAFT_EN}
    <p>By registering on ru-in.ru (RUIN), I freely, of my own will and in my own interest, give my consent to the operator — ${OP_EN} — to process my personal data on the following terms.</p>
    <h2>1. Purpose</h2><p>Registration and use of the RUIN service: machinery catalogue, orders, deals, communication with deal parties, notifications, verification of organisations, handling requests.</p>
    <h2>2. What data</h2><p>Surname, first name, patronymic; email; phone; details of the organisation or sole proprietor I act for; information about machinery, orders and deals; messages in deal chats; site addresses.</p>
    <h2>3. What actions</h2><p>Collection, recording, systematisation, accumulation, storage, clarification (updating, changing), retrieval, use, transfer (provision, access) to the counterparty of a confirmed deal, blocking, deletion and destruction — with or without automation.</p>
    <h2>4. Term and withdrawal</h2><p>The consent is valid until withdrawn. You can withdraw it by writing to <a href="mailto:${MAIL}">${MAIL}</a>. After withdrawal the operator stops processing and deletes the data within 30 days, except data that must be kept by law.</p>
    <p>More details in the <a href="#/privacy">Personal data processing policy</a>.</p>${EDITION_EN}`,
  help: `<h1>Help</h1>
    <h2>How to rent machinery</h2><ol><li>Find a machine in the catalogue and choose dates — the calculator shows the price.</li><li>Click “Book”, enter the site address and confirm the terms.</li><li>The provider confirms the booking within 12 hours. Then contacts and chat open.</li><li>After the work is done, confirm completion of the deal.</li></ol>
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

export function render(app, _p, _q, pattern) {
  if (pattern === 'support') { app.innerHTML = `<div class="panel prose">${supportPage()}</div>`; return; }
  const html = (isEn() && PAGES_EN[pattern]) || PAGES[pattern];
  app.innerHTML = `<div class="panel prose">${html}</div>`;
}
