// Короткое знакомство с сайтом для нового пользователя: 3 шага, показывается один раз
import { state } from './api.js';
import { modal } from './ui.js';
import { go } from './app.js';

const KEY = () => 'ruin.onboarded:' + (state.user?.id || 'guest');

const PATHS = {
  customer: {
    title: 'Как арендовать технику',
    steps: [
      ['Найдите технику', 'В каталоге — с ценой и свободными датами. Или разместите заказ, и исполнители сами пришлют предложения.'],
      ['Забронируйте', 'Бронь бесплатна. Исполнитель подтверждает её в течение 12 часов.'],
      ['Договоритесь в чате сделки', 'После подтверждения откроются контакты и адрес объекта.'],
      ['Примите работу', 'Подтвердите завершение и оставьте отзыв — это помогает другим.']
    ],
    actions: [['#/catalog', 'Открыть каталог', ''], ['#/orders/new', 'Разместить заказ', 'ghost']]
  },
  provider: {
    title: 'Как сдавать технику',
    steps: [
      ['Создайте организацию', 'Укажите ИНН и отправьте на проверку — обычно до 1 рабочего дня.'],
      ['Добавьте технику', 'Фото, цены, условия. Карточка появится в каталоге после модерации.'],
      ['Получайте заказы', 'Брони приходят в «Сделки», заказы заказчиков — в «Ленту заказов». Отвечайте быстро.'],
      ['Ведите работу', 'На «Рабочем столе» — все сделки по этапам, продления, напоминания и загрузка техники.']
    ],
    actions: [['#/account', 'Создать организацию', ''], ['#/feed', 'Лента заказов', 'ghost']]
  }
};

// Показать новому пользователю (аккаунт моложе 14 дней), если ещё не видел в этом браузере
export function maybeShowOnboarding() {
  if (!state.user) return;
  try { if (localStorage.getItem(KEY())) return; } catch { return; }
  const age = Date.now() - new Date(state.user.created_at || 0).getTime();
  if (age > 14 * 864e5) { try { localStorage.setItem(KEY(), '1'); } catch {} return; }
  showOnboarding();
}

export function showOnboarding() {
  const done = () => { try { localStorage.setItem(KEY(), '1'); } catch {} };
  let role = state.org?.can_provide && !state.org?.can_order ? 'provider' : 'customer';
  const m = modal('<div class="onb"></div>', { onClose: done });
  const box = m.el.querySelector('.onb');
  const dots = (i) => `<div class="onb-dots">${[0, 1, 2].map((k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>`;

  const step1 = () => {
    box.innerHTML = `${dots(0)}<h2>Добро пожаловать в RUIN</h2>
      <p>Здесь арендуют спецтехнику напрямую у проверенных исполнителей: экскаваторы, краны, самосвалы и другую.</p>
      <p class="muted small" style="margin-bottom:10px">Что вы хотите делать? Это можно поменять в любой момент.</p>
      <div class="onb-roles">
        <button class="onb-role" data-r="customer"><b>Мне нужна техника</b><span>Найти, забронировать, заказать</span></button>
        <button class="onb-role" data-r="provider"><b>Я сдаю технику</b><span>Получать брони и заказы</span></button>
      </div>
      <div class="onb-foot"><button class="btn ghost sm" data-skip>Пропустить</button></div>`;
    box.querySelectorAll('[data-r]').forEach((b) => b.onclick = () => { role = b.dataset.r; step2(); });
    box.querySelector('[data-skip]').onclick = () => m.close();
  };

  const step2 = () => {
    const p = PATHS[role];
    box.innerHTML = `${dots(1)}<h2>${p.title}</h2>
      <ol class="onb-steps">${p.steps.map(([t, d]) => `<li><b>${t}</b><span>${d}</span></li>`).join('')}</ol>
      <div class="onb-foot"><button class="btn ghost sm" data-back>Назад</button><button class="btn" data-next>Дальше</button></div>`;
    box.querySelector('[data-back]').onclick = step1;
    box.querySelector('[data-next]').onclick = step3;
  };

  const step3 = () => {
    const p = PATHS[role];
    box.innerHTML = `${dots(2)}<h2>Главное правило</h2>
      <ul class="onb-rules">
        <li>Переписка и контакты открываются <b>только после оформления сделки</b> — телефоны в тексте скрываются автоматически.</li>
        <li>Платформа <b>не берёт деньги</b>: оплата напрямую исполнителю, по договорённости.</li>
        <li>Все шаги видны в карточке сделки в блоке <b>«Что дальше»</b> — там всегда понятно, чья очередь действовать.</li>
      </ul>
      <div class="onb-foot"><button class="btn ghost sm" data-back>Назад</button>
        ${p.actions.map(([h, t, c]) => `<button class="btn ${c}" data-go="${h}">${t}</button>`).join('')}</div>
      <p class="small muted" style="margin:12px 0 0">Вернуться к подсказке: «Как пользоваться» внизу страницы.</p>`;
    box.querySelector('[data-back]').onclick = step2;
    box.querySelectorAll('[data-go]').forEach((b) => b.onclick = () => { m.close(); go(b.dataset.go); });
  };

  step1();
}
