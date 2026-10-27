# Paneles de Nutribites (dueño y vendedor)

| Panel | Dirección | Para quién |
|---|---|---|
| Dueño / administración | `/admin/` | Ver en vivo ruta, visitas, ventas y equipo; asignar rutas de hasta 20 puntos; gestionar clientes y productos |
| Vendedor | `/vendedor/` | Celular: ver su ruta del día en el mapa, marcar llegada con GPS, tomar pedido o registrar por qué no compró |

Todo es HTML/JS estático (funciona en GitHub Pages). Mapa: OpenStreetMap + Leaflet.

## Modo demo (el que viene por defecto)
Con `assets/config.js` vacío, los paneles funcionan con datos de ejemplo guardados en el navegador. Sirve para ver y aprobar el diseño. **No comparte datos entre dispositivos.**

## Pasar a producción con Supabase (gratis para empezar)
1. Crea un proyecto en https://supabase.com.
2. **SQL Editor** → pega todo `supabase/schema.sql` → Run.
3. **Authentication → Users → Add user**: crea tu usuario (dueño) y uno por vendedor (correo + contraseña). Opcional: en *User metadata* agrega `{"nombre":"Carlos Mena"}`.
4. En el SQL Editor vuelve a correr la última línea comentada de `schema.sql` (la de `update public.profiles set rol = 'admin'…`) con tu correo, para que tu usuario sea administrador. Los demás quedan como vendedores.
5. **Project Settings → API**: copia *Project URL* y la clave *anon public* en `assets/config.js`.
6. Sube los cambios a `main`. Entra a `/admin/`, carga tus clientes reales (o pídeme una importación desde Excel/CSV) y asigna las rutas.

La clave `anon` es pública por diseño; la seguridad la dan las reglas RLS del esquema (cada vendedor solo ve y modifica lo suyo).

## Uso diario
1. El dueño abre **Asignar rutas**, elige vendedor, mueve el mapa a la zona y pulsa *Sugerir cercanos* (o toca puntos a mano), *Optimizar orden* y *Asignar ruta*.
2. El vendedor abre `/vendedor/` en su celular (puede añadirlo a la pantalla de inicio) y sigue la ruta parada por parada.
3. El dueño ve en **Resumen en vivo** cada llegada, pedido y no-compra al instante, y la posición del vendedor.
