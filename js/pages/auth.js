// Вход, регистрация, восстановление и смена пароля (SCR-IDN-01..03)
import { sb, state, loadMe, refreshCounters, humanError, CONSENT_VERSION } from '../api.js';
import { esc, toast, busy } from '../ui.js';
import { go, refreshShell } from '../app.js';

const base = () => location.origin + location.pathname;

export async function render(app, _p, query, pattern) {
  const next = query.next || '#/';
  if (pattern === 'login') return login(app, next);
  if (pattern === 'register') return register(app, next);
  if (pattern === 'forgot') return forgot(app);
  if (pattern === 'reset') return reset(app);
}

const shell = (title, sub, body) => `<div class="auth-box"><div class="panel">
  <h1 style="font-size:26px">${title}</h1>${sub ? `<p class="muted" style="margin:6px 0 18px">${sub}</p>` : ''}${body}</div></div>`;

function showErr(form, msg) {
  const el = form.querySelector('.form-error');
  el.textContent = msg; el.classList.remove('hidden');
}

function login(app, next) {
  if (state.user) return go(next);
  app.innerHTML = shell('Вход', 'Рады видеть вас снова', `
    <form id="f">
      <div class="form-error hidden"></div>
      <label class="f"><span>Email</span><input class="inp" type="email" name="email" required autocomplete="email"></label>
      <label class="f"><span>Пароль</span><input class="inp" type="password" name="password" required autocomplete="current-password"></label>
      <button class="btn wide">Войти</button>
    </form>
    <div class="actions" style="justify-content:space-between;margin-top:14px">
      <a href="#/forgot">Забыли пароль?</a><a href="#/register${next !== '#/' ? '?next=' + encodeURIComponent(next) : ''}">Регистрация</a></div>`);
  app.querySelector('#f').onsubmit = (e) => {
    e.preventDefault();
    const f = e.target;
    busy(f.querySelector('button'), async () => {
      const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
      if (error) return showErr(f, humanError(error));
      await loadMe(); await refreshCounters(); refreshShell();
      toast('Вы вошли'); go(next);
    });
  };
}

function register(app, next) {
  if (state.user) return go(next);
  app.innerHTML = shell('Регистрация', 'Создайте аккаунт, чтобы бронировать технику, размещать заказы или сдавать свою технику.', `
    <form id="f">
      <div class="form-error hidden"></div>
      <label class="f"><span>Как вас зовут <i>*</i></span><input class="inp" name="name" required maxlength="100" autocomplete="name"></label>
      <label class="f"><span>Email <i>*</i></span><input class="inp" type="email" name="email" required autocomplete="email"></label>
      <label class="f"><span>Телефон</span><input class="inp" type="tel" name="phone" placeholder="+7 (999) 123-45-67" autocomplete="tel"></label>
      <label class="f"><span>Пароль <i>*</i></span><input class="inp" type="password" name="password" required minlength="10" autocomplete="new-password">
        <div class="hint">Минимум 10 символов. Лучше фраза из нескольких слов.</div></label>
      <label class="check"><input type="checkbox" name="terms" required><span>Принимаю <a href="#/terms" target="_blank">пользовательское соглашение</a></span></label>
      <label class="check"><input type="checkbox" name="pd" required><span>Даю <a href="#/consent" target="_blank">согласие на обработку персональных данных</a> и ознакомлен(а) с <a href="#/privacy" target="_blank">политикой</a></span></label>
      <button class="btn wide">Создать аккаунт</button>
    </form>
    <p class="small muted" style="margin-top:14px">Уже есть аккаунт? <a href="#/login">Войти</a></p>`);
  app.querySelector('#f').onsubmit = (e) => {
    e.preventDefault();
    const f = e.target;
    if (f.password.value.length < 10) return showErr(f, 'Пароль должен быть не короче 10 символов');
    busy(f.querySelector('button'), async () => {
      const { data, error } = await sb.auth.signUp({
        email: f.email.value.trim(), password: f.password.value,
        options: { emailRedirectTo: base(), data: { full_name: f.name.value.trim(), phone: f.phone.value.trim(), consent_version: CONSENT_VERSION } }
      });
      if (error) return showErr(f, humanError(error));
      if (data.session) {
        await loadMe(); await refreshCounters(); refreshShell();
        toast('Аккаунт создан'); go(next);
      } else {
        app.innerHTML = shell('Проверьте почту', '', `<p>Мы отправили письмо на <b>${esc(f.email.value)}</b>. Перейдите по ссылке из письма, чтобы подтвердить email и войти.</p>
          <p class="small muted">Письма нет? Проверьте папку «Спам» или <a href="#/register">попробуйте ещё раз</a>.</p>`);
      }
    });
  };
}

function forgot(app) {
  app.innerHTML = shell('Восстановление доступа', 'Пришлём ссылку для смены пароля.', `
    <form id="f"><div class="form-error hidden"></div>
      <label class="f"><span>Email</span><input class="inp" type="email" name="email" required></label>
      <button class="btn wide">Отправить ссылку</button></form>
    <p class="small muted" style="margin-top:14px"><a href="#/login">Вернуться ко входу</a></p>`);
  app.querySelector('#f').onsubmit = (e) => {
    e.preventDefault();
    const f = e.target;
    busy(f.querySelector('button'), async () => {
      const { error } = await sb.auth.resetPasswordForEmail(f.email.value.trim(), { redirectTo: base() });
      if (error && /rate limit/i.test(error.message)) return showErr(f, humanError(error));
      // Ответ одинаковый для существующих и несуществующих адресов (BR-IDN-07)
      app.innerHTML = shell('Проверьте почту', '', '<p>Если аккаунт с таким email существует, мы отправили на него ссылку для смены пароля.</p>');
    });
  };
}

function reset(app) {
  if (!state.user) {
    app.innerHTML = shell('Ссылка недействительна', '', '<p>Ссылка устарела или уже использована. <a href="#/forgot">Запросите новую</a>.</p>');
    return;
  }
  app.innerHTML = shell('Новый пароль', 'Придумайте новый пароль. Все остальные сеансы будут завершены.', `
    <form id="f"><div class="form-error hidden"></div>
      <label class="f"><span>Новый пароль</span><input class="inp" type="password" name="password" required minlength="10" autocomplete="new-password"></label>
      <button class="btn wide">Сохранить</button></form>`);
  app.querySelector('#f').onsubmit = (e) => {
    e.preventDefault();
    const f = e.target;
    busy(f.querySelector('button'), async () => {
      const { error } = await sb.auth.updateUser({ password: f.password.value });
      if (error) return showErr(f, humanError(error));
      await sb.auth.signOut({ scope: 'others' }); // BR-IDN-06
      toast('Пароль изменён'); go('#/');
    });
  };
}
