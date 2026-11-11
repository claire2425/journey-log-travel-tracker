-- Journey Log private cross-device sync
--
-- This schema deliberately stores the existing TypeScript entities as JSONB so
-- the browser can round-trip each record without a second, drifting field map.
-- The JSON payload is still validated below. `created_at` and `updated_at` are
-- the entity timestamps supplied by the local-first app; `server_updated_at`
-- and `revision` are the server-authoritative values used for synchronization.
--
-- Browser clients cannot access these tables directly. They use the sync RPCs
-- at the end of this migration, which infer the owner from the Supabase JWT and
-- enforce optimistic concurrency.

begin;

-- ---------------------------------------------------------------------------
-- Validation helpers
-- ---------------------------------------------------------------------------

create or replace function public.journey_sync_is_text(
  p_value jsonb,
  p_max_length integer default null,
  p_require_nonblank boolean default true
)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_text text;
begin
  if p_value is null or jsonb_typeof(p_value) <> 'string' then
    return false;
  end if;

  v_text := p_value #>> '{}';
  if p_max_length is not null and char_length(v_text) > p_max_length then
    return false;
  end if;

  return not p_require_nonblank or char_length(btrim(v_text)) > 0;
end;
$$;

create or replace function public.journey_sync_is_currency(p_value jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  if not public.journey_sync_is_text(p_value, 3, true) then
    return false;
  end if;

  return (p_value #>> '{}') ~ '^[A-Z]{3}$';
end;
$$;

create or replace function public.journey_sync_is_number(
  p_value jsonb,
  p_min numeric,
  p_max numeric,
  p_integer boolean default false
)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_text text;
  v_number numeric;
begin
  if p_value is null or jsonb_typeof(p_value) <> 'number' then
    return false;
  end if;

  v_text := p_value #>> '{}';
  -- Limit the text before casting so untrusted JSON cannot request an
  -- impractically large numeric allocation.
  if char_length(v_text) > 80
    or v_text !~ '^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$'
    or (p_integer and v_text !~ '^-?(?:0|[1-9][0-9]*)$') then
    return false;
  end if;

  begin
    v_number := v_text::numeric;
  exception when others then
    return false;
  end;

  return v_number between p_min and p_max;
end;
$$;

create or replace function public.journey_sync_is_iso_timestamp(p_value jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_text text;
begin
  if not public.journey_sync_is_text(p_value, 80, true) then
    return false;
  end if;

  v_text := p_value #>> '{}';
  if v_text !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$' then
    return false;
  end if;

  begin
    perform v_text::timestamptz;
  exception when others then
    return false;
  end;

  return true;
end;
$$;

create or replace function public.journey_sync_is_date(p_value jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_text text;
begin
  if not public.journey_sync_is_text(p_value, 10, true) then
    return false;
  end if;

  v_text := p_value #>> '{}';
  if v_text !~ '^\d{4}-\d{2}-\d{2}$' then
    return false;
  end if;

  begin
    perform v_text::date;
  exception when others then
    return false;
  end;

  return true;
end;
$$;

create or replace function public.journey_sync_is_text_array(
  p_value jsonb,
  p_max_items integer,
  p_max_item_length integer,
  p_require_nonblank boolean default true
)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_item jsonb;
begin
  if p_value is null
    or jsonb_typeof(p_value) <> 'array'
    or jsonb_array_length(p_value) > p_max_items then
    return false;
  end if;

  for v_item in select value from jsonb_array_elements(p_value)
  loop
    if not public.journey_sync_is_text(v_item, p_max_item_length, p_require_nonblank) then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

create or replace function public.journey_sync_valid_place(p_place jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  if p_place is null or jsonb_typeof(p_place) <> 'object' then
    return false;
  end if;

  if not public.journey_sync_is_text(p_place -> 'id', 200, true)
    or not public.journey_sync_is_text(p_place -> 'name_zh', 500, true)
    or not public.journey_sync_is_text(p_place -> 'name_en', 500, true)
    or not public.journey_sync_is_text(p_place -> 'code', 200, true)
    or not public.journey_sync_is_text(p_place -> 'country', 300, true)
    or not public.journey_sync_is_text(p_place -> 'time_zone', 120, true)
    or jsonb_typeof(p_place -> 'kind') <> 'string'
    or (p_place ->> 'kind') not in ('airport', 'station', 'custom')
    or not public.journey_sync_is_number(p_place -> 'latitude', -90, 90)
    or not public.journey_sync_is_number(p_place -> 'longitude', -180, 180) then
    return false;
  end if;

  if p_place ? 'city'
    and not public.journey_sync_is_text(p_place -> 'city', 120, true) then
    return false;
  end if;

  if p_place ? 'continent' then
    if jsonb_typeof(p_place -> 'continent') <> 'string'
      or (p_place ->> 'continent') not in (
        'africa', 'antarctica', 'asia', 'europe', 'north_america',
        'oceania', 'south_america'
      ) then
      return false;
    end if;
  end if;

  return true;
end;
$$;

create or replace function public.journey_sync_valid_members(p_members jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_member jsonb;
  v_id text;
  v_seen_ids text[] := array[]::text[];
begin
  if p_members is null
    or jsonb_typeof(p_members) <> 'array'
    or jsonb_array_length(p_members) > 200 then
    return false;
  end if;

  for v_member in select value from jsonb_array_elements(p_members)
  loop
    if jsonb_typeof(v_member) <> 'object'
      or not public.journey_sync_is_text(v_member -> 'id', 200, true)
      or not public.journey_sync_is_text(v_member -> 'name', 60, true) then
      return false;
    end if;

    v_id := v_member ->> 'id';
    if v_id = any(v_seen_ids) then
      return false;
    end if;
    v_seen_ids := array_append(v_seen_ids, v_id);
  end loop;

  return true;
end;
$$;

create or replace function public.journey_sync_valid_categories(p_categories jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_category jsonb;
  v_key text;
  v_seen_keys text[] := array[]::text[];
begin
  if p_categories is null
    or jsonb_typeof(p_categories) <> 'array'
    or jsonb_array_length(p_categories) > 200 then
    return false;
  end if;

  for v_category in select value from jsonb_array_elements(p_categories)
  loop
    if not public.journey_sync_is_text(v_category, 40, true) then
      return false;
    end if;

    v_key := lower(btrim(v_category #>> '{}'));
    if v_key = any(v_seen_keys) then
      return false;
    end if;
    v_seen_keys := array_append(v_seen_keys, v_key);
  end loop;

  return true;
end;
$$;

create or replace function public.journey_sync_valid_shares(
  p_shares jsonb,
  p_expected_amount bigint
)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_share jsonb;
  v_member_id text;
  v_seen_member_ids text[] := array[]::text[];
  v_amount bigint;
  v_total numeric := 0;
begin
  if p_shares is null
    or jsonb_typeof(p_shares) <> 'array'
    or jsonb_array_length(p_shares) = 0
    or jsonb_array_length(p_shares) > 200 then
    return false;
  end if;

  for v_share in select value from jsonb_array_elements(p_shares)
  loop
    if jsonb_typeof(v_share) <> 'object'
      or not public.journey_sync_is_text(v_share -> 'member_id', 200, true)
      or not public.journey_sync_is_number(
        v_share -> 'amount_minor',
        0,
        9007199254740991,
        true
      ) then
      return false;
    end if;

    v_member_id := v_share ->> 'member_id';
    if v_member_id = any(v_seen_member_ids) then
      return false;
    end if;
    v_seen_member_ids := array_append(v_seen_member_ids, v_member_id);

    v_amount := (v_share ->> 'amount_minor')::bigint;
    v_total := v_total + v_amount;
  end loop;

  return v_total = p_expected_amount;
end;
$$;

create or replace function public.journey_sync_same_share_members(
  p_left_shares jsonb,
  p_right_shares jsonb
)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_share jsonb;
  v_member_id text;
begin
  if jsonb_typeof(p_left_shares) <> 'array'
    or jsonb_typeof(p_right_shares) <> 'array'
    or jsonb_array_length(p_left_shares) <> jsonb_array_length(p_right_shares) then
    return false;
  end if;

  for v_share in select value from jsonb_array_elements(p_left_shares)
  loop
    v_member_id := v_share ->> 'member_id';
    if not exists (
      select 1
      from jsonb_array_elements(p_right_shares) as right_share(value)
      where right_share.value ->> 'member_id' = v_member_id
    ) then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

create or replace function public.journey_sync_valid_settlement(
  p_settlement jsonb,
  p_payment_currency text,
  p_payment_fraction_digits integer,
  p_expense_shares jsonb
)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_rate text;
  v_settlement_amount bigint;
  v_settlement_fraction_digits integer;
begin
  if jsonb_typeof(p_settlement) = 'null' then
    return true;
  end if;

  if jsonb_typeof(p_settlement) <> 'object'
    or not public.journey_sync_is_currency(p_settlement -> 'currency')
    or not public.journey_sync_is_number(
      p_settlement -> 'fraction_digits',
      0,
      3,
      true
    )
    or not public.journey_sync_is_number(
      p_settlement -> 'amount_minor',
      1,
      9007199254740991,
      true
    )
    or not public.journey_sync_is_text(p_settlement -> 'rate', 80, true)
    or not public.journey_sync_is_text(p_settlement -> 'source', 20, true)
    or (p_settlement ->> 'source') not in ('identity', 'automatic', 'manual') then
    return false;
  end if;

  v_rate := p_settlement ->> 'rate';
  if v_rate !~ '^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$' then
    return false;
  end if;

  begin
    if v_rate::numeric <= 0 then
      return false;
    end if;
  exception when others then
    return false;
  end;

  if p_settlement ? 'provider'
    and not public.journey_sync_is_text(p_settlement -> 'provider', 120, true) then
    return false;
  end if;

  if p_settlement ? 'rate_date'
    and not public.journey_sync_is_date(p_settlement -> 'rate_date') then
    return false;
  end if;

  if p_settlement ? 'quoted_at'
    and not public.journey_sync_is_iso_timestamp(p_settlement -> 'quoted_at') then
    return false;
  end if;

  v_settlement_amount := (p_settlement ->> 'amount_minor')::bigint;
  v_settlement_fraction_digits := (p_settlement ->> 'fraction_digits')::integer;
  if not public.journey_sync_valid_shares(p_settlement -> 'shares', v_settlement_amount)
    or not public.journey_sync_same_share_members(
      p_expense_shares,
      p_settlement -> 'shares'
    ) then
    return false;
  end if;

  if p_settlement ->> 'source' = 'identity' then
    if p_settlement ->> 'currency' <> p_payment_currency
      or v_settlement_fraction_digits <> p_payment_fraction_digits
      or v_rate !~ '^1(?:\.0+)?$' then
      return false;
    end if;
  end if;

  return true;
end;
$$;

create or replace function public.journey_sync_valid_trip(p_payload jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_departure timestamptz;
  v_arrival timestamptz;
begin
  if jsonb_typeof(p_payload) <> 'object'
    or jsonb_typeof(p_payload -> 'mode') <> 'string'
    or (p_payload ->> 'mode') not in ('flight', 'rail', 'cruise', 'other')
    or not public.journey_sync_valid_place(p_payload -> 'origin')
    or not public.journey_sync_valid_place(p_payload -> 'destination')
    or not public.journey_sync_is_iso_timestamp(p_payload -> 'departure')
    or not public.journey_sync_is_iso_timestamp(p_payload -> 'arrival')
    or not public.journey_sync_is_text(p_payload -> 'carrier', 1000, false)
    or not public.journey_sync_is_text(p_payload -> 'service_number', 1000, false)
    or not public.journey_sync_is_text(p_payload -> 'seat_class', 500, false)
    or not public.journey_sync_is_text(p_payload -> 'seat', 500, false)
    or not public.journey_sync_is_number(p_payload -> 'distance_km', 0, 9007199254740991)
    or jsonb_typeof(p_payload -> 'distance_is_estimate') <> 'boolean'
    or not public.journey_sync_is_number(
      p_payload -> 'duration_min',
      1,
      9007199254740991,
      true
    )
    or not public.journey_sync_is_text(p_payload -> 'notes', 100000, false)
    or not public.journey_sync_is_iso_timestamp(p_payload -> 'created_at')
    or not public.journey_sync_is_iso_timestamp(p_payload -> 'updated_at') then
    return false;
  end if;

  begin
    v_departure := (p_payload ->> 'departure')::timestamptz;
    v_arrival := (p_payload ->> 'arrival')::timestamptz;
  exception when others then
    return false;
  end;
  if v_arrival <= v_departure then
    return false;
  end if;

  if p_payload ? 'carrier_code' then
    if not public.journey_sync_is_text(p_payload -> 'carrier_code', 16, true)
      or (p_payload ->> 'carrier_code') !~ '^[A-Z0-9](?:[A-Z0-9-]{0,14}[A-Z0-9])?$' then
      return false;
    end if;
  end if;

  if p_payload ? 'carrier_logo_url' then
    if not public.journey_sync_is_text(p_payload -> 'carrier_logo_url', 2048, true)
      or lower(p_payload ->> 'carrier_logo_url') !~ '^https?://[^[:space:]]+$' then
      return false;
    end if;
  end if;

  if p_payload ? 'purpose' then
    if jsonb_typeof(p_payload -> 'purpose') <> 'string'
      or (p_payload ->> 'purpose') not in ('leisure', 'business', 'personal', 'other') then
      return false;
    end if;
  end if;

  if p_payload ? 'vehicle_type'
    and not public.journey_sync_is_text(p_payload -> 'vehicle_type', 500, false) then
    return false;
  end if;

  if p_payload ? 'tags'
    and not public.journey_sync_is_text_array(p_payload -> 'tags', 1000, 500, false) then
    return false;
  end if;

  if p_payload ? 'is_demo'
    and jsonb_typeof(p_payload -> 'is_demo') <> 'boolean' then
    return false;
  end if;

  return true;
end;
$$;

create or replace function public.journey_sync_valid_custom_place(p_payload jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog, public
as $$
  select public.journey_sync_valid_place(p_payload);
$$;

create or replace function public.journey_sync_valid_expense_settings(p_payload jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  if jsonb_typeof(p_payload) <> 'object'
    or p_payload ->> 'id' <> 'expense-ledger'
    or not public.journey_sync_valid_members(p_payload -> 'members')
    or not public.journey_sync_valid_categories(p_payload -> 'categories')
    or not public.journey_sync_is_iso_timestamp(p_payload -> 'created_at')
    or not public.journey_sync_is_iso_timestamp(p_payload -> 'updated_at') then
    return false;
  end if;

  if not (p_payload ? 'settlement_currency') then
    return false;
  end if;

  if jsonb_typeof(p_payload -> 'settlement_currency') <> 'null'
    and not public.journey_sync_is_currency(p_payload -> 'settlement_currency') then
    return false;
  end if;

  return true;
end;
$$;

create or replace function public.journey_sync_valid_expense(p_payload jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_amount bigint;
  v_fraction_digits integer;
  v_currency text;
begin
  if jsonb_typeof(p_payload) <> 'object'
    or not public.journey_sync_is_text(p_payload -> 'title', 120, true)
    or not public.journey_sync_is_text(p_payload -> 'category', 40, true)
    or not public.journey_sync_is_number(
      p_payload -> 'amount_minor',
      1,
      9007199254740991,
      true
    )
    or not public.journey_sync_is_currency(p_payload -> 'currency')
    or not public.journey_sync_is_number(p_payload -> 'fraction_digits', 0, 3, true)
    or not public.journey_sync_is_text(p_payload -> 'paid_by', 200, true)
    or not public.journey_sync_is_date(p_payload -> 'date')
    or not public.journey_sync_is_text(p_payload -> 'notes', 1000, false)
    or not public.journey_sync_is_iso_timestamp(p_payload -> 'created_at')
    or not public.journey_sync_is_iso_timestamp(p_payload -> 'updated_at')
    or not (p_payload ? 'settlement') then
    return false;
  end if;

  v_amount := (p_payload ->> 'amount_minor')::bigint;
  v_fraction_digits := (p_payload ->> 'fraction_digits')::integer;
  v_currency := p_payload ->> 'currency';

  if not public.journey_sync_valid_shares(p_payload -> 'shares', v_amount) then
    return false;
  end if;

  return public.journey_sync_valid_settlement(
    p_payload -> 'settlement',
    v_currency,
    v_fraction_digits,
    p_payload -> 'shares'
  );
end;
$$;

create or replace function public.journey_sync_valid_entity(
  p_entity text,
  p_id text,
  p_payload jsonb
)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  if p_id is null
    or p_id <> btrim(p_id)
    or char_length(p_id) = 0
    or char_length(p_id) > 200
    or p_payload is null
    or jsonb_typeof(p_payload) <> 'object'
    or octet_length(p_payload::text) > 262144
    or not public.journey_sync_is_text(p_payload -> 'id', 200, true)
    or p_payload ->> 'id' <> p_id then
    return false;
  end if;

  case p_entity
    -- The plural keys are the snapshot contract. The singular aliases keep the
    -- browser outbox API concise without changing the wire response shape.
    when 'trips', 'trip' then
      return public.journey_sync_valid_trip(p_payload);
    when 'custom_places', 'custom_place' then
      return public.journey_sync_valid_custom_place(p_payload);
    when 'expense_settings' then
      return public.journey_sync_valid_expense_settings(p_payload);
    when 'expense_entries', 'expense' then
      return public.journey_sync_valid_expense(p_payload);
    else
      return false;
  end case;
end;
$$;

create or replace function public.journey_sync_entity_table(p_entity text)
returns text
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  case p_entity
    when 'trips', 'trip' then return 'journey_trips';
    when 'custom_places', 'custom_place' then return 'journey_custom_places';
    when 'expense_settings' then return 'journey_expense_settings';
    when 'expense_entries', 'expense' then return 'journey_expense_entries';
    else
      raise exception 'Unknown Journey Log sync entity.' using errcode = '22023';
  end case;
end;
$$;

create or replace function public.journey_sync_table_entity(p_table name)
returns text
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  case p_table::text
    when 'journey_trips' then return 'trips';
    when 'journey_custom_places' then return 'custom_places';
    when 'journey_expense_settings' then return 'expense_settings';
    when 'journey_expense_entries' then return 'expense_entries';
    else
      raise exception 'Unknown Journey Log sync table.' using errcode = '22023';
  end case;
end;
$$;

-- ---------------------------------------------------------------------------
-- Private entity tables
-- ---------------------------------------------------------------------------

create table if not exists public.journey_trips (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null check (id = btrim(id) and char_length(id) between 1 and 200),
  payload jsonb check (payload is null or (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 262144)),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default statement_timestamp(),
  revision bigint not null default 1 check (revision >= 1),
  primary key (owner_id, id),
  check (updated_at >= created_at)
);

create table if not exists public.journey_custom_places (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null check (id = btrim(id) and char_length(id) between 1 and 200),
  payload jsonb check (payload is null or (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 262144)),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default statement_timestamp(),
  revision bigint not null default 1 check (revision >= 1),
  primary key (owner_id, id),
  check (updated_at >= created_at)
);

create table if not exists public.journey_expense_settings (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null check (id = btrim(id) and char_length(id) between 1 and 200),
  payload jsonb check (payload is null or (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 262144)),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default statement_timestamp(),
  revision bigint not null default 1 check (revision >= 1),
  primary key (owner_id, id),
  check (id = 'expense-ledger'),
  check (updated_at >= created_at)
);

create table if not exists public.journey_expense_entries (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null check (id = btrim(id) and char_length(id) between 1 and 200),
  payload jsonb check (payload is null or (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 262144)),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default statement_timestamp(),
  revision bigint not null default 1 check (revision >= 1),
  primary key (owner_id, id),
  check (updated_at >= created_at)
);

-- Active records always have a validated payload. A delete keeps only a small
-- tombstone (owner, id, timestamps, revision) so the deletion can sync without
-- retaining the travel or expense content in the cloud.
alter table public.journey_trips alter column payload drop not null;
alter table public.journey_custom_places alter column payload drop not null;
alter table public.journey_expense_settings alter column payload drop not null;
alter table public.journey_expense_entries alter column payload drop not null;

comment on column public.journey_trips.created_at is
  'Local entity creation time, retained for round-tripping the local-first record.';
comment on column public.journey_trips.updated_at is
  'Local entity update time; optimistic conflicts use revision rather than this client-clock value.';
comment on column public.journey_trips.server_updated_at is
  'Database-controlled timestamp of the last accepted mutation.';
comment on column public.journey_trips.revision is
  'Database-controlled optimistic-concurrency revision.';

create index if not exists journey_trips_owner_server_updated_idx
  on public.journey_trips (owner_id, server_updated_at, id);
create index if not exists journey_custom_places_owner_server_updated_idx
  on public.journey_custom_places (owner_id, server_updated_at, id);
create index if not exists journey_expense_settings_owner_server_updated_idx
  on public.journey_expense_settings (owner_id, server_updated_at, id);
create index if not exists journey_expense_entries_owner_server_updated_idx
  on public.journey_expense_entries (owner_id, server_updated_at, id);

-- This trigger owns server metadata. A client may send its own domain
-- timestamps, but cannot choose the sync revision, server timestamp, owner,
-- primary key, or deletion timestamp.
create or replace function public.journey_sync_stamp_and_validate()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_entity text;
  v_now timestamptz := clock_timestamp();
begin
  v_entity := public.journey_sync_table_entity(TG_TABLE_NAME);

  if new.deleted_at is null
    and not public.journey_sync_valid_entity(v_entity, new.id, new.payload) then
    raise exception 'Invalid Journey Log % payload.', v_entity using errcode = '22023';
  end if;

  if new.owner_id is null
    or new.created_at is null
    or new.updated_at is null
    or new.updated_at < new.created_at then
    raise exception 'Invalid Journey Log sync metadata.' using errcode = '22023';
  end if;

  if TG_OP = 'INSERT' then
    if new.deleted_at is not null then
      raise exception 'A Journey Log record cannot be created as deleted.' using errcode = '22023';
    end if;
    new.revision := 1;
  else
    if new.owner_id is distinct from old.owner_id
      or new.id is distinct from old.id
      or new.created_at is distinct from old.created_at then
      raise exception 'Journey Log identity metadata is immutable.' using errcode = '22023';
    end if;

    if old.deleted_at is not null then
      raise exception 'A deleted Journey Log record is immutable.' using errcode = '55000';
    end if;

    if new.deleted_at is not null then
      new.deleted_at := v_now;
    end if;
    new.revision := old.revision + 1;
  end if;

  new.server_updated_at := v_now;
  return new;
end;
$$;

drop trigger if exists journey_sync_stamp_and_validate on public.journey_trips;
create trigger journey_sync_stamp_and_validate
before insert or update on public.journey_trips
for each row execute function public.journey_sync_stamp_and_validate();

drop trigger if exists journey_sync_stamp_and_validate on public.journey_custom_places;
create trigger journey_sync_stamp_and_validate
before insert or update on public.journey_custom_places
for each row execute function public.journey_sync_stamp_and_validate();

drop trigger if exists journey_sync_stamp_and_validate on public.journey_expense_settings;
create trigger journey_sync_stamp_and_validate
before insert or update on public.journey_expense_settings
for each row execute function public.journey_sync_stamp_and_validate();

drop trigger if exists journey_sync_stamp_and_validate on public.journey_expense_entries;
create trigger journey_sync_stamp_and_validate
before insert or update on public.journey_expense_entries
for each row execute function public.journey_sync_stamp_and_validate();

-- ---------------------------------------------------------------------------
-- Row-level security and privileges
-- ---------------------------------------------------------------------------

alter table public.journey_trips enable row level security;
alter table public.journey_custom_places enable row level security;
alter table public.journey_expense_settings enable row level security;
alter table public.journey_expense_entries enable row level security;
alter table public.journey_trips force row level security;
alter table public.journey_custom_places force row level security;
alter table public.journey_expense_settings force row level security;
alter table public.journey_expense_entries force row level security;

-- These policies retain an owner-only security boundary if a future migration
-- grants direct read access. The present browser role has no table privileges:
-- it must use the RPCs below, so it cannot bypass revision checks.
drop policy if exists journey_trips_owner_select on public.journey_trips;
create policy journey_trips_owner_select on public.journey_trips
for select to authenticated
using ((select auth.uid()) = owner_id);
drop policy if exists journey_trips_owner_insert on public.journey_trips;
create policy journey_trips_owner_insert on public.journey_trips
for insert to authenticated
with check ((select auth.uid()) = owner_id);
drop policy if exists journey_trips_owner_update on public.journey_trips;
create policy journey_trips_owner_update on public.journey_trips
for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists journey_custom_places_owner_select on public.journey_custom_places;
create policy journey_custom_places_owner_select on public.journey_custom_places
for select to authenticated
using ((select auth.uid()) = owner_id);
drop policy if exists journey_custom_places_owner_insert on public.journey_custom_places;
create policy journey_custom_places_owner_insert on public.journey_custom_places
for insert to authenticated
with check ((select auth.uid()) = owner_id);
drop policy if exists journey_custom_places_owner_update on public.journey_custom_places;
create policy journey_custom_places_owner_update on public.journey_custom_places
for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists journey_expense_settings_owner_select on public.journey_expense_settings;
create policy journey_expense_settings_owner_select on public.journey_expense_settings
for select to authenticated
using ((select auth.uid()) = owner_id);
drop policy if exists journey_expense_settings_owner_insert on public.journey_expense_settings;
create policy journey_expense_settings_owner_insert on public.journey_expense_settings
for insert to authenticated
with check ((select auth.uid()) = owner_id);
drop policy if exists journey_expense_settings_owner_update on public.journey_expense_settings;
create policy journey_expense_settings_owner_update on public.journey_expense_settings
for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists journey_expense_entries_owner_select on public.journey_expense_entries;
create policy journey_expense_entries_owner_select on public.journey_expense_entries
for select to authenticated
using ((select auth.uid()) = owner_id);
drop policy if exists journey_expense_entries_owner_insert on public.journey_expense_entries;
create policy journey_expense_entries_owner_insert on public.journey_expense_entries
for insert to authenticated
with check ((select auth.uid()) = owner_id);
drop policy if exists journey_expense_entries_owner_update on public.journey_expense_entries;
create policy journey_expense_entries_owner_update on public.journey_expense_entries
for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

-- Do not grant a browser role direct table access. In particular, no DELETE
-- policy is created: deletion is a tombstone written by the RPC below.
revoke all on table public.journey_trips from anon, authenticated;
revoke all on table public.journey_custom_places from anon, authenticated;
revoke all on table public.journey_expense_settings from anon, authenticated;
revoke all on table public.journey_expense_entries from anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC wire helpers
-- ---------------------------------------------------------------------------

create or replace function public.journey_sync_remote_row(
  p_id text,
  p_payload jsonb,
  p_created_at timestamptz,
  p_updated_at timestamptz,
  p_deleted_at timestamptz,
  p_revision bigint
)
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $$
  select jsonb_build_object(
    'id', p_id,
    'payload', p_payload,
    'created_at', p_created_at,
    'updated_at', p_updated_at,
    'deleted_at', p_deleted_at,
    'revision', p_revision
  );
$$;

create or replace function public.journey_sync_require_user()
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_owner uuid := auth.uid();
begin
  if v_owner is null then
    raise exception 'Journey Log sync requires an authenticated user.' using errcode = '42501';
  end if;
  return v_owner;
end;
$$;

create or replace function public.journey_sync_assert_write_input(
  p_entity text,
  p_id text,
  p_payload jsonb,
  p_created_at timestamptz,
  p_updated_at timestamptz,
  p_expected_revision bigint default null
)
returns void
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  -- Also validates the entity name before it can ever be interpolated into a
  -- dynamic SQL identifier in the RPCs.
  perform public.journey_sync_entity_table(p_entity);

  if p_created_at is null
    or p_updated_at is null
    or p_updated_at < p_created_at
    or (p_expected_revision is not null and p_expected_revision < 0)
    or not public.journey_sync_valid_entity(p_entity, p_id, p_payload) then
    raise exception 'Invalid Journey Log sync write.' using errcode = '22023';
  end if;
end;
$$;

-- Returns exactly:
-- {
--   trips: RemoteRow[], custom_places: RemoteRow[],
--   expense_settings: RemoteRow[], expense_entries: RemoteRow[]
-- }
-- where RemoteRow is { id, payload, created_at, updated_at, deleted_at,
-- revision }. Tombstones are intentionally included so another device can
-- remove records that were deleted elsewhere.
create or replace function public.journey_sync_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_owner uuid := public.journey_sync_require_user();
  v_trips jsonb;
  v_custom_places jsonb;
  v_expense_settings jsonb;
  v_expense_entries jsonb;
begin
  select coalesce(
    jsonb_agg(
      public.journey_sync_remote_row(
        id, payload, created_at, updated_at, deleted_at, revision
      )
      order by server_updated_at, id
    ),
    '[]'::jsonb
  )
  into v_trips
  from public.journey_trips
  where owner_id = v_owner;

  select coalesce(
    jsonb_agg(
      public.journey_sync_remote_row(
        id, payload, created_at, updated_at, deleted_at, revision
      )
      order by server_updated_at, id
    ),
    '[]'::jsonb
  )
  into v_custom_places
  from public.journey_custom_places
  where owner_id = v_owner;

  select coalesce(
    jsonb_agg(
      public.journey_sync_remote_row(
        id, payload, created_at, updated_at, deleted_at, revision
      )
      order by server_updated_at, id
    ),
    '[]'::jsonb
  )
  into v_expense_settings
  from public.journey_expense_settings
  where owner_id = v_owner;

  select coalesce(
    jsonb_agg(
      public.journey_sync_remote_row(
        id, payload, created_at, updated_at, deleted_at, revision
      )
      order by server_updated_at, id
    ),
    '[]'::jsonb
  )
  into v_expense_entries
  from public.journey_expense_entries
  where owner_id = v_owner;

  return jsonb_build_object(
    'trips', v_trips,
    'custom_places', v_custom_places,
    'expense_settings', v_expense_settings,
    'expense_entries', v_expense_entries
  );
end;
$$;

-- Conditionally inserts or replaces one active record. A new record accepts
-- expected_revision NULL or 0; an existing record needs its exact current
-- revision. The response is always `{ status: 'applied'|'conflict', record:
-- RemoteRow|null }`. A same-payload retry is reported as applied, making a
-- lost HTTP response safe to retry from an outbox.
create or replace function public.journey_sync_upsert(
  p_entity text,
  p_id text,
  p_payload jsonb,
  p_created_at timestamptz,
  p_updated_at timestamptz,
  p_expected_revision bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_owner uuid := public.journey_sync_require_user();
  v_table text;
  v_current record;
  v_saved record;
  v_row_count integer;
begin
  perform public.journey_sync_assert_write_input(
    p_entity,
    p_id,
    p_payload,
    p_created_at,
    p_updated_at,
    p_expected_revision
  );
  v_table := public.journey_sync_entity_table(p_entity);

  execute format(
    'select id, payload, created_at, updated_at, deleted_at, revision
     from public.%I
     where owner_id = $1 and id = $2
     for update',
    v_table
  ) into v_current using v_owner, p_id;
  get diagnostics v_row_count = row_count;

  if v_row_count = 1 then
    if v_current.deleted_at is not null then
      return jsonb_build_object(
        'status', 'conflict',
        'record', public.journey_sync_remote_row(
          v_current.id,
          v_current.payload,
          v_current.created_at,
          v_current.updated_at,
          v_current.deleted_at,
          v_current.revision
        )
      );
    end if;

    if p_expected_revision is null
      or p_expected_revision <> v_current.revision then
      if v_current.payload = p_payload and v_current.updated_at = p_updated_at then
        return jsonb_build_object(
          'status', 'applied',
          'record', public.journey_sync_remote_row(
            v_current.id,
            v_current.payload,
            v_current.created_at,
            v_current.updated_at,
            v_current.deleted_at,
            v_current.revision
          )
        );
      end if;

      return jsonb_build_object(
        'status', 'conflict',
        'record', public.journey_sync_remote_row(
          v_current.id,
          v_current.payload,
          v_current.created_at,
          v_current.updated_at,
          v_current.deleted_at,
          v_current.revision
        )
      );
    end if;

    execute format(
      'update public.%I
       set payload = $1, updated_at = $2
       where owner_id = $3 and id = $4
       returning id, payload, created_at, updated_at, deleted_at, revision',
      v_table
    ) into v_saved using p_payload, p_updated_at, v_owner, p_id;

    return jsonb_build_object(
      'status', 'applied',
      'record', public.journey_sync_remote_row(
        v_saved.id,
        v_saved.payload,
        v_saved.created_at,
        v_saved.updated_at,
        v_saved.deleted_at,
        v_saved.revision
      )
    );
  end if;

  if p_expected_revision is not null and p_expected_revision <> 0 then
    return jsonb_build_object('status', 'conflict', 'record', null);
  end if;

  execute format(
    'insert into public.%I (owner_id, id, payload, created_at, updated_at)
     values ($1, $2, $3, $4, $5)
     on conflict (owner_id, id) do nothing
     returning id, payload, created_at, updated_at, deleted_at, revision',
    v_table
  ) into v_saved using v_owner, p_id, p_payload, p_created_at, p_updated_at;
  get diagnostics v_row_count = row_count;

  if v_row_count = 1 then
    return jsonb_build_object(
      'status', 'applied',
      'record', public.journey_sync_remote_row(
        v_saved.id,
        v_saved.payload,
        v_saved.created_at,
        v_saved.updated_at,
        v_saved.deleted_at,
        v_saved.revision
      )
    );
  end if;

  -- Another device inserted the same id between our read and insert. Return
  -- its latest state rather than allowing a blind replacement.
  execute format(
    'select id, payload, created_at, updated_at, deleted_at, revision
     from public.%I
     where owner_id = $1 and id = $2
     for update',
    v_table
  ) into v_current using v_owner, p_id;
  get diagnostics v_row_count = row_count;

  if v_row_count = 1 then
    return jsonb_build_object(
      'status', 'conflict',
      'record', public.journey_sync_remote_row(
        v_current.id,
        v_current.payload,
        v_current.created_at,
        v_current.updated_at,
        v_current.deleted_at,
        v_current.revision
      )
    );
  end if;

  return jsonb_build_object('status', 'conflict', 'record', null);
end;
$$;

-- Soft-deletes one record without ever issuing SQL DELETE. `record` includes
-- the tombstone on success so the client can persist the newer revision. A
-- retry against an already-deleted record is considered applied because the
-- requested final state has already been reached.
create or replace function public.journey_sync_soft_delete(
  p_entity text,
  p_id text,
  p_updated_at timestamptz,
  p_expected_revision bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_owner uuid := public.journey_sync_require_user();
  v_table text;
  v_current record;
  v_saved record;
  v_row_count integer;
begin
  v_table := public.journey_sync_entity_table(p_entity);
  if p_id is null
    or p_id <> btrim(p_id)
    or char_length(p_id) = 0
    or char_length(p_id) > 200
    or p_updated_at is null
    or (p_expected_revision is not null and p_expected_revision < 0) then
    raise exception 'Invalid Journey Log sync delete.' using errcode = '22023';
  end if;

  execute format(
    'select id, payload, created_at, updated_at, deleted_at, revision
     from public.%I
     where owner_id = $1 and id = $2
     for update',
    v_table
  ) into v_current using v_owner, p_id;
  get diagnostics v_row_count = row_count;

  if v_row_count = 0 then
    return jsonb_build_object('status', 'conflict', 'record', null);
  end if;

  if v_current.deleted_at is not null then
    return jsonb_build_object(
      'status', 'applied',
      'record', public.journey_sync_remote_row(
        v_current.id,
        v_current.payload,
        v_current.created_at,
        v_current.updated_at,
        v_current.deleted_at,
        v_current.revision
      )
    );
  end if;

  if p_expected_revision is null
    or p_expected_revision <> v_current.revision then
    return jsonb_build_object(
      'status', 'conflict',
      'record', public.journey_sync_remote_row(
        v_current.id,
        v_current.payload,
        v_current.created_at,
        v_current.updated_at,
        v_current.deleted_at,
        v_current.revision
      )
    );
  end if;

  execute format(
    'update public.%I
     set payload = null, updated_at = $1, deleted_at = clock_timestamp()
     where owner_id = $2 and id = $3
     returning id, payload, created_at, updated_at, deleted_at, revision',
    v_table
  ) into v_saved using p_updated_at, v_owner, p_id;

  return jsonb_build_object(
    'status', 'applied',
    'record', public.journey_sync_remote_row(
      v_saved.id,
      v_saved.payload,
      v_saved.created_at,
      v_saved.updated_at,
      v_saved.deleted_at,
      v_saved.revision
    )
  );
end;
$$;

-- Explicit conflict-resolution delete. This is intentionally separate from
-- normal soft delete: callers should reach it only after showing a conflict to
-- the owner and receiving a deliberate "delete this version" decision.
create or replace function public.journey_sync_force_delete(
  p_entity text,
  p_id text,
  p_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_owner uuid := public.journey_sync_require_user();
  v_table text;
  v_current record;
  v_saved record;
  v_row_count integer;
begin
  v_table := public.journey_sync_entity_table(p_entity);
  if p_id is null
    or p_id <> btrim(p_id)
    or char_length(p_id) = 0
    or char_length(p_id) > 200
    or p_updated_at is null then
    raise exception 'Invalid Journey Log force delete.' using errcode = '22023';
  end if;

  execute format(
    'select id, payload, created_at, updated_at, deleted_at, revision
     from public.%I
     where owner_id = $1 and id = $2
     for update',
    v_table
  ) into v_current using v_owner, p_id;
  get diagnostics v_row_count = row_count;

  if v_row_count = 0 then
    raise exception 'Journey Log record does not exist.' using errcode = 'P0002';
  end if;

  if v_current.deleted_at is not null then
    return jsonb_build_object(
      'status', 'applied',
      'record', public.journey_sync_remote_row(
        v_current.id,
        v_current.payload,
        v_current.created_at,
        v_current.updated_at,
        v_current.deleted_at,
        v_current.revision
      )
    );
  end if;

  if p_updated_at < v_current.created_at then
    raise exception 'Invalid Journey Log sync metadata.' using errcode = '22023';
  end if;

  execute format(
    'update public.%I
     set payload = null, updated_at = $1, deleted_at = clock_timestamp()
     where owner_id = $2 and id = $3
     returning id, payload, created_at, updated_at, deleted_at, revision',
    v_table
  ) into v_saved using p_updated_at, v_owner, p_id;

  return jsonb_build_object(
    'status', 'applied',
    'record', public.journey_sync_remote_row(
      v_saved.id,
      v_saved.payload,
      v_saved.created_at,
      v_saved.updated_at,
      v_saved.deleted_at,
      v_saved.revision
    )
  );
end;
$$;

-- Explicit conflict-resolution escape hatch. It accepts the same validated
-- input as normal upsert but intentionally ignores a previous revision. The
-- client must call this only after a person chooses to keep the local version.
-- It still refuses to resurrect a tombstone; restoring deleted data should be
-- a separately designed, user-visible action rather than a sync side effect.
create or replace function public.journey_sync_force_upsert(
  p_entity text,
  p_id text,
  p_payload jsonb,
  p_created_at timestamptz,
  p_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_owner uuid := public.journey_sync_require_user();
  v_table text;
  v_current record;
  v_saved record;
  v_row_count integer;
begin
  perform public.journey_sync_assert_write_input(
    p_entity,
    p_id,
    p_payload,
    p_created_at,
    p_updated_at,
    null
  );
  v_table := public.journey_sync_entity_table(p_entity);

  execute format(
    'select id, payload, created_at, updated_at, deleted_at, revision
     from public.%I
     where owner_id = $1 and id = $2
     for update',
    v_table
  ) into v_current using v_owner, p_id;
  get diagnostics v_row_count = row_count;

  if v_row_count = 1 then
    if v_current.deleted_at is not null then
      return jsonb_build_object(
        'status', 'conflict',
        'record', public.journey_sync_remote_row(
          v_current.id,
          v_current.payload,
          v_current.created_at,
          v_current.updated_at,
          v_current.deleted_at,
          v_current.revision
        )
      );
    end if;

    execute format(
      'update public.%I
       set payload = $1, updated_at = $2
       where owner_id = $3 and id = $4
       returning id, payload, created_at, updated_at, deleted_at, revision',
      v_table
    ) into v_saved using p_payload, p_updated_at, v_owner, p_id;

    return jsonb_build_object(
      'status', 'applied',
      'record', public.journey_sync_remote_row(
        v_saved.id,
        v_saved.payload,
        v_saved.created_at,
        v_saved.updated_at,
        v_saved.deleted_at,
        v_saved.revision
      )
    );
  end if;

  execute format(
    'insert into public.%I (owner_id, id, payload, created_at, updated_at)
     values ($1, $2, $3, $4, $5)
     on conflict (owner_id, id) do nothing
     returning id, payload, created_at, updated_at, deleted_at, revision',
    v_table
  ) into v_saved using v_owner, p_id, p_payload, p_created_at, p_updated_at;
  get diagnostics v_row_count = row_count;

  if v_row_count = 1 then
    return jsonb_build_object(
      'status', 'applied',
      'record', public.journey_sync_remote_row(
        v_saved.id,
        v_saved.payload,
        v_saved.created_at,
        v_saved.updated_at,
        v_saved.deleted_at,
        v_saved.revision
      )
    );
  end if;

  -- If a concurrent device wins the first insert, lock that row and force the
  -- requested conflict-resolution update unless it is now a tombstone.
  execute format(
    'select id, payload, created_at, updated_at, deleted_at, revision
     from public.%I
     where owner_id = $1 and id = $2
     for update',
    v_table
  ) into v_current using v_owner, p_id;
  get diagnostics v_row_count = row_count;

  if v_row_count = 0 or v_current.deleted_at is not null then
    if v_row_count = 0 then
      return jsonb_build_object('status', 'conflict', 'record', null);
    end if;

    return jsonb_build_object(
      'status', 'conflict',
      'record', public.journey_sync_remote_row(
        v_current.id,
        v_current.payload,
        v_current.created_at,
        v_current.updated_at,
        v_current.deleted_at,
        v_current.revision
      )
    );
  end if;

  execute format(
    'update public.%I
     set payload = $1, updated_at = $2
     where owner_id = $3 and id = $4
     returning id, payload, created_at, updated_at, deleted_at, revision',
    v_table
  ) into v_saved using p_payload, p_updated_at, v_owner, p_id;

  return jsonb_build_object(
    'status', 'applied',
    'record', public.journey_sync_remote_row(
      v_saved.id,
      v_saved.payload,
      v_saved.created_at,
      v_saved.updated_at,
      v_saved.deleted_at,
      v_saved.revision
    )
  );
end;
$$;

comment on function public.journey_sync_snapshot() is
  'Returns the authenticated owner''s complete four-entity snapshot, including payload-redacted tombstones.';
comment on function public.journey_sync_upsert(text, text, jsonb, timestamptz, timestamptz, bigint) is
  'Optimistic private upsert. Returns {status: applied|conflict, record: RemoteRow|null}; expected revision is required for existing rows.';
comment on function public.journey_sync_soft_delete(text, text, timestamptz, bigint) is
  'Optimistic private delete. Redacts the payload and returns a tombstone; never issues SQL DELETE.';
comment on function public.journey_sync_force_delete(text, text, timestamptz) is
  'Intentional conflict-resolution soft delete. Ignores revision and returns the resulting RemoteRow.';
comment on function public.journey_sync_force_upsert(text, text, jsonb, timestamptz, timestamptz) is
  'Intentional conflict-resolution upsert. Ignores revision but never resurrects a tombstone.';

-- Lock down helper and table access. Only logged-in users may call the public
-- sync RPCs; anonymous visitors cannot enumerate or mutate any cloud data.
revoke all on function public.journey_sync_snapshot() from public;
revoke all on function public.journey_sync_upsert(text, text, jsonb, timestamptz, timestamptz, bigint) from public;
revoke all on function public.journey_sync_soft_delete(text, text, timestamptz, bigint) from public;
revoke all on function public.journey_sync_force_delete(text, text, timestamptz) from public;
revoke all on function public.journey_sync_force_upsert(text, text, jsonb, timestamptz, timestamptz) from public;

grant execute on function public.journey_sync_snapshot() to authenticated;
grant execute on function public.journey_sync_upsert(text, text, jsonb, timestamptz, timestamptz, bigint) to authenticated;
grant execute on function public.journey_sync_soft_delete(text, text, timestamptz, bigint) to authenticated;
grant execute on function public.journey_sync_force_delete(text, text, timestamptz) to authenticated;
grant execute on function public.journey_sync_force_upsert(text, text, jsonb, timestamptz, timestamptz) to authenticated;

commit;
