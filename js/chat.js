// Чат: лента сообщений с опросом сервера раз в 5 секунд (Модуль 11)
import { sb, state, q, rpc, refreshCounters } from './api.js';
import { esc, dateTime, toast } from './ui.js';

export function mountChat(box, convId, title = 'Переписка') {
  box.innerHTML = `<div class="chat"><div class="chat-head">${esc(title)}</div>
    <div class="chat-body" aria-live="polite"><div class="muted small">Загрузка…</div></div>
    <form class="chat-form"><textarea class="inp" name="t" placeholder="Сообщение… (Enter — отправить, Shift+Enter — новая строка)" maxlength="4000" aria-label="Сообщение"></textarea>
      <button class="btn dark">Отправить</button></form></div>`;
  const body = box.querySelector('.chat-body');
  const form = box.querySelector('form');
  let lastId = 0, first = true, stopped = false;

  const draw = (msgs) => {
    if (first) body.innerHTML = msgs.length ? '' : '<div class="muted small" data-empty>Сообщений пока нет. Напишите первым.</div>';
    if (msgs.length) body.querySelector('[data-empty]')?.remove();
    const nearBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 80;
    body.insertAdjacentHTML('beforeend', msgs.map((m) => m.is_system
      ? `<div class="msg sys">${esc(m.body)}<time>${dateTime(m.created_at)}</time></div>`
      : `<div class="msg ${m.author_org_id === state.org.id ? 'mine' : ''}">${esc(m.body)}
          ${m.was_masked ? '<span class="masked">Контакты скрыты до подтверждения сделки</span>' : ''}<time>${dateTime(m.created_at)}</time></div>`).join(''));
    if (first || nearBottom) body.scrollTop = body.scrollHeight;
    first = false;
  };

  async function poll() {
    if (stopped) return;
    try {
      const msgs = await q(sb.from('messages').select('*').eq('conversation_id', convId).gt('id', lastId).order('id').limit(500));
      if (msgs.length) {
        lastId = msgs[msgs.length - 1].id;
        draw(msgs);
        rpc('mark_read', { p_conv: convId, p_org: state.org.id }).then(refreshCounters).catch(() => {});
      } else if (first) draw([]);
    } catch (err) { if (first) body.innerHTML = `<div class="muted">${esc(err.message)}</div>`; }
  }
  form.t.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
  form.onsubmit = async (e) => {
    e.preventDefault();
    const text = form.t.value.trim();
    if (!text) return;
    form.querySelector('button').disabled = true;
    try {
      const r = await rpc('send_message', { p_conv: convId, p_org: state.org.id, p_body: text });
      form.t.value = '';
      if (r?.masked) toast('Контакты в сообщении скрыты — они откроются после подтверждения сделки');
      await poll();
    } catch (err) { toast(err.message, true); }
    finally { form.querySelector('button').disabled = false; form.t.focus(); }
  };
  poll();
  const timer = setInterval(() => { if (!document.hidden) poll(); }, 5000);
  return () => { stopped = true; clearInterval(timer); };
}
