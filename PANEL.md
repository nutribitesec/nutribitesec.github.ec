# Paneles de Nutribites (dueño y vendedor)

| Panel | Dirección | Para quién |
|---|---|---|
| Dueño / administración | `/admin/` | Ver en vivo ruta, visitas, ventas y equipo; asignar rutas de hasta 20 puntos; gestionar clientes y productos |
| Vendedor | `/vendedor/` | Celular: ver su ruta del día en el mapa, marcar llegada con GPS, tomar pedido o registrar por qué no compró |

Todo es HTML/JS estático (funciona en GitHub Pages). Mapa: OpenStreetMap + Leaflet.

## Modo demo (el que viene por defecto)
Con `assets/config.js` vacío, los paneles funcionan con datos de ejemplo guardados en el navegador. Sirve para ver y aprobar el diseño. **No comparte datos entre dispositivos.**

## Pasar a producción con Supabase
Las tablas viven en un schema propio (`nutribites`), así que el mismo proyecto de Supabase puede alojar otros proyectos sin mezclarse.
1. Crea o elige tu proyecto en https://supabase.com.
2. **SQL Editor** → pega todo `supabase/schema.sql` → Run.
3. **Settings → API → Exposed schemas**: agrega `nutribites` y guarda.
4. **Authentication → Users → Add user** (marca *Auto Confirm*): uno para el dueño y uno por vendedor.
5. En el SQL Editor crea sus perfiles con `select nutribites.crear_perfil('correo','Nombre','admin'|'vendedor','telefono');` (ejemplos al final de `schema.sql`).
6. **Settings → API**: copia *Project URL* y la clave *anon public* en `assets/config.js`.
7. Sube los cambios a `main`.

Notas con varios proyectos en el mismo Supabase:
- El login (`auth.users`) es compartido, pero solo entra a Nutribites quien tenga perfil en `nutribites.profiles`; las reglas RLS lo exigen.
- El plan gratuito pausa el proyecto tras una semana sin actividad. Para un sistema de uso diario conviene el plan Pro.

## Uso diario
1. El dueño abre **Asignar rutas**, elige vendedor, mueve el mapa a la zona y pulsa *Sugerir cercanos* (o toca puntos a mano), *Optimizar orden* y *Asignar ruta*.
2. El vendedor abre `/vendedor/` en su celular (puede añadirlo a la pantalla de inicio) y sigue la ruta parada por parada.
3. El dueño ve en **Resumen en vivo** cada llegada, pedido y no-compra al instante, y la posición del vendedor.
