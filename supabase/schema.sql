-- Nutribites · esquema de base de datos para Supabase.
-- Pégalo completo en Supabase → SQL Editor → Run. Es seguro volver a ejecutarlo.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null default '',
  rol text not null default 'vendedor' check (rol in ('admin','vendedor')),
  color text not null default '#FF8C42',
  telefono text
);
alter table public.profiles add column if not exists telefono text;

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null default 'Tienda',
  direccion text,
  telefono text,
  lat double precision not null,
  lng double precision not null,
  creado_at timestamptz not null default now()
);

create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  precio numeric(10,2) not null check (precio >= 0),
  activo boolean not null default true
);

create table if not exists public.rutas (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references public.profiles(id) on delete cascade,
  fecha date not null,
  ultima_lat double precision,
  ultima_lng double precision,
  ultima_at timestamptz,
  unique (vendedor_id, fecha)
);

create table if not exists public.ruta_paradas (
  id uuid primary key default gen_random_uuid(),
  ruta_id uuid not null references public.rutas(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id),
  orden int not null,
  estado text not null default 'pendiente' check (estado in ('pendiente','visitado','no_compra')),
  llegada_at timestamptz,
  llegada_lat double precision,
  llegada_lng double precision,
  distancia_m int,
  motivo text,
  nota text
);

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  parada_id uuid not null references public.ruta_paradas(id) on delete cascade,
  vendedor_id uuid not null references public.profiles(id),
  cliente_id uuid not null references public.clientes(id),
  fecha date not null,
  items jsonb not null,
  total numeric(10,2) not null check (total >= 0),
  creado_at timestamptz not null default now()
);
create index if not exists pedidos_fecha on public.pedidos(fecha);
create index if not exists rutas_fecha on public.rutas(fecha);

-- ¿El usuario actual es administrador?
create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.profiles where id = auth.uid() and rol = 'admin') $$;

-- Al crear un usuario en Authentication se crea su perfil como vendedor.
create or replace function public.nuevo_perfil() returns trigger
language plpgsql security definer set search_path = public as
$$ begin
  insert into public.profiles (id, nombre) values (new.id, coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.nuevo_perfil();

-- Seguridad por filas (RLS): el vendedor solo toca lo suyo; el admin todo.
alter table public.profiles     enable row level security;
alter table public.clientes     enable row level security;
alter table public.productos    enable row level security;
alter table public.rutas        enable row level security;
alter table public.ruta_paradas enable row level security;
alter table public.pedidos      enable row level security;

drop policy if exists p_prof_sel on public.profiles;
create policy p_prof_sel on public.profiles for select using (id = auth.uid() or public.es_admin());
drop policy if exists p_prof_adm on public.profiles;
create policy p_prof_adm on public.profiles for all using (public.es_admin()) with check (public.es_admin());

drop policy if exists p_cli_sel on public.clientes;
create policy p_cli_sel on public.clientes for select using (auth.uid() is not null);
drop policy if exists p_cli_adm on public.clientes;
create policy p_cli_adm on public.clientes for all using (public.es_admin()) with check (public.es_admin());

drop policy if exists p_prod_sel on public.productos;
create policy p_prod_sel on public.productos for select using (auth.uid() is not null);
drop policy if exists p_prod_adm on public.productos;
create policy p_prod_adm on public.productos for all using (public.es_admin()) with check (public.es_admin());

drop policy if exists p_rut_sel on public.rutas;
create policy p_rut_sel on public.rutas for select using (vendedor_id = auth.uid() or public.es_admin());
drop policy if exists p_rut_upd on public.rutas;
create policy p_rut_upd on public.rutas for update using (vendedor_id = auth.uid()) with check (vendedor_id = auth.uid());
drop policy if exists p_rut_adm on public.rutas;
create policy p_rut_adm on public.rutas for all using (public.es_admin()) with check (public.es_admin());

drop policy if exists p_par_sel on public.ruta_paradas;
create policy p_par_sel on public.ruta_paradas for select using (public.es_admin() or exists (select 1 from public.rutas r where r.id = ruta_id and r.vendedor_id = auth.uid()));
drop policy if exists p_par_upd on public.ruta_paradas;
create policy p_par_upd on public.ruta_paradas for update using (exists (select 1 from public.rutas r where r.id = ruta_id and r.vendedor_id = auth.uid()));
drop policy if exists p_par_adm on public.ruta_paradas;
create policy p_par_adm on public.ruta_paradas for all using (public.es_admin()) with check (public.es_admin());

drop policy if exists p_ped_sel on public.pedidos;
create policy p_ped_sel on public.pedidos for select using (vendedor_id = auth.uid() or public.es_admin());
drop policy if exists p_ped_ins on public.pedidos;
create policy p_ped_ins on public.pedidos for insert with check (vendedor_id = auth.uid() and exists (select 1 from public.ruta_paradas p join public.rutas r on r.id = p.ruta_id where p.id = parada_id and r.vendedor_id = auth.uid()));
drop policy if exists p_ped_adm on public.pedidos;
create policy p_ped_adm on public.pedidos for all using (public.es_admin()) with check (public.es_admin());

-- Tiempo real para el panel del dueño
do $$ begin
  begin alter publication supabase_realtime add table public.rutas;        exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.ruta_paradas; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.pedidos;      exception when duplicate_object then null; end;
end $$;

-- Productos iniciales (edita los precios en el panel)
insert into public.productos (nombre, precio)
select * from (values ('Mix Premium 150 g',3.50),('Piña deshidratada 80 g',2.80),('Fresa deshidratada 80 g',2.80),('Arándano 80 g',3.20)) v(n,p)
where not exists (select 1 from public.productos);

-- DESPUÉS de crear tu usuario dueño en Authentication → Users, conviértelo en admin:
-- update public.profiles set rol = 'admin', nombre = 'Dueño Nutribites' where id = (select id from auth.users where email = 'TU_CORREO');
