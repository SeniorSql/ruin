-- =====================================================================
-- RUIN — усиленная защита от обмена контактами до подтверждения сделки (BR-NEG-01, BR-CHT-04)
-- Ловит: номера цифрами с любыми разделителями, номера словами, почту через «собака»/«at»,
-- ссылки, ники и названия мессенджеров. Повторные попытки (3+ за 7 дней) отмечаются для админа.
-- Выполнять после 01–05.
-- =====================================================================

-- Числительные, которыми пишут номер словами
create or replace function public.num_words_re()
returns text language sql immutable as $$
  select '(ноль|нуль|один|одна|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять|одиннадцать|двенадцать|тринадцать|четырнадцать|пятнадцать|шестнадцать|семнадцать|восемнадцать|девятнадцать|двадцать|тридцать|сорок|пятьдесят|шестьдесят|семьдесят|восемьдесят|девяносто|сто|двести|триста|четыреста|пятьсот|шестьсот|семьсот|восемьсот|девятьсот|плюс)';
$$;

create or replace function public.has_contacts(p text)
returns boolean language plpgsql immutable as $$
declare t text := lower(coalesce(p, '')); w text := num_words_re();
begin
  return
    -- телефон: +7/8 и 10 цифр с обычными разделителями; 10+ цифр слитно; мобильный 9xx без кода; цифры через одну
    t ~ '(\+\s*7|\m8)[\s\-\.\(]*\d{3}[\s\-\.\)]*\d{3}[\s\-\.]*\d{2}[\s\-\.]*\d{2}'
    or t ~ '\d{10,}'
    or t ~ '\m9\d{2}[\s\-\.\)]{0,2}\d{3}[\s\-\.]{0,2}\d{2}[\s\-\.]{0,2}\d{2}\M'
    or t ~ '(\d[\s\.\-_/]){9,}\d'
    -- номер словами: начинается с числительного, дальше ещё 3+ числительных или коротких чисел
    or t ~ ('\m' || w || '\M([\s,\-\.]+(\m' || w || '\M|\d{1,3})){3,}')
    -- почта, в том числе «собака», (at), [at]
    or t ~ '[a-z0-9._%+\-]+\s*(@|\(at\)|\[at\]|\mсобака\M|\mat\M)\s*[a-z0-9\-]+\s*(\.|\mточка\M|\(dot\))\s*[a-z]{2,}'
    -- ссылки и домены
    or t ~ '(https?://|www\.|\m[a-z0-9\-]+\.(ru|com|net|org|su|io|me|рф|online|site|pro)\M)'
    -- мессенджеры: ссылки, ники, названия
    or t ~ '(t\.me/|wa\.me|(^|\s)@[a-z0-9_]{4,})'
    or t ~ '(whats\s?app|ватс?\s?ап|вотсап|вацап|telegram|телеграм|телега|\mтг\M|viber|вайбер|\mвк\M|vk\.com|одноклассник|скайп|skype|max\s?мессенджер)';
end $$;

create or replace function public.mask_contacts(p text)
returns text language plpgsql immutable as $$
declare r text := p; w text := num_words_re();
begin
  r := regexp_replace(r, '(\+\s*7|\m8)[\s\-\.\(]*\d{3}[\s\-\.\)]*\d{3}[\s\-\.]*\d{2}[\s\-\.]*\d{2}', '••••', 'g');
  r := regexp_replace(r, '\d{10,}', '••••', 'g');
  r := regexp_replace(r, '\m9\d{2}[\s\-\.\)]{0,2}\d{3}[\s\-\.]{0,2}\d{2}[\s\-\.]{0,2}\d{2}\M', '••••', 'g');
  r := regexp_replace(r, '(\d[\s\.\-_/]){9,}\d', '••••', 'g');
  r := regexp_replace(r, '\m' || w || '\M([\s,\-\.]+(\m' || w || '\M|\d{1,3})){3,}', '••••', 'gi');
  r := regexp_replace(r, '[a-z0-9._%+\-]+\s*(@|\(at\)|\[at\]|\mсобака\M|\mat\M)\s*[a-z0-9\-]+\s*(\.|\mточка\M|\(dot\))\s*[a-z]{2,}', '••••', 'gi');
  r := regexp_replace(r, '(https?://\S+)|(www\.\S+)', '••••', 'gi');
  r := regexp_replace(r, '\m[a-z0-9\-]+\.(ru|com|net|org|su|io|me|рф|online|site|pro)\M\S*', '••••', 'gi');
  r := regexp_replace(r, '(t\.me/\S*)|(wa\.me\S*)|(vk\.com\S*)', '••••', 'gi');
  r := regexp_replace(r, '(^|\s)@[a-z0-9_]{4,}', '\1••••', 'gi');
  r := regexp_replace(r, '(whats\s?app|ватс?\s?ап|вотсап|вацап|telegram|телеграм|телега|viber|вайбер|скайп|skype)', '••••', 'gi');
  return r;
end $$;

-- Отправка сообщения: маскирование до подтверждения сделки + учёт попыток обхода
create or replace function public.send_message(p_conv uuid, p_org uuid, p_body text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c conversations; v_body text; v_masked boolean := false; v_open boolean; v_other uuid; v_id bigint; v_attempts int;
begin
  perform require_member(p_org);
  select * into c from conversations where id = p_conv;
  if not found or p_org not in (c.customer_org_id, c.provider_org_id) then
    raise exception 'Нет доступа к переписке' using errcode = '42501';
  end if;
  v_body := trim(coalesce(p_body, ''));
  if v_body = '' then raise exception 'Пустое сообщение'; end if;
  if length(v_body) > 4000 then raise exception 'Сообщение слишком длинное'; end if;
  if (select count(*) from messages where author_user_id = auth.uid() and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Слишком много сообщений. Подождите минуту';
  end if;
  v_body := mask_cards(v_body);
  v_open := exists (select 1 from deals d where d.customer_org_id = c.customer_org_id and d.provider_org_id = c.provider_org_id
                    and d.status in ('CONFIRMED','IN_PROGRESS','COMPLETION_PENDING','COMPLETED'));
  if not v_open and has_contacts(v_body) then
    v_body := mask_contacts(v_body); v_masked := true;
    perform audit(p_org, 'contact_masked', 'conversation', p_conv::text);
    select count(*) into v_attempts from audit_log
     where acting_org_id = p_org and action = 'contact_masked' and ts > now() - interval '7 days';
    if v_attempts = 3 then
      perform audit(p_org, 'contact_bypass_flag', 'organization', p_org::text, jsonb_build_object('attempts_7d', v_attempts));
    end if;
  end if;
  insert into messages (conversation_id, author_user_id, author_org_id, body, was_masked)
    values (p_conv, auth.uid(), p_org, v_body, v_masked) returning id into v_id;
  update conversations set last_message_at = now() where id = p_conv;
  insert into conversation_reads (conversation_id, org_id, last_read_id) values (p_conv, p_org, v_id)
    on conflict (conversation_id, org_id) do update set last_read_id = excluded.last_read_id;
  v_other := case when p_org = c.customer_org_id then c.provider_org_id else c.customer_org_id end;
  if not exists (select 1 from notifications where org_id = v_other and link = '#/messages/' || p_conv
                 and not is_read and created_at > now() - interval '15 minutes') then
    perform notify(v_other, 'Новое сообщение', '#/messages/' || p_conv);
  end if;
  return jsonb_build_object('id', v_id, 'masked', v_masked);
end $$;

-- Список организаций с повторными попытками обхода (для админки)
create or replace function public.admin_bypass_attempts()
returns table (org_id uuid, org_name text, attempts int, last_at timestamptz)
language sql stable security definer set search_path = public as $$
  select a.acting_org_id, o.name, count(*)::int, max(a.ts)
  from audit_log a join organizations o on o.id = a.acting_org_id
  where is_admin() and a.action = 'contact_masked' and a.ts > now() - interval '30 days'
  group by a.acting_org_id, o.name order by count(*) desc limit 100;
$$;
