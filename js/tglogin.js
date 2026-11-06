// Подключение уведомлений Telegram в один клик: официальное окно Telegram «Разрешить сайту присылать сообщения».
// Клиенту не нужно искать бота и нажимать «Старт». Подпись Telegram проверяет сервер (функция tg-bot).
import { sb, state } from './api.js';

let botId = null, scriptP = null, prepP = null;

async function call(body) {
  const { data, error } = await sb.functions.invoke('tg-bot', { body });
  let msg = data?.error;
  if (error) { try { msg = (await error.context.json()).error; } catch { msg = error.message; } }
  if (msg) throw new Error(msg);
  return data;
}

function loadWidget() {
  if (window.Telegram?.Login) return Promise.resolve();
  if (!scriptP) scriptP = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://telegram.org/js/telegram-widget.js?22';
    s.async = true;
    s.onload = resolve;
    s.onerror = () => { scriptP = null; reject(new Error('Не удалось загрузить Telegram. Проверьте интернет')); };
    document.head.appendChild(s);
  });
  return scriptP;
}

// Заранее загрузить всё нужное, чтобы окно Telegram открылось сразу по нажатию (иначе браузер его заблокирует)
export function prepareTelegram() {
  if (!prepP) prepP = Promise.all([call({ action: 'tg_info' }).then((r) => { botId = r.bot_id; }), loadWidget()])
    .catch((e) => { prepP = null; throw e; });
  return prepP;
}

// Вызывать прямо из обработчика нажатия. true — подключено, false — человек закрыл окно.
export async function connectTelegram() {
  if (!botId || !window.Telegram?.Login) await prepareTelegram();
  if (!botId) throw new Error('Telegram-бот ещё не настроен');
  const user = await new Promise((resolve) => window.Telegram.Login.auth({ bot_id: botId, request_access: 'write', lang: 'ru' }, resolve));
  if (!user) return false;
  await call({ action: 'tg_login', tg: user });
  state.msgrLinked = true;
  return true;
}
