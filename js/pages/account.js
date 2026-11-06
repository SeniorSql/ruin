// Профиль, организации и проверка (SCR-IDN-04, 06, 07)
import { sb, state, q, rpc, loadMe, setOrg, refreshCounters, isOwnerAdmin, isAdmin } from '../api.js';
import { esc, status, ORG_TYPE, toast, busy, modal, confirmBox, date } from '../ui.js';
import { go, refreshShell, route } from '../app.js';
import { withActionCode } from '../actionCode.js';

export async function render(app) {
  const contacts = await q(sb.from('org_contacts').select('*').in('org_id', state.orgs.map((o) => o.id)));
  const cById = Object.fromEntries(contacts.map((c) => [c.org_id, c]));
  const invites = await rpc('my_invitations').catch(() => []);
  const hasOrg = state.orgs.some((o) => o.type !== 'PERSON');

  app.innerHTML = `
    <div class="page-head"><div><h1>Профиль и организации</h1><p>От имени организации вы бронируете технику, размещаете заказы и сдаёте технику.</p></div></div>
    ${invites.map((i) => `<div class="banner info" style="align-items:center"><div style="flex:1">Вас пригласили в <b>${esc(i.org_name)}</b> на роль «${esc(i.role)}».</div>
      <button class="btn sm" data-accept="${i.id}">Принять приглашение</button></div>`).join('')}
    <div class="cols">
      <div>
        <div class="panel"><h2>Мои организации</h2>
          ${state.orgs.map((o) => orgCard(o, cById[o.id])).join('')}
          ${hasOrg ? `<div class="add-org-row"><button class="btn ghost" id="addOrg" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg> Добавить организацию</button></div>` : ''}
        </div>
        <div class="panel${hasOrg ? ' hidden' : ''}" id="newOrg"><div class="panel-head-row"><h2>Создать организацию</h2>${hasOrg ? '<button class="btn ghost sm" id="cancelOrg" type="button">Отмена</button>' : ''}</div>
          <p class="muted" style="margin-top:-6px">Нужна, чтобы сдавать технику (исполнитель) или заказывать от имени компании. После создания отправьте её на проверку — обычно это занимает 1 рабочий день.</p>
          <form id="of">
            <div class="form-error hidden"></div>
            <label class="f"><span>Тип <i>*</i></span><select class="inp" name="type" required>
              <option value="LEGAL">Юрлицо (ООО, АО)</option><option value="SOLE_PROP">ИП</option><option value="SELF_EMPLOYED">Самозанятый</option></select></label>
            <label class="f"><span>Название <i>*</i></span><input class="inp" name="name" required maxlength="200" placeholder="ООО «СтройРесурс»"></label>
            <div class="grid2">
              <label class="f"><span>ИНН <i>*</i></span><input class="inp" name="inn" required inputmode="numeric" pattern="\\d{10}|\\d{12}" maxlength="12"></label>
              <label class="f"><span>ОГРН / ОГРНИП</span><input class="inp" name="ogrn" inputmode="numeric" maxlength="15"></label>
            </div>
            <label class="f"><span>Город</span><input class="inp" name="city" maxlength="100"></label>
            <span style="display:block;font-size:13px;font-weight:700;margin-bottom:6px;color:var(--ink2)">Кем будет организация <i style="color:var(--red);font-style:normal">*</i></span>
            <label class="check"><input type="checkbox" name="provide" checked> <span>Исполнитель — сдаю технику в аренду</span></label>
            <label class="check"><input type="checkbox" name="order" checked> <span>Заказчик — арендую технику</span></label>
            <div class="grid2">
              <label class="f"><span>Телефон для сделок <i>*</i></span><input class="inp" name="phone" type="tel" required></label>
              <label class="f"><span>Email для сделок <i>*</i></span><input class="inp" name="email" type="email" required value="${esc(state.user.email)}"></label>
            </div>
            <label class="f"><span>Контактное лицо</span><input class="inp" name="contact" value="${esc(state.profile?.full_name || '')}"></label>
            <p class="small muted">Контакты увидит только контрагент и только после подтверждения сделки.</p>
            <button class="btn">Создать организацию</button>
          </form>
        </div>
      </div>
      <aside class="sticky">
        <div class="panel"><h2>Профиль</h2>
          <form id="pf">
            <label class="f"><span>Имя</span><input class="inp" name="name" value="${esc(state.profile?.full_name || '')}" maxlength="100"></label>
            <label class="f"><span>Email</span><input class="inp" value="${esc(state.user.email)}" disabled></label>
            <button class="btn ghost sm">Сохранить имя</button>
          </form>
          <div class="divider"></div>
          <h3>Безопасность</h3>
          <form id="pw"><label class="f"><span>Новый пароль</span><input class="inp" type="password" name="password" minlength="10" required autocomplete="new-password"></label>
            <button class="btn ghost sm">Сменить пароль</button></form>
          <div class="divider"></div>
          <div class="actions"><button class="btn ghost sm" id="outAll">Выйти на всех устройствах</button><button class="btn danger sm" id="out">Выйти</button></div>
        </div>
        <div class="panel" id="msgr"><h2>Уведомления в мессенджерах</h2><div class="skeleton" style="height:60px"></div></div>
      </aside>
    </div>`;

  messengers(app.querySelector('#msgr'));

  app.querySelectorAll('[data-accept]').forEach((b) => b.onclick = () => busy(b, async () => {
    try { const org = await rpc('accept_invitation', { p_id: b.dataset.accept }); await loadMe(); setOrg(org); await refreshCounters(); refreshShell(); toast('Вы присоединились к организации'); route(); }
    catch (err) { toast(err.message, true); }
  }));
  app.querySelectorAll('[data-use]').forEach((b) => b.onclick = async () => {
    setOrg(b.dataset.use); await refreshCounters(); refreshShell(); toast('Рабочий контекст переключён'); route();
  });
  app.querySelectorAll('[data-verify]').forEach((b) => b.onclick = () => busy(b, async () => {
    try { await rpc('submit_verification', { p_org: b.dataset.verify }); await loadMe(); toast('Отправлено на проверку'); route(); }
    catch (err) { toast(err.message, true); }
  }));
  app.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () =>
    editOrg(state.orgs.find((o) => o.id === b.dataset.edit), cById[b.dataset.edit] || {}));
  app.querySelectorAll('[data-delorg]').forEach((b) => b.onclick = () => busy(b, async () => {
    if (!(await deleteOrgFlow(b.dataset.delorg))) return;
    await loadMe(); if (state.org) setOrg(state.org.id); await refreshCounters(); refreshShell(); route();
  }));

  const addBtn = app.querySelector('#addOrg'), newOrg = app.querySelector('#newOrg');
  if (addBtn) {
    addBtn.onclick = () => {
      newOrg.classList.remove('hidden'); addBtn.parentElement.classList.add('hidden');
      newOrg.scrollIntoView({ behavior: 'smooth', block: 'start' }); newOrg.querySelector('[name=type]').focus({ preventScroll: true });
    };
    app.querySelector('#cancelOrg').onclick = () => {
      newOrg.classList.add('hidden'); addBtn.parentElement.classList.remove('hidden');
      newOrg.querySelector('#of').reset(); newOrg.querySelector('.form-error').classList.add('hidden');
    };
  }

  app.querySelector('#of').onsubmit = (e) => {
    e.preventDefault();
    const f = e.target;
    busy(f.querySelector('button'), async () => {
      try {
        const id = await rpc('create_organization', {
          p_type: f.type.value, p_name: f.name.value, p_inn: f.inn.value.trim(), p_ogrn: f.ogrn.value, p_city: f.city.value,
          p_can_order: f.order.checked, p_can_provide: f.provide.checked, p_phone: f.phone.value, p_email: f.email.value, p_contact: f.contact.value });
        await loadMe(); setOrg(id); await refreshCounters(); refreshShell();
        const ok = await confirmBox('Организация создана', 'Теперь отправьте её на проверку. Пока проверка идёт, можно заполнять карточки техники — опубликовать их получится после проверки.', 'Отправить на проверку');
        if (ok) { try { await rpc('submit_verification', { p_org: id }); await loadMe(); toast('Отправлено на проверку'); } catch (err) { toast(err.message, true); } }
        route();
      } catch (err) { const el = f.querySelector('.form-error'); el.textContent = err.message; el.classList.remove('hidden'); el.scrollIntoView({ block: 'center' }); }
    });
  };

  app.querySelector('#pf').onsubmit = async (e) => {
    e.preventDefault();
    const { error } = await sb.from('profiles').update({ full_name: e.target.name.value.trim() }).eq('id', state.user.id);
    if (error) return toast('Не удалось сохранить', true);
    await loadMe(); refreshShell(); toast('Сохранено');
  };
  app.querySelector('#pw').onsubmit = (e) => {
    e.preventDefault();
    busy(e.target.querySelector('button'), async () => {
      const { error } = await sb.auth.updateUser({ password: e.target.password.value });
      if (error) return toast(error.message, true);
      await sb.auth.signOut({ scope: 'others' });
      e.target.reset(); toast('Пароль изменён, другие сеансы завершены');
    });
  };
  app.querySelector('#outAll').onclick = async () => { await sb.auth.signOut({ scope: 'global' }); await loadMe(); refreshShell(); go('#/'); };
  app.querySelector('#out').onclick = async () => { await sb.auth.signOut(); await loadMe(); refreshShell(); go('#/'); };
}

// Уведомления в Telegram / MAX: привязка через одноразовый код и бота
const MSGR = { TG: { name: 'Telegram', key: 'public.tg_bot', at: '@', link: (bot, code) => `https://t.me/${bot}?start=${code}` },
  MAX: { name: 'MAX', key: 'public.max_bot', at: '', link: (bot, code) => `https://max.ru/${bot}?start=${code}` } };
async function messengers(box) {
  const head = '<h2>Уведомления в мессенджерах</h2>';
  let ch, bots;
  try {
    ch = await q(sb.from('notify_channels').select('channel,username,enabled,linked_at').eq('user_id', state.user.id));
    const s = await q(sb.from('app_settings').select('key,value').in('key', ['public.tg_bot', 'public.max_bot']));
    bots = { TG: s.find((x) => x.key === 'public.tg_bot')?.value || '', MAX: s.find((x) => x.key === 'public.max_bot')?.value || '' };
  } catch {
    box.innerHTML = head + '<p class="small muted" style="margin:0">Заработают после настройки на стороне сайта.</p>';
    return;
  }
  const mine = (k) => ch.find((c) => c.channel === k);
  const row = (k) => {
    const c = mine(k), bot = bots[k], m = MSGR[k];
    return `<div class="msgr-row"><div class="grow"><b>${m.name}</b><div class="small muted">${c ? (c.enabled ? 'подключён' : 'выключен') + (c.username ? ' · @' + esc(c.username) : '') : bot ? 'не подключён' : 'бот ещё не настроен'}</div></div>
      ${c ? `${c.enabled ? `<button class="btn ghost sm" data-test="${k}">Проверить</button>` : ''}<button class="btn ghost sm" data-toggle="${k}">${c.enabled ? 'Выключить' : 'Включить'}</button>`
        : bot ? `<button class="btn sm" data-link="${k}">Подключить</button>` : ''}</div>`;
  };
  const admin = isAdmin();
  box.innerHTML = `${head}
    <p class="small muted" style="margin-top:-6px">Новые брони, сообщения, сроки документов и ТО — сразу в телефон.</p>
    ${row('TG')}${row('MAX')}
    ${['TG', 'MAX'].filter(mine).map((k) => `<button class="linkish small" data-unlink="${k}" type="button">Отвязать ${MSGR[k].name}</button>`).join(' ')}
    ${admin ? `<div class="divider"></div><div class="small muted">Админ площадки: после смены токена бота нажмите, чтобы подключить бота к сайту.</div>
      <div class="actions" style="margin-top:6px">${['TG', 'MAX'].map((k) => `<button class="btn ghost sm" data-setup="${k}">Настроить ${MSGR[k].name}${bots[k] ? ' (' + MSGR[k].at + esc(bots[k]) + ')' : ''}</button>`).join('')}</div>` : ''}`;

  box.querySelectorAll('[data-link]').forEach((b) => b.addEventListener('click', () => busy(b, async () => {
    const k = b.dataset.link, m = MSGR[k];
    try {
      const url = m.link(bots[k], await rpc('notify_link_code', { p_channel: k }));
      const w = window.open(url, '_blank', 'noopener');
      b.outerHTML = `<a class="btn sm" href="${url}" target="_blank" rel="noopener">Открыть ${m.name}</a>`;
      toast(w ? `В ${m.name} нажмите «Старт» — и вернитесь сюда` : `Нажмите «Открыть ${m.name}», затем «Старт» в боте`);
      // Ждём, пока бот привяжет аккаунт (ссылка живёт 15 минут)
      for (let i = 0; i < 300; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        if (!document.body.contains(box)) return;
        const r = await q(sb.from('notify_channels').select('channel').eq('user_id', state.user.id).eq('channel', k));
        if (r.length) { toast(`${m.name} подключён`); messengers(box); return; }
      }
    } catch (err) { toast(err.message, true); }
  })));
  box.querySelectorAll('[data-test]').forEach((b) => b.addEventListener('click', () => busy(b, async () => {
    try { await rpc('notify_test', { p_org: state.org.id }); toast('Отправили проверочное уведомление во все подключённые мессенджеры'); }
    catch (err) { toast(err.message, true); }
  })));
  box.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => busy(b, async () => {
    const k = b.dataset.toggle;
    try { await rpc('notify_set_channel', { p_channel: k, p_enabled: !mine(k).enabled, p_unlink: false }); messengers(box); }
    catch (err) { toast(err.message, true); }
  })));
  box.querySelectorAll('[data-unlink]').forEach((b) => b.addEventListener('click', async () => {
    const k = b.dataset.unlink, m = MSGR[k];
    if (!(await confirmBox(`Отвязать ${m.name}?`, `Уведомления перестанут приходить в ${m.name}. Подключить снова можно в любой момент.`, 'Отвязать'))) return;
    try { await rpc('notify_set_channel', { p_channel: k, p_enabled: false, p_unlink: true }); messengers(box); }
    catch (err) { toast(err.message, true); }
  }));
  box.querySelectorAll('[data-setup]').forEach((b) => b.addEventListener('click', () => busy(b, async () => {
    const k = b.dataset.setup;
    const { data, error } = await sb.functions.invoke('tg-bot', { body: { action: 'setup', channel: k } });
    let msg = data?.error;
    if (error) { try { msg = (await error.context.json()).error; } catch { msg = error.message; } }
    if (msg || !data?.ok) return toast(msg || data?.description || 'Не получилось', true);
    toast(`Бот ${MSGR[k].at}${data.bot} подключён к сайту`);
    messengers(box);
  })));
}

function orgCard(o, c = {}) {
  const current = state.org?.id === o.id;
  const canVerify = o.type !== 'PERSON' && ['DRAFT', 'REQUIRES_UPDATE', 'REJECTED'].includes(o.verification_status) && isOwnerAdmin(o);
  return `<div class="row-item" style="align-items:flex-start">
    <div class="grow">
      <b>${esc(o.type === 'PERSON' ? 'Частное лицо — ' + o.name : o.name)} ${current ? '<span class="st ok">Текущая</span>' : ''}</b>
      <div class="small muted">${ORG_TYPE[o.type]}${o.inn ? ' · ИНН ' + esc(o.inn) : ''} · роль: ${esc(o.role)} ·
        ${[o.can_order && 'заказчик', o.can_provide && 'исполнитель'].filter(Boolean).join(' и ')}</div>
      ${o.type !== 'PERSON' ? `<div style="margin-top:6px">${status('org', o.verification_status)}</div>` : ''}
      ${o.verification_comment && o.verification_status !== 'VERIFIED' ? `<div class="banner warn" style="margin:8px 0 0">Комментарий проверки: ${esc(o.verification_comment)}</div>` : ''}
      ${o.type !== 'PERSON' && o.verification_status === 'DRAFT' ? '<div class="small muted" style="margin-top:6px">Чтобы публиковать технику и отправлять предложения, отправьте организацию на проверку.</div>' : ''}
    </div>
    <div class="actions" style="justify-content:flex-end">
      ${!current ? `<button class="btn ghost sm" data-use="${o.id}">Сделать текущей</button>` : ''}
      ${isOwnerAdmin(o) ? `<button class="btn ghost sm" data-edit="${o.id}">Изменить</button>` : ''}
      ${canVerify ? `<button class="btn sm" data-verify="${o.id}">Отправить на проверку</button>` : ''}
      ${o.type !== 'PERSON' && o.role === 'OWNER' ? `<button class="btn danger sm" data-delorg="${o.id}">Удалить</button>` : ''}
    </div></div>`;
}

// Удаление организации: владелец или админ площадки. Сначала показываем, что произойдёт,
// просим ввести название, затем код из Telegram / MAX. Возвращает true, если удалили или закрыли.
export async function deleteOrgFlow(orgId) {
  let p;
  try { p = await rpc('org_delete_preview', { p_org: orgId }); } catch (err) { toast(err.message, true); return false; }
  if (p.active_deals > 0) {
    // Показываем, какие именно сделки мешают, и даём перейти в каждую
    const ROLE = { PROVIDER: 'вы — исполнитель', CUSTOMER: 'вы — заказчик' };
    const rows = (p.active_list || []).map((d) => `<div class="row-item" style="align-items:center">
        <div class="grow"><b>${esc(d.number)}</b> ${status('deal', d.status)}
          <div class="small muted">${esc(d.title || '')} · ${date(d.start)}${d.end !== d.start ? ' — ' + date(d.end) : ''} · ${ROLE[d.role] || ''}</div></div>
        <button class="btn sm" type="button" data-open-deal="${d.id}">Открыть сделку →</button></div>`).join('');
    const m = modal(`<h2>Пока удалить нельзя</h2>
      <p>У организации <b>${esc(p.name)}</b> ${p.active_deals === 1 ? 'есть незавершённая сделка' : `есть незавершённые сделки: ${p.active_deals}`}. Пока она идёт, у второй стороны должны остаться сделка и документы.</p>
      <div class="panel" style="padding:4px 14px;margin:0 0 12px">${rows}</div>
      <p class="small muted" style="margin:0 0 12px">Откройте сделку и нажмите «Отменить сделку» или доведите её до завершения. Затем вернитесь сюда и снова нажмите «Удалить».</p>
      <div class="actions"><button class="btn ghost" type="button" data-c>Понятно</button></div>`);
    m.el.querySelector('[data-c]').onclick = () => m.close();
    m.el.querySelectorAll('[data-open-deal]').forEach((b) => b.onclick = () => {
      // Переключаемся на эту организацию, чтобы сделка открылась с нужными правами
      if (state.orgs.some((o) => o.id === orgId)) setOrg(orgId);
      m.close(); go('#/deals/' + b.dataset.openDeal);
    });
    return false;
  }
  const del = p.mode === 'DELETE';
  const typed = await new Promise((resolve) => {
    let done = false;
    const m = modal(`<h2>${del ? 'Удалить организацию?' : 'Закрыть организацию?'}</h2>
      ${del
        ? `<p>Организация <b>${esc(p.name)}</b> будет удалена навсегда вместе со всеми данными: техника (${p.equipment}), заказы (${p.orders}), учёт парка, заметки, сотрудники (${p.members}). Вернуть будет нельзя.</p>`
        : `<p>У организации <b>${esc(p.name)}</b> есть сделки (${p.deals}). Их документы нужны контрагентам, поэтому организация будет <b>закрыта</b>, а не стёрта:</p>
          <ul class="small"><li>исчезнет из списка у вас и у всех сотрудников;</li><li>техника снимется с публикации, открытые заказы и предложения отменятся;</li>
          <li>сделки и документы останутся у контрагентов.</li></ul><p>Вернуть будет нельзя.</p>`}
      <form id="dof"><div class="form-error hidden"></div>
        <label class="f"><span>Чтобы подтвердить, введите название: <b>${esc(p.name)}</b></span><input class="inp" name="name" autocomplete="off" required></label>
        <div class="actions"><button class="btn danger" type="submit">${del ? 'Удалить навсегда' : 'Закрыть организацию'}</button><button class="btn ghost" type="button" data-c>Отмена</button></div>
      </form>`, { onClose: () => { if (!done) resolve(false); } });
    const f = m.el.querySelector('#dof');
    const norm = (s) => s.trim().replace(/\s+/g, ' ').toLowerCase();
    m.el.querySelector('[data-c]').onclick = () => m.close();
    f.onsubmit = (e) => {
      e.preventDefault();
      if (norm(f.name.value) !== norm(p.name)) { const el = f.querySelector('.form-error'); el.textContent = 'Название не совпадает'; el.classList.remove('hidden'); return; }
      done = true; m.close(); resolve(true);
    };
  });
  if (!typed) return false;
  try {
    const r = await withActionCode('org_delete', (code) => rpc('delete_organization', { p_org: orgId, p_code: code }));
    toast(r === 'DELETED' ? 'Организация удалена' : 'Организация закрыта');
    return true;
  } catch (err) { if (err.message !== 'Действие отменено') toast(err.message, true); return false; }
}

function editOrg(o, c) {
  const person = o.type === 'PERSON';
  const m = modal(`<h2>${person ? 'Личные данные' : 'Данные организации'}</h2>
    ${!person && o.verification_status === 'VERIFIED' ? '<div class="banner warn">Смена ИНН или названия отправит организацию на повторную проверку.</div>' : ''}
    <form id="ef"><div class="form-error hidden"></div>
      <label class="f"><span>${person ? 'Имя' : 'Название'}</span><input class="inp" name="name" value="${esc(o.name)}" required></label>
      ${person ? '' : `<div class="grid2"><label class="f"><span>ИНН</span><input class="inp" name="inn" value="${esc(o.inn || '')}" required></label>
        <label class="f"><span>ОГРН</span><input class="inp" name="ogrn" value="${esc(o.ogrn || '')}"></label></div>
        <label class="check"><input type="checkbox" name="provide" ${o.can_provide ? 'checked' : ''}> <span>Исполнитель</span></label>
        <label class="check"><input type="checkbox" name="order" ${o.can_order ? 'checked' : ''}> <span>Заказчик</span></label>`}
      <label class="f"><span>Город</span><input class="inp" name="city" value="${esc(o.city || '')}"></label>
      <div class="grid2"><label class="f"><span>Телефон</span><input class="inp" name="phone" value="${esc(c.phone || '')}"></label>
        <label class="f"><span>Email</span><input class="inp" name="email" type="email" value="${esc(c.email || '')}"></label></div>
      <label class="f"><span>Контактное лицо</span><input class="inp" name="contact" value="${esc(c.contact_person || '')}"></label>
      <button class="btn wide">Сохранить</button></form>`);
  m.el.querySelector('#ef').onsubmit = (e) => {
    e.preventDefault();
    const f = e.target;
    busy(f.querySelector('button'), async () => {
      try {
        const args = {
          p_org: o.id, p_name: f.name.value, p_inn: person ? o.inn : f.inn.value.trim(), p_ogrn: person ? null : f.ogrn.value,
          p_city: f.city.value, p_can_order: person ? true : f.order.checked, p_can_provide: person ? false : f.provide.checked,
          p_phone: f.phone.value, p_email: f.email.value, p_contact: f.contact.value };
        // Смена названия, ИНН или ОГРН — важное действие: подтверждаем кодом из мессенджера
        const reqChanged = !person && (f.name.value.trim() !== (o.name || '') || f.inn.value.trim() !== (o.inn || '') || f.ogrn.value.trim() !== (o.ogrn || ''));
        if (reqChanged) await withActionCode('org_requisites', (code) => rpc('update_organization', { ...args, p_code: code }));
        else await rpc('update_organization', args);
        await loadMe(); refreshShell(); m.close(); toast('Сохранено'); route();
      } catch (err) { const el = f.querySelector('.form-error'); el.textContent = err.message; el.classList.remove('hidden'); }
    });
  };
}
