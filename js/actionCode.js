// Код подтверждения важного действия: приходит в Telegram / MAX, если мессенджер подключён
import { sb, rpc } from './api.js';
import { modal, toast, busy } from './ui.js';

const LABEL = { transfer_ownership: 'передачи прав владельца', org_requisites: 'смены реквизитов организации' };

async function sendCode(purpose) {
  const { data, error } = await sb.functions.invoke('tg-bot', { body: { action: 'code', purpose } });
  let msg = data?.error;
  if (error) { try { msg = (await error.context.json()).error; } catch { msg = error.message; } }
  if (msg) throw new Error(msg);
}

// Выполнить действие fn(code). Если мессенджер не подключён — код не нужен, fn(null).
export async function withActionCode(purpose, fn) {
  let need = false;
  try { need = await rpc('needs_action_code', {}); } catch { need = false; }
  if (!need) return fn(null);
  await sendCode(purpose);
  return new Promise((resolve, reject) => {
    let done = false;
    const m = modal(`<h2>Код подтверждения</h2>
      <p class="muted" style="margin-top:-4px">Для ${LABEL[purpose] || 'этого действия'} мы отправили код в ваш Telegram / MAX.</p>
      <form id="acf"><div class="form-error hidden"></div>
        <label class="f"><span>Код из сообщения</span><input class="inp" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="\\d{6}" required autofocus></label>
        <div class="actions"><button class="btn" type="submit">Подтвердить</button><button class="btn ghost" type="button" id="acResend">Отправить ещё раз</button></div>
      </form>`, { onClose: () => { if (!done) reject(new Error('Действие отменено')); } });
    const f = m.el.querySelector('#acf');
    setTimeout(() => f.code.focus(), 50);
    f.onsubmit = (e) => {
      e.preventDefault();
      busy(f.querySelector('button[type=submit]'), async () => {
        try { const r = await fn(f.code.value.trim()); done = true; m.close(); resolve(r); }
        catch (err) { const el = f.querySelector('.form-error'); el.textContent = err.message; el.classList.remove('hidden'); }
      });
    };
    m.el.querySelector('#acResend').onclick = (e) => busy(e.currentTarget, async () => {
      try { await sendCode(purpose); toast('Новый код отправлен'); } catch (err) { toast(err.message, true); }
    });
  });
}
