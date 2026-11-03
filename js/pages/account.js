// Профиль, организации и проверка (SCR-IDN-04, 06, 07)
import { sb, state, q, rpc, loadMe, setOrg, refreshCounters, isOwnerAdmin } from '../api.js';
import { esc, status, ORG_TYPE, toast, busy, modal, confirmBox } from '../ui.js';
import { go, refreshShell, route } from '../app.js';

export async function render(app) {
  const contacts = await q(sb.from('org_contacts').select('*').in('org_id', state.orgs.map((o) => o.id)));
  const cById = Object.fromEntries(contacts.map((c) => [c.org_id, c]));

  app.innerHTML = `
    <div class="page-head"><div><h1>Профиль и организации</h1><p>От имени организации вы бронируете технику, размещаете заказы и сдаёте технику.</p></div></div>
    <div class="cols">
      <div>
        <div class="panel"><h2>Мои организации</h2>
          ${state.orgs.map((o) => orgCard(o, cById[o.id])).join('')}
        </div>
        <div class="panel" id="newOrg"><h2>Создать организацию</h2>
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
      </aside>
    </div>`;

  app.querySelectorAll('[data-use]').forEach((b) => b.onclick = async () => {
    setOrg(b.dataset.use); await refreshCounters(); refreshShell(); toast('Рабочий контекст переключён'); route();
  });
  app.querySelectorAll('[data-verify]').forEach((b) => b.onclick = () => busy(b, async () => {
    try { await rpc('submit_verification', { p_org: b.dataset.verify }); await loadMe(); toast('Отправлено на проверку'); route(); }
    catch (err) { toast(err.message, true); }
  }));
  app.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () =>
    editOrg(state.orgs.find((o) => o.id === b.dataset.edit), cById[b.dataset.edit] || {}));

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
    </div></div>`;
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
        await rpc('update_organization', {
          p_org: o.id, p_name: f.name.value, p_inn: person ? o.inn : f.inn.value.trim(), p_ogrn: person ? null : f.ogrn.value,
          p_city: f.city.value, p_can_order: person ? true : f.order.checked, p_can_provide: person ? false : f.provide.checked,
          p_phone: f.phone.value, p_email: f.email.value, p_contact: f.contact.value });
        await loadMe(); refreshShell(); m.close(); toast('Сохранено'); route();
      } catch (err) { const el = f.querySelector('.form-error'); el.textContent = err.message; el.classList.remove('hidden'); }
    });
  };
}
