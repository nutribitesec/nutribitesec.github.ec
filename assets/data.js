// Capa de datos. Mismo API en dos modos:
//  - DEMO  (config.js vacío): datos de ejemplo guardados en el navegador (localStorage).
//  - NUBE  (Supabase): usuarios, base de datos y tiempo real compartidos entre dueño y vendedores.
(function () {
  const CFG = window.NB_CONFIG, NB = window.NB;
  const DEMO = !(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);
  const listeners = new Set();
  const emit = () => listeners.forEach(f => { try { f(); } catch (e) { console.error(e); } });
  let scope = 'admin', sb = null;

  /* ───────────────────────── DEMO ───────────────────────── */
  const KEY = 'nb_demo_v2';
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  function seed() {
    let s = 20240611; const rnd = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const tipos = ['Gimnasio', 'Minimarket', 'Cafetería', 'Farmacia', 'Universidad', 'Tienda'];
    const nombres = ['Titán', 'Central', 'El Sol', 'Andes', 'Vida Sana', 'La Esquina', 'Fit Zone', 'Los Pinos', 'Mirador', 'Don Pepe', 'Bienestar', 'Campus Norte', 'Casa Verde', 'Express', 'Familiar', 'Pungal', 'Cevallos', 'Ficoa', 'Atocha', 'Huachi', 'Olímpico', 'Real', 'Centro', 'Sierra', 'Alpha', 'Kiwi', 'Delta', 'Natura', 'Bambú', 'Tungurahua', 'Celeste', 'Roble', 'Pacífica', 'Cumbre', 'Oasis', 'Moderna', 'Imperial', 'Neo', 'Prisma', 'Aurora'];
    const [c0, c1] = CFG.CENTRO;
    const clientes = nombres.map((n, i) => {
      const t = tipos[Math.floor(rnd() * tipos.length)];
      return { id: 'c' + (i + 1), nombre: `${t} ${n}`, tipo: t, direccion: `Ambato · sector ${n}`, telefono: '09' + String(Math.floor(rnd() * 1e8)).padStart(8, '0'), lat: +(c0 + (rnd() - .5) * .07).toFixed(6), lng: +(c1 + (rnd() - .5) * .09).toFixed(6) };
    });
    const vendedores = [
      { id: 'v1', nombre: 'Carlos Mena', color: NB.COLORES[0], rol: 'vendedor' },
      { id: 'v2', nombre: 'Andrea Salazar', color: NB.COLORES[1], rol: 'vendedor' }
    ];
    const productos = [
      { id: 'p1', nombre: 'Mix Premium 150 g', precio: 3.50, activo: true },
      { id: 'p2', nombre: 'Piña deshidratada 80 g', precio: 2.80, activo: true },
      { id: 'p3', nombre: 'Fresa deshidratada 80 g', precio: 2.80, activo: true },
      { id: 'p4', nombre: 'Arándano 80 g', precio: 3.20, activo: true }
    ];
    const orden = [...clientes].sort((a, b) => a.lng - b.lng);
    const fecha = NB.hoy(), rutas = [], paradas = [], pedidos = [];
    [[vendedores[0], orden.slice(0, 20), 9], [vendedores[1], orden.slice(20), 5]].forEach(([v, cs, hechas]) => {
      const rid = 'r_' + v.id, ord = NB.optimizar(cs, CFG.CENTRO);
      rutas.push({ id: rid, vendedor_id: v.id, fecha, ultima_lat: null, ultima_lng: null, ultima_at: null });
      ord.forEach((c, i) => {
        const p = { id: `${rid}_${i}`, ruta_id: rid, cliente_id: c.id, orden: i + 1, estado: 'pendiente', llegada_at: null, llegada_lat: null, llegada_lng: null, distancia_m: null, motivo: null, nota: null };
        if (i < hechas) {
          const t = new Date(); t.setHours(8, 10 + i * 24, 0, 0); if (t > new Date()) t.setTime(Date.now() - (hechas - i) * 600000);
          const compra = rnd() > .3;
          Object.assign(p, { estado: compra ? 'visitado' : 'no_compra', llegada_at: t.toISOString(), llegada_lat: c.lat + (rnd() - .5) * .0004, llegada_lng: c.lng + (rnd() - .5) * .0004 });
          p.distancia_m = Math.round(NB.dist([p.llegada_lat, p.llegada_lng], [c.lat, c.lng]));
          if (compra) {
            const items = productos.filter(() => rnd() > .45).map(x => ({ producto_id: x.id, nombre: x.nombre, precio: x.precio, cant: 1 + Math.floor(rnd() * 8) }));
            if (!items.length) items.push({ producto_id: 'p1', nombre: productos[0].nombre, precio: 3.5, cant: 6 });
            pedidos.push({ id: uid(), parada_id: p.id, vendedor_id: v.id, cliente_id: c.id, fecha, items, total: +items.reduce((a, b) => a + b.precio * b.cant, 0).toFixed(2), creado_at: new Date(+t + 300000).toISOString() });
          } else p.motivo = NB.MOTIVOS[Math.floor(rnd() * 5)];
        }
        paradas.push(p);
      });
      const u = ord[Math.max(0, hechas - 1)];
      Object.assign(rutas[rutas.length - 1], { ultima_lat: u.lat, ultima_lng: u.lng, ultima_at: new Date().toISOString() });
    });
    return { vendedores, clientes, productos, rutas, paradas, pedidos };
  }
  const load = () => { try { const j = JSON.parse(localStorage.getItem(KEY)); if (j && j.clientes) return j; } catch (e) { } const d = seed(); save(d, true); return d; };
  const save = (d, quiet) => { localStorage.setItem(KEY, JSON.stringify(d)); if (!quiet) emit(); };
  window.addEventListener('storage', e => { if (e.key === KEY) emit(); });

  const demo = {
    async session() {
      const id = sessionStorage.getItem('nb_sess_' + scope); if (!id) return null;
      if (id === 'admin') return { id: 'admin', nombre: 'Dueño Nutribites', rol: 'admin', color: '#FF8C42' };
      return load().vendedores.find(v => v.id === id) || null;
    },
    async usuariosDemo() { return [{ id: 'admin', nombre: 'Dueño Nutribites', rol: 'admin', color: '#FF8C42' }, ...load().vendedores]; },
    async loginDemo(id) { sessionStorage.setItem('nb_sess_' + scope, id); },
    async logout() { sessionStorage.removeItem('nb_sess_' + scope); },
    async dia(fecha) {
      const d = load();
      const rutas = d.rutas.filter(r => r.fecha === fecha).map(r => ({ ...r, paradas: d.paradas.filter(p => p.ruta_id === r.id).sort((a, b) => a.orden - b.orden) }));
      return { vendedores: d.vendedores, clientes: d.clientes, productos: d.productos, rutas, pedidos: d.pedidos.filter(p => p.fecha === fecha) };
    },
    async crearRuta({ vendedor_id, fecha, clienteIds }) {
      const d = load(), ant = d.rutas.find(r => r.vendedor_id === vendedor_id && r.fecha === fecha);
      if (ant) { d.paradas = d.paradas.filter(p => p.ruta_id !== ant.id); d.pedidos = d.pedidos.filter(p => !p.parada_id.startsWith(ant.id)); d.rutas = d.rutas.filter(r => r !== ant); }
      const id = 'r_' + uid(); d.rutas.push({ id, vendedor_id, fecha, ultima_lat: null, ultima_lng: null, ultima_at: null });
      clienteIds.forEach((c, i) => d.paradas.push({ id: `${id}_${i}`, ruta_id: id, cliente_id: c, orden: i + 1, estado: 'pendiente', llegada_at: null, llegada_lat: null, llegada_lng: null, distancia_m: null, motivo: null, nota: null }));
      save(d);
    },
    async actualizarParada(id, patch) { const d = load(); Object.assign(d.paradas.find(p => p.id === id), patch); save(d); },
    async crearPedido(p) { const d = load(); d.pedidos.push({ id: uid(), creado_at: new Date().toISOString(), ...p }); save(d); },
    async posicion(ruta_id, lat, lng) { const d = load(); Object.assign(d.rutas.find(r => r.id === ruta_id), { ultima_lat: lat, ultima_lng: lng, ultima_at: new Date().toISOString() }); save(d); },
    async guardarCliente(c) { const d = load(); if (c.id) Object.assign(d.clientes.find(x => x.id === c.id), c); else d.clientes.push({ ...c, id: 'c' + uid() }); save(d); },
    async guardarProducto(p) { const d = load(); if (p.id) Object.assign(d.productos.find(x => x.id === p.id), p); else d.productos.push({ activo: true, ...p, id: 'p' + uid() }); save(d); },
    async reiniciar() { localStorage.removeItem(KEY); load(); emit(); }
  };

  /* ───────────────────────── SUPABASE ───────────────────────── */
  const q = async p => { const { data, error } = await p; if (error) throw error; return data; };
  const cloud = {
    async session() {
      const { data } = await sb.auth.getSession(); if (!data.session) return null;
      return q(sb.from('profiles').select('*').eq('id', data.session.user.id).single());
    },
    async login(email, pass) { const { error } = await sb.auth.signInWithPassword({ email, password: pass }); if (error) throw error; },
    async logout() { await sb.auth.signOut(); },
    async dia(fecha) {
      const [vendedores, clientes, productos, rutas, pedidos] = await Promise.all([
        q(sb.from('profiles').select('*').eq('rol', 'vendedor').order('nombre')),
        q(sb.from('clientes').select('*').order('nombre')),
        q(sb.from('productos').select('*').order('nombre')),
        q(sb.from('rutas').select('*, paradas:ruta_paradas(*)').eq('fecha', fecha)),
        q(sb.from('pedidos').select('*').eq('fecha', fecha))
      ]);
      rutas.forEach(r => r.paradas.sort((a, b) => a.orden - b.orden));
      return { vendedores, clientes, productos, rutas, pedidos };
    },
    async crearRuta({ vendedor_id, fecha, clienteIds }) {
      await q(sb.from('rutas').delete().eq('vendedor_id', vendedor_id).eq('fecha', fecha));
      const r = await q(sb.from('rutas').insert({ vendedor_id, fecha }).select().single());
      await q(sb.from('ruta_paradas').insert(clienteIds.map((c, i) => ({ ruta_id: r.id, cliente_id: c, orden: i + 1 }))));
    },
    async actualizarParada(id, patch) { await q(sb.from('ruta_paradas').update(patch).eq('id', id)); },
    async crearPedido(p) { await q(sb.from('pedidos').insert(p)); },
    async posicion(ruta_id, lat, lng) { await q(sb.from('rutas').update({ ultima_lat: lat, ultima_lng: lng, ultima_at: new Date().toISOString() }).eq('id', ruta_id)); },
    async guardarCliente(c) { const { id, ...r } = c; await q(id ? sb.from('clientes').update(r).eq('id', id) : sb.from('clientes').insert(r)); },
    async guardarProducto(p) { const { id, ...r } = p; await q(id ? sb.from('productos').update(r).eq('id', id) : sb.from('productos').insert(r)); }
  };

  function loadScript(src) { return new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); }

  NB.data = {
    demo: DEMO,
    async init(sc) {
      scope = sc;
      if (!DEMO) {
        await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js');
        sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
        sb.channel('nb-live').on('postgres_changes', { event: '*', schema: 'public' }, emit).subscribe();
      }
    },
    suscribir(f) { listeners.add(f); return () => listeners.delete(f); }
  };
  ['session', 'login', 'loginDemo', 'usuariosDemo', 'logout', 'dia', 'crearRuta', 'actualizarParada', 'crearPedido', 'posicion', 'guardarCliente', 'guardarProducto', 'reiniciar']
    .forEach(k => { NB.data[k] = (...a) => { const impl = DEMO ? demo : cloud; return impl[k] ? impl[k](...a) : Promise.resolve(); }; });
})();
