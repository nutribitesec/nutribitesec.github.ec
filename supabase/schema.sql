-- Nutribites · esquema de base de datos para Supabase.
-- Vive en su propio schema "nutribites" para convivir con otros proyectos en el mismo Supabase.
-- Pégalo completo en Supabase → SQL Editor → Run. Es seguro volver a ejecutarlo.

create schema if not exists nutribites;

create table if not exists nutribites.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null default '',
  rol text not null default 'vendedor' check (rol in ('admin','vendedor')),
  color text not null default '#FF8C42',
  telefono text
);

create table if not exists nutribites.clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null default 'Tienda',
  direccion text,
  telefono text,
  lat double precision not null,
  lng double precision not null,
  creado_at timestamptz not null default now()
);

create table if not exists nutribites.productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  precio numeric(10,2) not null check (precio >= 0),
  activo boolean not null default true
);

create table if not exists nutribites.rutas (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references nutribites.profiles(id) on delete cascade,
  fecha date not null,
  ultima_lat double precision,
  ultima_lng double precision,
  ultima_at timestamptz,
  unique (vendedor_id, fecha)
);

create table if not exists nutribites.ruta_paradas (
  id uuid primary key default gen_random_uuid(),
  ruta_id uuid not null references nutribites.rutas(id) on delete cascade,
  cliente_id uuid not null references nutribites.clientes(id),
  orden int not null,
  estado text not null default 'pendiente' check (estado in ('pendiente','visitado','no_compra')),
  llegada_at timestamptz,
  llegada_lat double precision,
  llegada_lng double precision,
  distancia_m int,
  motivo text,
  nota text
);

create table if not exists nutribites.pedidos (
  id uuid primary key default gen_random_uuid(),
  parada_id uuid not null references nutribites.ruta_paradas(id) on delete cascade,
  vendedor_id uuid not null references nutribites.profiles(id),
  cliente_id uuid not null references nutribites.clientes(id),
  fecha date not null,
  items jsonb not null,
  total numeric(10,2) not null check (total >= 0),
  creado_at timestamptz not null default now()
);
create index if not exists pedidos_fecha on nutribites.pedidos(fecha);
create index if not exists rutas_fecha on nutribites.rutas(fecha);

-- Funciones de permiso. Otros proyectos pueden compartir el login (auth.users),
-- pero solo quien tenga un perfil en nutribites.profiles entra a estos paneles.
create or replace function nutribites.es_admin() returns boolean
language sql stable security definer set search_path = nutribites as
$$ select exists (select 1 from nutribites.profiles where id = auth.uid() and rol = 'admin') $$;

create or replace function nutribites.es_miembro() returns boolean
language sql stable security definer set search_path = nutribites as
$$ select exists (select 1 from nutribites.profiles where id = auth.uid()) $$;

-- Crea el perfil de un usuario ya registrado en Authentication (se ejecuta desde el SQL Editor).
create or replace function nutribites.crear_perfil(p_email text, p_nombre text, p_rol text default 'vendedor', p_telefono text default null, p_color text default '#FF8C42')
returns void language plpgsql security definer set search_path = nutribites as
$$ begin
  insert into nutribites.profiles (id, nombre, rol, telefono, color)
  select id, p_nombre, p_rol, p_telefono, p_color from auth.users where email = p_email
  on conflict (id) do update set nombre = excluded.nombre, rol = excluded.rol, telefono = excluded.telefono, color = excluded.color;
  if not found then raise exception 'No existe el usuario % en Authentication', p_email; end if;
end $$;
revoke all on function nutribites.crear_perfil(text,text,text,text,text) from public, anon, authenticated;

-- Seguridad por filas (RLS): el vendedor solo toca lo suyo; el admin todo.
alter table nutribites.profiles     enable row level security;
alter table nutribites.clientes     enable row level security;
alter table nutribites.productos    enable row level security;
alter table nutribites.rutas        enable row level security;
alter table nutribites.ruta_paradas enable row level security;
alter table nutribites.pedidos      enable row level security;

drop policy if exists p_prof_sel on nutribites.profiles;
create policy p_prof_sel on nutribites.profiles for select using (id = auth.uid() or nutribites.es_admin());
drop policy if exists p_prof_adm on nutribites.profiles;
create policy p_prof_adm on nutribites.profiles for all using (nutribites.es_admin()) with check (nutribites.es_admin());

drop policy if exists p_cli_sel on nutribites.clientes;
create policy p_cli_sel on nutribites.clientes for select using (nutribites.es_miembro());
drop policy if exists p_cli_adm on nutribites.clientes;
create policy p_cli_adm on nutribites.clientes for all using (nutribites.es_admin()) with check (nutribites.es_admin());

drop policy if exists p_prod_sel on nutribites.productos;
create policy p_prod_sel on nutribites.productos for select using (nutribites.es_miembro());
drop policy if exists p_prod_adm on nutribites.productos;
create policy p_prod_adm on nutribites.productos for all using (nutribites.es_admin()) with check (nutribites.es_admin());

drop policy if exists p_rut_sel on nutribites.rutas;
create policy p_rut_sel on nutribites.rutas for select using (vendedor_id = auth.uid() or nutribites.es_admin());
drop policy if exists p_rut_upd on nutribites.rutas;
create policy p_rut_upd on nutribites.rutas for update using (vendedor_id = auth.uid()) with check (vendedor_id = auth.uid());
drop policy if exists p_rut_adm on nutribites.rutas;
create policy p_rut_adm on nutribites.rutas for all using (nutribites.es_admin()) with check (nutribites.es_admin());

drop policy if exists p_par_sel on nutribites.ruta_paradas;
create policy p_par_sel on nutribites.ruta_paradas for select using (nutribites.es_admin() or exists (select 1 from nutribites.rutas r where r.id = ruta_id and r.vendedor_id = auth.uid()));
drop policy if exists p_par_upd on nutribites.ruta_paradas;
create policy p_par_upd on nutribites.ruta_paradas for update using (exists (select 1 from nutribites.rutas r where r.id = ruta_id and r.vendedor_id = auth.uid()));
drop policy if exists p_par_adm on nutribites.ruta_paradas;
create policy p_par_adm on nutribites.ruta_paradas for all using (nutribites.es_admin()) with check (nutribites.es_admin());

drop policy if exists p_ped_sel on nutribites.pedidos;
create policy p_ped_sel on nutribites.pedidos for select using (vendedor_id = auth.uid() or nutribites.es_admin());
drop policy if exists p_ped_ins on nutribites.pedidos;
create policy p_ped_ins on nutribites.pedidos for insert with check (vendedor_id = auth.uid() and exists (select 1 from nutribites.ruta_paradas p join nutribites.rutas r on r.id = p.ruta_id where p.id = parada_id and r.vendedor_id = auth.uid()));
drop policy if exists p_ped_adm on nutribites.pedidos;
create policy p_ped_adm on nutribites.pedidos for all using (nutribites.es_admin()) with check (nutribites.es_admin());

-- Permisos del API. No se da acceso a "anon": hay que iniciar sesión.
grant usage on schema nutribites to authenticated, service_role;
grant select, insert, update, delete on all tables in schema nutribites to authenticated;
grant all on all tables in schema nutribites to service_role;
grant execute on function nutribites.es_admin(), nutribites.es_miembro() to authenticated;

-- Tiempo real para el panel del dueño
do $$ begin
  begin alter publication supabase_realtime add table nutribites.rutas;        exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table nutribites.ruta_paradas; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table nutribites.pedidos;      exception when duplicate_object then null; end;
end $$;

-- Productos iniciales (edita los precios en el panel)
insert into nutribites.productos (nombre, precio)
select * from (values ('Mix Premium 150 g',3.50),('Piña deshidratada 80 g',2.80),('Fresa deshidratada 80 g',2.80),('Arándano 80 g',3.20)) v(n,p)
where not exists (select 1 from nutribites.productos);

-- ─────────────────────────────────────────────────────────────
-- PASOS MANUALES (después de ejecutar lo de arriba):
-- 1) Settings → API → "Exposed schemas": agrega  nutribites  y guarda.
-- 2) Authentication → Users → Add user (marca Auto Confirm) para el dueño y cada vendedor.
-- 3) Crea sus perfiles (ajusta correos, nombres y teléfonos):
--    select nutribites.crear_perfil('dueno@correo.com',  'Dueño Nutribites', 'admin');
--    select nutribites.crear_perfil('carlos@correo.com', 'Carlos Mena',      'vendedor', '0991112233', '#FF8C42');
--    select nutribites.crear_perfil('andrea@correo.com', 'Andrea Salazar',   'vendedor', '0992223344', '#4DA3FF');
-- ─────────────────────────────────────────────────────────────
