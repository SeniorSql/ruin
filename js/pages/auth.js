// Вход, регистрация, восстановление и смена пароля (SCR-IDN-01..03)
import { sb, state, loadMe, refreshCounters, humanError, CONSENT_VERSION } from '../api.js';
import { esc, toast, busy } from '../ui.js';
import { go, refreshShell } from '../app.js';
import { t } from '../i18n.js';

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
  app.innerHTML = shell(t('Вход', 'Log in'), t('Рады видеть вас снова', 'Welcome back'), `
    <form id="f">
      <div class="form-error hidden"></div>
      <label class="f"><span>Email</span><input class="inp" type="email" name="email" required autocomplete="email"></label>
      <label class="f"><span>${t('Пароль', 'Password')}</span><input class="inp" type="password" name="password" required autocomplete="current-password"></label>
      <button class="btn wide">${t('Войти', 'Log in')}</button>
    </form>
    <div class="actions" style="justify-content:space-between;margin-top:14px">
      <a href="#/forgot">${t('Забыли пароль?', 'Forgot password?')}</a><a href="#/register${next !== '#/' ? '?next=' + encodeURIComponent(next) : ''}">${t('Регистрация', 'Sign up')}</a></div>`);
  app.querySelector('#f').onsubmit = (e) => {
    e.preventDefault();
    const f = e.target;
    busy(f.querySelector('button'), async () => {
      const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
      if (error) return showErr(f, humanError(error));
      await loadMe(); await refreshCounters(); refreshShell();
      toast(t('Вы вошли', 'You are logged in')); go(next);
    });
  };
}

function register(app, next) {
  if (state.user) return go(next);
  app.innerHTML = shell(t('Регистрация', 'Sign up'), t('Создайте аккаунт, чтобы бронировать технику, размещать заказы или сдавать свою технику.', 'Create an account to book machinery, post orders or rent out your own machines.'), `
    <form id="f">
      <div class="form-error hidden"></div>
      <label class="f"><span>${t('Как вас зовут', 'Your name')} <i>*</i></span><input class="inp" name="name" required maxlength="100" autocomplete="name"></label>
      <label class="f"><span>Email <i>*</i></span><input class="inp" type="email" name="email" required autocomplete="email"></label>
      <label class="f"><span>${t('Телефон', 'Phone')}</span><input class="inp" type="tel" name="phone" placeholder="+7 (999) 123-45-67" autocomplete="tel"></label>
      <label class="f"><span>${t('Пароль', 'Password')} <i>*</i></span><input class="inp" type="password" name="password" required minlength="10" autocomplete="new-password">
        <div class="hint">${t('Минимум 10 символов. Лучше фраза из нескольких слов.', 'At least 10 characters. A phrase of several words works best.')}</div></label>
      <label class="check"><input type="checkbox" name="terms" required><span>${t('Принимаю <a href="#/terms" target="_blank">пользовательское соглашение</a>', 'I accept the <a href="#/terms" target="_blank">terms of use</a>')}</span></label>
      <label class="check"><input type="checkbox" name="pd" required><span>${t('Даю <a href="#/consent" target="_blank">согласие на обработку персональных данных</a> и ознакомлен(а) с <a href="#/privacy" target="_blank">политикой</a>', 'I give my <a href="#/consent" target="_blank">consent to personal data processing</a> and have read the <a href="#/privacy" target="_blank">privacy policy</a>')}</span></label>
      <button class="btn wide">${t('Создать аккаунт', 'Create account')}</button>
    </form>
    <p class="small muted" style="margin-top:14px">${t('Уже есть аккаунт?', 'Already have an account?')} <a href="#/login">${t('Войти', 'Log in')}</a></p>`);
  app.querySelector('#f').onsubmit = (e) => {
    e.preventDefault();
    const f = e.target;
    if (f.password.value.length < 10) return showErr(f, t('Пароль должен быть не короче 10 символов', 'The password must be at least 10 characters'));
    busy(f.querySelector('button'), async () => {
      const { data, error } = await sb.auth.signUp({
        email: f.email.value.trim(), password: f.password.value,
        options: { emailRedirectTo: base(), data: { full_name: f.name.value.trim(), phone: f.phone.value.trim(), consent_version: CONSENT_VERSION } }
      });
      if (error) return showErr(f, humanError(error));
      if (data.session) {
        await loadMe(); await refreshCounters(); refreshShell();
        toast(t('Аккаунт создан', 'Account created')); go(next);
      } else {
        app.innerHTML = shell(t('Проверьте почту', 'Check your email'), '', `<p>${t('Мы отправили письмо на', 'We have sent an email to')} <b>${esc(f.email.value)}</b>. ${t('Перейдите по ссылке из письма, чтобы подтвердить email и войти.', 'Follow the link in it to confirm your email and log in.')}</p>
          <p class="small muted">${t('Письма нет? Проверьте папку «Спам» или', 'No email? Check your spam folder or')} <a href="#/register">${t('попробуйте ещё раз', 'try again')}</a>.</p>`);
      }
    });
  };
}

function forgot(app) {
  app.innerHTML = shell(t('Восстановление доступа', 'Reset access'), t('Пришлём ссылку для смены пароля.', 'We will send you a password reset link.'), `
    <form id="f"><div class="form-error hidden"></div>
      <label class="f"><span>Email</span><input class="inp" type="email" name="email" required></label>
      <button class="btn wide">${t('Отправить ссылку', 'Send link')}</button></form>
    <p class="small muted" style="margin-top:14px"><a href="#/login">${t('Вернуться ко входу', 'Back to log in')}</a></p>`);
  app.querySelector('#f').onsubmit = (e) => {
    e.preventDefault();
    const f = e.target;
    busy(f.querySelector('button'), async () => {
      const { error } = await sb.auth.resetPasswordForEmail(f.email.value.trim(), { redirectTo: base() });
      if (error && /rate limit/i.test(error.message)) return showErr(f, humanError(error));
      // Ответ одинаковый для существующих и несуществующих адресов (BR-IDN-07)
      app.innerHTML = shell(t('Проверьте почту', 'Check your email'), '', `<p>${t('Если аккаунт с таким email существует, мы отправили на него ссылку для смены пароля.', 'If an account with this email exists, we have sent a password reset link to it.')}</p>`);
    });
  };
}

function reset(app) {
  if (!state.user) {
    app.innerHTML = shell(t('Ссылка недействительна', 'Invalid link'), '', `<p>${t('Ссылка устарела или уже использована.', 'The link has expired or was already used.')} <a href="#/forgot">${t('Запросите новую', 'Request a new one')}</a>.</p>`);
    return;
  }
  app.innerHTML = shell(t('Новый пароль', 'New password'), t('Придумайте новый пароль. Все остальные сеансы будут завершены.', 'Choose a new password. All other sessions will be signed out.'), `
    <form id="f"><div class="form-error hidden"></div>
      <label class="f"><span>${t('Новый пароль', 'New password')}</span><input class="inp" type="password" name="password" required minlength="10" autocomplete="new-password"></label>
      <button class="btn wide">${t('Сохранить', 'Save')}</button></form>`);
  app.querySelector('#f').onsubmit = (e) => {
    e.preventDefault();
    const f = e.target;
    busy(f.querySelector('button'), async () => {
      const { error } = await sb.auth.updateUser({ password: f.password.value });
      if (error) return showErr(f, humanError(error));
      await sb.auth.signOut({ scope: 'others' }); // BR-IDN-06
      toast(t('Пароль изменён', 'Password changed')); go('#/');
    });
  };
}
