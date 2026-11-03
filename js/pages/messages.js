// Сообщения: список бесед и чат (SCR-COM-01/02)
import { state, rpc } from '../api.js';
import { esc, dateTime, emptyState, errorState } from '../ui.js';
import { mountChat } from '../chat.js';

const TYPE = { LISTING_INQUIRY: 'Вопрос по технике', ORDER_PROVIDER: 'По заказу', DEAL: 'Сделка' };

export async function render(app, params) {
  let convs;
  try { convs = await rpc('my_conversations', { p_org: state.org.id }); }
  catch (err) { app.innerHTML = errorState(err); return; }
  const active = params.id;
  // Новая беседа без сообщений ещё не попадает в список — добавляем её
  if (active && !convs.some((c) => c.id === active)) convs.unshift({ id: active, type: '', other_name: 'Новая переписка', title: '', unread: 0 });

  if (!convs.length) {
    app.innerHTML = `<div class="page-head"><div><h1>Сообщения</h1></div></div>` +
      emptyState('Сообщений пока нет', 'Задайте вопрос исполнителю на странице техники или напишите заказчику по заказу.', '<a class="btn" href="#/catalog">В каталог</a>');
    return;
  }
  const cur = convs.find((c) => c.id === active);
  app.innerHTML = `<div class="page-head"><div><h1>Сообщения</h1><p>Действуете от имени: ${esc(state.org.type === 'PERSON' ? 'частное лицо' : state.org.name)}</p></div></div>
    <div class="conv-list ${active ? 'has-active' : ''}">
      <div class="panel conv-pane" style="padding:0;overflow:hidden;align-self:start">${convs.map((c) => `<a class="conv ${c.id === active ? 'on' : ''}" href="#/messages/${c.id}">
        <b><span>${esc(c.other_name)}</span>${c.unread ? `<span class="st warn">${c.unread}</span>` : ''}</b>
        <small>${esc(TYPE[c.type] || '')}${c.title ? ' · ' + esc(c.title) : ''}</small>
        <small>${esc(c.last_message || '')}</small></a>`).join('')}</div>
      <div id="chatBox">${active ? '' : '<div class="panel empty"><b>Выберите переписку</b>Слева — все ваши беседы.</div>'}</div>
    </div>`;
  if (active) {
    const box = app.querySelector('#chatBox');
    const links = [];
    if (cur?.deal_id) links.push(`<a href="#/deals/${cur.deal_id}">Открыть сделку →</a>`);
    if (cur?.order_id) links.push(`<a href="#/${state.org.id && cur.type === 'ORDER_PROVIDER' && state.org.can_provide ? 'feed' : 'orders'}/${cur.order_id}">Открыть заказ →</a>`);
    if (cur?.equipment_id && !cur.deal_id) links.push(`<a href="#/item/${cur.equipment_id}">Открыть технику →</a>`);
    box.insertAdjacentHTML('beforebegin', '');
    const stop = mountChat(box, active, `${cur?.other_name || 'Переписка'}${cur?.title ? ' · ' + cur.title : ''}`);
    if (links.length) box.insertAdjacentHTML('afterbegin', `<div class="actions small" style="margin-bottom:8px"><a href="#/messages" class="pill">← Все беседы</a>${links.join('')}</div>`);
    else box.insertAdjacentHTML('afterbegin', '<div class="actions small" style="margin-bottom:8px"><a href="#/messages" class="pill">← Все беседы</a></div>');
    return stop;
  }
}
