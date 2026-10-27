(async function () {
  const root = document.getElementById('root'), CFG = NB.CFG = window.NB_CONFIG, esc = NB.esc, MAX = 20;
  const user = await NB.requireLogin('admin', root, 'Panel del dueño');
  let fecha = NB.hoy(), D = null, view = 'resumen', map = null, layer = null, fitted = false, focoV = null;
  let sel = [], selV = null;   // constructor de rutas

  const sv = d => `<svg class="i" viewBox="0 0 24 24">${d}</svg>`;
  const I = {
    grid: sv('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
    route: sv('<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5"/>'),
    dollar: sv('<path d="M12 3v18M16.5 7.5c-.8-1.3-2.4-2-4.5-2-2.6 0-4 1.2-4 2.9 0 4.2 9 2 9 6.2 0 1.7-1.6 3-4.5 3-2.3 0-4-.8-4.8-2.2"/>'),
    store: sv('<path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9c0 1.7 1.3 3 2.7 3S9.3 10.7 9.3 9c0 1.7 1.3 3 2.7 3s2.7-1.3 2.7-3c0 1.7 1.3 3 2.7 3S20 10.7 20 9M9.5 20v-5h5v5"/>'),
    box: sv('<path d="M3 7.5L12 3l9 4.5v9L12 21l-9-4.5zM3 7.5l9 4.5 9-4.5M12 12v9"/>'),
    search: sv('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
    bell: sv('<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0"/>'),
    out: sv('<path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M16 8l4 4-4 4M20 12H9"/>'),
    filt: sv('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'),
    plus: sv('<path d="M12 5v14M5 12h14"/>'), minus: sv('<path d="M5 12h14"/>'),
    loc: sv('<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
    chev: sv('<path d="M6 15l6-6 6 6"/>'), arrow: sv('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    pin: sv('<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>'),
    phone: sv('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>'),
    check: sv('<path d="M5 12l5 5 9-10"/>'), warn: sv('<path d="M12 4l9 16H3zM12 10v4M12 17h0"/>'), chart: sv('<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>')
  };
  const NAV = [['resumen', 'Panel', 'grid'], ['rutas', 'Asignar rutas', 'route'], ['ventas', 'Ventas', 'dollar'], ['clientes', 'Clientes', 'store'], ['productos', 'Productos', 'box']];
  root.innerHTML = `<div id="app">
    <nav>
      <div class="usr"><span class="avatar" style="--c:${user.color || '#FF8C42'}">${NB.iniciales(user.nombre)}</span><div><b>${esc(user.nombre)}</b><small>Administrador</small></div><button class="bell" id="bell" title="Alertas">${I.bell}<i id="bellN"></i></button></div>
      <div class="srch">${I.search}<input id="q" placeholder="Buscar cliente…" autocomplete="off"><div class="qr" id="qr"></div></div>
      <div class="inbox"><h2>Alertas <span class="chip or" id="alN">0</span></h2><small id="alS">Todo en orden</small></div>
      ${NAV.map(n => `<a class="t" data-v="${n[0]}">${I[n[2]]}${n[1]}</a>`).join('')}
      <div class="sp"></div>
      ${NB.data.demo ? `<a class="t" id="rst">${I.route}Reiniciar demo</a>` : ''}
      <a class="t" id="out">${I.out}Cerrar sesión</a>
    </nav><main id="main"></main></div>`;
  const main = document.getElementById('main');
  root.querySelectorAll('nav a.t[data-v]').forEach(a => a.onclick = () => show(a.dataset.v));
  document.getElementById('out').onclick = async () => { await NB.data.logout(); location.reload(); };
  const rst = document.getElementById('rst'); if (rst) rst.onclick = async () => { if (confirm('¿Volver a los datos de ejemplo?')) { await NB.data.reiniciar(); await reload(); show(view); } };

  const cli = id => D.clientes.find(c => c.id === id), vend = id => D.vendedores.find(v => v.id === id) || { nombre: '—', color: '#888' };
  const ped = pid => D.pedidos.find(p => p.parada_id === pid);
  const paradasDe = r => r.paradas || [];
  async function reload() { D = await NB.data.dia(fecha); if (typeof pintarAlertas === 'function' && document.getElementById('alN')) pintarAlertas(); }
  function destroyMap() { if (map) { map.remove(); map = null; layer = null; fitted = false; } }

  function head(titulo, sub, extra = '') {
    return `<header class="top"><div><h1>${titulo}</h1><p>${sub}</p></div>
      <div class="tools">${extra}<span class="live"><i></i>En vivo</span><input class="in" type="date" id="fecha" value="${fecha}" style="width:auto"></div></header>`;
  }
  function bindFecha() { document.getElementById('fecha').onchange = async e => { fecha = e.target.value || NB.hoy(); sel = []; selV = null; await reload(); show(view); }; }

  async function show(v) {
    view = v; destroyMap(); main.classList.toggle('fill', v === 'resumen');
    root.querySelectorAll('nav a.t[data-v]').forEach(a => a.classList.toggle('on', a.dataset.v === v));
    if (!D) await reload();
    ({ resumen, rutas, ventas, clientes, productos }[v])();
  }

  /* ───────── ALERTAS ───────── */
  function alertas() {
    const out = [], hoy = fecha === NB.hoy();
    D.rutas.forEach(r => {
      const v = vend(r.vendedor_id), ps = paradasDe(r);
      ps.forEach(p => { if (p.distancia_m > CFG.RADIO_LLEGADA_M) out.push({ v: r.vendedor_id, c: p.cliente_id, tx: `${v.nombre} marcó llegada a ${NB.km(p.distancia_m)} de ${(cli(p.cliente_id) || {}).nombre}`, tipo: 'Fuera de rango' }); });
      if (hoy && r.ultima_at && ps.some(p => p.estado === 'pendiente')) { const min = (Date.now() - new Date(r.ultima_at)) / 60000; if (min > 30) out.push({ v: r.vendedor_id, tx: `${v.nombre} sin señal hace ${Math.round(min)} min`, tipo: 'Sin señal' }); }
    });
    if (hoy) D.vendedores.filter(v => !D.rutas.some(r => r.vendedor_id === v.id)).forEach(v => out.push({ v: v.id, tx: `${v.nombre} no tiene ruta asignada hoy`, tipo: 'Sin ruta' }));
    return out;
  }
  function pintarAlertas() {
    const a = alertas(); document.getElementById('alN').textContent = a.length;
    document.getElementById('bellN').textContent = a.length || '';
    document.getElementById('alS').textContent = a.length ? `${a.length} requieren atención` : 'Todo en orden';
  }
  function verAlertas() {
    const a = alertas();
    NB.modal(`<h2>Alertas</h2><p style="color:var(--mu);margin-bottom:10px">Lo que necesita tu atención hoy.</p>${a.length ? a.map((x, i) => `<div class="ev" style="cursor:pointer" data-a="${i}"><span class="chip or">${x.tipo}</span><div style="flex:1">${esc(x.tx)}</div></div>`).join('') : '<div class="empty">Sin alertas. Todo en orden ✓</div>'}`, (el, close) => {
      el.querySelectorAll('[data-a]').forEach(e => e.onclick = async () => { const x = a[+e.dataset.a]; close(); await show('resumen'); if (D.rutas.some(r => r.vendedor_id === x.v)) setFoco(x.v); });
    });
  }
  const bell = () => document.getElementById('bell').onclick = verAlertas;
  bell(); document.querySelector('.inbox').style.cursor = 'pointer'; document.querySelector('.inbox').onclick = verAlertas;

  // Buscador de clientes
  const qi = document.getElementById('q'), qr = document.getElementById('qr');
  qi.oninput = () => {
    const t = qi.value.trim().toLowerCase(); if (!D || !t) { qr.style.display = 'none'; return; }
    const m = D.clientes.filter(c => (c.nombre + ' ' + (c.direccion || '')).toLowerCase().includes(t)).slice(0, 6);
    qr.innerHTML = m.map(c => `<button data-c="${c.id}"><b>${esc(c.nombre)}</b><br><small>${esc(c.direccion || '')}</small></button>`).join('') || '<button disabled><small>Sin resultados</small></button>';
    qr.style.display = 'block';
    qr.querySelectorAll('[data-c]').forEach(b => b.onclick = async () => { qr.style.display = 'none'; qi.value = ''; await show('resumen'); const c = cli(b.dataset.c); map.flyTo([c.lat, c.lng], 17, { duration: .8 }); setTimeout(() => marcadores[c.id] && marcadores[c.id].openPopup(), 900); });
  };
  document.addEventListener('click', e => { if (!e.target.closest('.srch')) qr.style.display = 'none'; });

  /* ───────── PANEL (RESUMEN) ───────── */
  const marcadores = {}, ocultos = new Set(), colapsados = new Set();
  function stats() {
    const par = D.rutas.flatMap(paradasDe), hechas = par.filter(p => p.estado !== 'pendiente');
    const compras = par.filter(p => p.estado === 'visitado').length, ventas = D.pedidos.reduce((s, p) => s + p.total, 0);
    return { total: par.length, hechas: hechas.length, compras, ventas, pedidos: D.pedidos.length, efect: hechas.length ? Math.round(compras / hechas.length * 100) : 0, ticket: D.pedidos.length ? ventas / D.pedidos.length : 0 };
  }
  const tel = t => { t = String(t || '').replace(/\D/g, ''); return t ? (t.startsWith('0') ? '593' + t.slice(1) : t) : ''; };
  function contactar(id) { const v = vend(id), n = tel(v.telefono); if (!n) return NB.toast('Este vendedor no tiene teléfono registrado', 'bad'); window.open('https://wa.me/' + n, '_blank', 'noopener'); }
  function setFoco(id) {
    focoV = id; pintarResumen();
    const r = D.rutas.find(x => x.vendedor_id === id);
    const pts = (r ? paradasDe(r) : D.rutas.flatMap(paradasDe)).map(p => cli(p.cliente_id)).filter(Boolean).map(c => [c.lat, c.lng]);
    if (pts.length) map.fitBounds(pts, { padding: [60, 60] });
  }

  function resumen() {
    const hoy = fecha === NB.hoy();
    main.innerHTML = `<div class="dash">
      <section class="mapp"><div id="map"></div>
        <div class="ov tl"><div class="tt"><h1>Mapa</h1><p id="msub">${hoy ? 'Ambato · ubicación en tiempo real' : 'Resultado del ' + fecha}</p></div>
          <div class="lg"><span><i class="dot" style="--c:var(--gr)"></i>Visitado con pedido</span><span><i class="dot" style="--c:var(--rd)"></i>No compró</span><span><i class="dot" style="--c:var(--or)"></i>Pendiente / siguiente</span><span><i class="dot" style="--c:#555"></i>Sin asignar hoy</span></div></div>
        <div class="ov tr"><input class="in" type="date" id="fecha" value="${fecha}"><button class="rb" id="flt" title="Filtrar vendedores">${I.filt}</button><div class="menu" id="fm" hidden></div></div>
        <div class="ov sc" id="sc" hidden></div>
        <div class="ov br"><button class="rb" id="zi">${I.plus}</button><button class="rb" id="zo">${I.minus}</button><button class="rb" id="lc" title="Ver todo">${I.loc}</button></div>
      </section>
      <aside class="rc"><div class="kp" id="kpis"></div><div class="vcard"><h2>Vendedores activos</h2><div id="team"></div></div><div class="evc"><h3 style="margin-bottom:6px">Actividad reciente</h3><div id="feed"></div></div></aside></div>`;
    bindFecha();
    map = NB.mapa('map', { z: 13, zoom: false }); layer = L.layerGroup().addTo(map);
    document.getElementById('zi').onclick = () => map.zoomIn(); document.getElementById('zo').onclick = () => map.zoomOut();
    document.getElementById('lc').onclick = () => { focoV = null; pintarResumen(); const p = D.rutas.flatMap(paradasDe).map(x => cli(x.cliente_id)).filter(Boolean).map(c => [c.lat, c.lng]); if (p.length) map.fitBounds(p, { padding: [60, 60] }); };
    const fm = document.getElementById('fm');
    document.getElementById('flt').onclick = () => {
      fm.hidden = !fm.hidden;
      fm.innerHTML = D.vendedores.map(v => `<label><input type="checkbox" data-f="${v.id}" ${ocultos.has(v.id) ? '' : 'checked'}><i class="dot" style="--c:${v.color}"></i>${esc(v.nombre)}</label>`).join('') || '<div class="empty">Sin vendedores</div>';
      fm.querySelectorAll('[data-f]').forEach(c => c.onchange = () => { c.checked ? ocultos.delete(c.dataset.f) : ocultos.add(c.dataset.f); pintarResumen(); });
    };
    pintarResumen();
  }

  function pintarResumen() {
    if (view !== 'resumen' || !map) return;
    pintarAlertas();
    const s = stats(), na = alertas().length;
    const K = (cls, ic, tit, v, sub, link, fn) => `<div class="k ${cls}"><div class="row"><span class="ic">${I[ic]}</span><b>${tit}</b></div><div class="v">${v}</div><div class="s">${sub}</div><a data-k="${fn}">${link} ${I.arrow}</a></div>`;
    document.getElementById('kpis').innerHTML =
      K('c1', 'pin', 'Visitas<br>de hoy', `${s.hechas}<small> / ${s.total}</small>`, s.total ? Math.round(s.hechas / s.total * 100) + '% de la ruta' : 'Sin rutas asignadas', 'Ver rutas', 'rutas') +
      K('c2', 'warn', 'Alertas<br>activas', na, na ? 'Requieren atención' : 'Todo en orden', 'Ver alertas', 'alertas') +
      K('c3', 'dollar', 'Ventas<br>del día', NB.money(s.ventas), `${s.pedidos} pedidos · ticket ${NB.money(s.ticket)}`, 'Ver ventas', 'ventas') +
      K('c4', 'chart', 'Efectividad<br>de visitas', s.efect + '<small>%</small>', `${s.compras} compras en ${s.hechas} visitas`, 'Ver reporte', 'ventas');
    document.querySelectorAll('[data-k]').forEach(a => a.onclick = () => a.dataset.k === 'alertas' ? verAlertas() : show(a.dataset.k));

    // mapa
    layer.clearLayers(); Object.keys(marcadores).forEach(k => delete marcadores[k]);
    const asig = new Set(D.rutas.flatMap(paradasDe).map(p => p.cliente_id)), all = [];
    D.clientes.filter(c => !asig.has(c.id)).forEach(c => marcadores[c.id] = L.circleMarker([c.lat, c.lng], { radius: 4, color: '#555', weight: 1, fillColor: '#444', fillOpacity: .9 }).bindPopup(`<b>${esc(c.nombre)}</b><br><span style="color:var(--mu)">Sin ruta asignada hoy</span>`).addTo(layer));
    D.rutas.forEach(r => {
      if (ocultos.has(r.vendedor_id)) return;
      const v = vend(r.vendedor_id), ps = paradasDe(r), dim = focoV && focoV !== r.vendedor_id;
      L.polyline(ps.map(p => cli(p.cliente_id)).filter(Boolean).map(c => [c.lat, c.lng]), { color: v.color, weight: 3, opacity: dim ? .12 : .7, dashArray: '6 8' }).addTo(layer);
      const next = ps.find(p => p.estado === 'pendiente');
      ps.forEach(p => {
        const c = cli(p.cliente_id); if (!c) return; all.push([c.lat, c.lng]);
        const cls = p.estado === 'visitado' ? 'done' : p.estado === 'no_compra' ? 'skip' : 'pend' + (p === next ? ' next' : ''), pd = ped(p.id);
        const pop = `<b>${esc(c.nombre)}</b><br><span style="color:var(--mu)">${esc(v.nombre)} · parada ${p.orden}</span><br>${NB.estadoTxt(p.estado)}${p.llegada_at ? ' · ' + NB.hora(p.llegada_at) : ''}${pd ? '<br><b>' + NB.money(pd.total) + '</b>' : ''}${p.motivo ? '<br>' + esc(p.motivo) : ''}`;
        marcadores[c.id] = L.marker([c.lat, c.lng], { icon: NB.pin(p.orden, cls, v.color), opacity: dim ? .25 : 1 }).bindPopup(pop).addTo(layer);
      });
      if (r.ultima_lat != null) L.marker([r.ultima_lat, r.ultima_lng], { zIndexOffset: 1000, icon: L.divIcon({ className: '', iconSize: [40, 40], iconAnchor: [20, 20], html: `<div class="gl" style="--c:${v.color}">${NB.iniciales(v.nombre)}</div>` }) })
        .on('click', () => setFoco(r.vendedor_id)).addTo(layer);
    });
    if (all.length && !fitted) { map.fitBounds(all, { padding: [70, 70] }); fitted = true; }
    if (!all.length && !fitted) map.setView(CFG.CENTRO, 13);

    // tarjeta flotante del vendedor seleccionado
    const sc = document.getElementById('sc'), fr = focoV && D.rutas.find(x => x.vendedor_id === focoV);
    if (fr) {
      const v = vend(focoV), ps = paradasDe(fr), h = ps.filter(p => p.estado !== 'pendiente').length, nx = ps.find(p => p.estado === 'pendiente'), nc = nx && cli(nx.cliente_id);
      const min = fr.ultima_at ? Math.round((Date.now() - new Date(fr.ultima_at)) / 60000) : null;
      const vt = D.pedidos.filter(p => p.vendedor_id === focoV).reduce((s, p) => s + p.total, 0);
      sc.hidden = false;
      sc.innerHTML = `<div class="h"><span class="avatar" style="--c:${v.color};width:42px;height:42px">${NB.iniciales(v.nombre)}</span><div><b>${esc(v.nombre)}</b><small>Ruta de ${ps.length} puntos</small></div><button class="x" id="scx">✕</button></div>
        <div class="in2"><div><small>Avance</small><b>${h}/${ps.length}</b></div><div><small>Ventas</small><b>${NB.money(vt)}</b></div><div><small>Última señal</small><b>${min == null ? '—' : min < 1 ? 'ahora' : 'hace ' + min + ' min'}</b></div><div><small>Efectividad</small><b>${h ? Math.round(ps.filter(p => p.estado === 'visitado').length / h * 100) : 0}%</b></div></div>
        <div class="nx">${nc ? `Siguiente: <b style="color:var(--tx)">#${nx.orden} ${esc(nc.nombre)}</b>` : 'Ruta completada ✓'}</div>
        <button class="btn pri block" style="margin-top:12px" id="scc">${I.phone} Contactar</button>`;
      sc.querySelector('#scx').onclick = () => { focoV = null; pintarResumen(); };
      sc.querySelector('#scc').onclick = () => contactar(focoV);
    } else sc.hidden = true;

    // equipo
    document.getElementById('team').innerHTML = D.vendedores.map(v => {
      const r = D.rutas.find(x => x.vendedor_id === v.id), ps = r ? paradasDe(r) : [], h = ps.filter(p => p.estado !== 'pendiente').length, nx = ps.find(p => p.estado === 'pendiente');
      const pds = D.pedidos.filter(p => p.vendedor_id === v.id), seg = ps.map(p => `<i class="${p.estado === 'visitado' ? 'd' : p.estado === 'no_compra' ? 's' : p === nx ? 'n' : ''}"></i>`).join('');
      return `<div class="vc ${colapsados.has(v.id) ? 'col' : ''}"><div class="vh"><span class="avatar" style="--c:${v.color}">${NB.iniciales(v.nombre)}</span><div><b>${esc(v.nombre)}</b><span class="z">${I.pin}${r ? `Ruta de ${ps.length} puntos` : 'Sin ruta asignada'}</span></div><button data-c="${v.id}">${I.chev}</button></div>
        <div class="vb"><div class="vbox"><div class="l">${I.route}Avance de ruta</div><div class="seg">${seg || '<i></i>'}</div><div class="big"><b>${h}</b><small>/ ${ps.length} paradas</small></div></div>
          <div class="vbox"><div class="l">${I.dollar}Ventas</div><div class="big" style="margin-top:44px"><b>${NB.money(pds.reduce((s, p) => s + p.total, 0)).replace(/\.\d\d$/, '')}</b></div><small style="color:var(--mu);font-size:12px">${pds.length} pedidos</small></div></div>
        <div class="vf"><button class="btn" data-d="${v.id}" ${r ? '' : 'disabled'}>Detalles</button><button class="btn pri" data-t="${v.id}">Contactar</button></div></div>`;
    }).join('') || '<div class="empty">Aún no hay vendedores.</div>';
    document.querySelectorAll('[data-d]').forEach(b => b.onclick = () => setFoco(b.dataset.d));
    document.querySelectorAll('[data-t]').forEach(b => b.onclick = () => contactar(b.dataset.t));
    document.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { const id = b.dataset.c; colapsados.has(id) ? colapsados.delete(id) : colapsados.add(id); b.closest('.vc').classList.toggle('col'); });

    // actividad
    const ev = D.rutas.flatMap(r => paradasDe(r).filter(p => p.llegada_at).map(p => ({ r, p }))).sort((a, b) => new Date(b.p.llegada_at) - new Date(a.p.llegada_at)).slice(0, 12);
    document.getElementById('feed').innerHTML = ev.length ? ev.map(({ r, p }) => {
      const v = vend(r.vendedor_id), c = cli(p.cliente_id) || {}, pd = ped(p.id);
      const tag = pd ? `<span class="chip ok">${NB.money(pd.total)}</span>` : p.estado === 'no_compra' ? `<span class="chip bad">No compró</span>` : `<span class="chip or">En el local</span>`;
      return `<div class="ev"><span class="avatar" style="--c:${v.color};width:34px;height:34px;font-size:12px">${NB.iniciales(v.nombre)}</span><div style="flex:1;min-width:0"><b>${esc(c.nombre)}</b><br><span style="color:var(--mu);font-size:12px">${esc(v.nombre)} · ${NB.hora(p.llegada_at)}${p.motivo ? ' · ' + esc(p.motivo) : ''}${p.distancia_m > CFG.RADIO_LLEGADA_M ? ` · <span style="color:var(--ye)">⚠ a ${NB.km(p.distancia_m)}</span>` : ''}</span></div>${tag}</div>`;
    }).join('') : '<div class="empty">Aún no hay visitas registradas.</div>';
  }

  /* ───────── ASIGNAR RUTAS ───────── */
  let capa = null;
  function rutas() {
    if (!D.vendedores.length) { main.innerHTML = head('Asignar rutas', '') + '<div class="card empty">Primero crea vendedores en Supabase (ver PANEL.md).</div>'; bindFecha(); return; }
    if (!selV || !vend(selV).id) { selV = D.vendedores[0].id; cargarSel(); }
    main.innerHTML = head('Asignar rutas', `Elige hasta ${MAX} puntos por vendedor para el ${fecha}.`) + `<div class="rutas">
      <div class="card side"><div class="pad" style="border-bottom:1px solid var(--line)">
        <label class="f" style="margin-top:0">Vendedor</label><select class="in" id="sv">${D.vendedores.map(v => `<option value="${v.id}" ${v.id === selV ? 'selected' : ''}>${esc(v.nombre)}</option>`).join('')}</select>
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:14px"><b style="font-size:22px" id="cnt"></b><span style="color:var(--mu)" id="km"></span></div>
        <div class="bar" style="margin-top:8px"><i id="bcnt" style="width:0"></i></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px">
          <button class="btn sm" id="sug" title="Agrega los clientes libres más cercanos al centro del mapa">Sugerir cercanos</button>
          <button class="btn sm" id="opt">Optimizar orden</button>
          <button class="btn sm" id="lim">Vaciar</button>
          <button class="btn sm pri" id="asg">Asignar ruta</button></div>
        <p style="color:var(--mu);font-size:12px;margin-top:10px">Toca puntos en el mapa para agregarlos o quitarlos. "Sugerir" usa el centro del mapa visible como zona.</p></div>
        <div class="lst" id="lst"></div></div>
      <div class="mapbox" id="map"></div></div>`;
    bindFecha();
    map = NB.mapa('map', { z: 13 }); capa = L.layerGroup().addTo(map);
    const pts = D.clientes.map(c => [c.lat, c.lng]); if (pts.length) map.fitBounds(pts, { padding: [30, 30] });
    document.getElementById('sv').onchange = e => { selV = e.target.value; cargarSel(); pintarSel(); };
    document.getElementById('sug').onclick = () => {
      const ctr = map.getCenter(), libres = D.clientes.filter(c => !sel.includes(c.id) && !ocupado(c.id));
      libres.sort((a, b) => NB.dist([a.lat, a.lng], [ctr.lat, ctr.lng]) - NB.dist([b.lat, b.lng], [ctr.lat, ctr.lng]));
      sel = sel.concat(libres.slice(0, MAX - sel.length).map(c => c.id)); ordenar(); pintarSel();
    };
    document.getElementById('opt').onclick = () => { ordenar(); pintarSel(); NB.toast('Orden optimizado'); };
    document.getElementById('lim').onclick = () => { sel = []; pintarSel(); };
    document.getElementById('asg').onclick = asignar;
    pintarSel();
  }
  function cargarSel() { const r = D.rutas.find(x => x.vendedor_id === selV); sel = r ? paradasDe(r).map(p => p.cliente_id) : []; }
  function ocupado(cid) { return D.rutas.some(r => r.vendedor_id !== selV && paradasDe(r).some(p => p.cliente_id === cid)); }
  function ordenar() {
    const c = map ? map.getCenter() : null, pts = sel.map(cli);
    sel = NB.optimizar(pts, c ? [c.lat, c.lng] : CFG.CENTRO).map(x => x.id);
  }
  function pintarSel() {
    const v = vend(selV); capa.clearLayers();
    D.clientes.forEach(c => {
      const i = sel.indexOf(c.id), oc = ocupado(c.id);
      const icon = i >= 0 ? NB.pin(i + 1, '', v.color) : oc ? NB.pin('•', 'grey') : NB.pin('+', 'pend', '#8a8a8a');
      L.marker([c.lat, c.lng], { icon, zIndexOffset: i >= 0 ? 500 : 0 }).bindTooltip(esc(c.nombre) + (oc ? ' (ya asignado a otro vendedor)' : ''), { direction: 'top', offset: [0, -26] })
        .on('click', () => {
          if (oc) return NB.toast('Ese cliente ya está en la ruta de otro vendedor', 'bad');
          if (i >= 0) sel.splice(i, 1); else if (sel.length >= MAX) return NB.toast(`Máximo ${MAX} puntos por ruta`, 'bad'); else sel.push(c.id);
          pintarSel();
        }).addTo(capa);
    });
    const pts = sel.map(cli).filter(Boolean);
    L.polyline(pts.map(c => [c.lat, c.lng]), { color: v.color, weight: 3, opacity: .8, dashArray: '6 8' }).addTo(capa);
    document.getElementById('cnt').innerHTML = `${sel.length}<span style="color:var(--mu);font-size:14px"> / ${MAX} puntos</span>`;
    document.getElementById('bcnt').style.cssText = `width:${sel.length / MAX * 100}%;background:${v.color}`;
    document.getElementById('km').textContent = pts.length > 1 ? '≈ ' + NB.km(NB.largoRuta(pts)) + ' en línea recta' : '';
    document.getElementById('lst').innerHTML = pts.length ? pts.map((c, i) => `<div class="li"><span class="n" style="background:${v.color}">${i + 1}</span><div style="min-width:0"><b>${esc(c.nombre)}</b><small>${esc(c.direccion || '')}</small></div>
      <span style="margin-left:auto;display:flex;gap:2px"><button class="x" data-u="${i}" title="Subir">↑</button><button class="x" data-d="${i}" title="Bajar">↓</button><button class="x" data-r="${i}" title="Quitar">✕</button></span></div>`).join('') : '<div class="empty">Toca puntos en el mapa o usa “Sugerir cercanos”.</div>';
    const mv = (i, j) => { if (j < 0 || j >= sel.length) return; [sel[i], sel[j]] = [sel[j], sel[i]]; pintarSel(); };
    document.querySelectorAll('[data-u]').forEach(b => b.onclick = () => mv(+b.dataset.u, +b.dataset.u - 1));
    document.querySelectorAll('[data-d]').forEach(b => b.onclick = () => mv(+b.dataset.d, +b.dataset.d + 1));
    document.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { sel.splice(+b.dataset.r, 1); pintarSel(); });
  }
  async function asignar() {
    if (!sel.length) return NB.toast('Agrega al menos un punto', 'bad');
    const r = D.rutas.find(x => x.vendedor_id === selV);
    if (r && paradasDe(r).some(p => p.estado !== 'pendiente') && !confirm('Este vendedor ya registró visitas hoy. Reasignar la ruta borrará ese avance. ¿Continuar?')) return;
    try { await NB.data.crearRuta({ vendedor_id: selV, fecha, clienteIds: sel }); await reload(); NB.toast(`Ruta de ${sel.length} puntos asignada a ${vend(selV).nombre}`); pintarSel(); }
    catch (e) { console.error(e); NB.toast('No se pudo guardar la ruta', 'bad'); }
  }

  /* ───────── VENTAS ───────── */
  function ventas() {
    const total = D.pedidos.reduce((s, p) => s + p.total, 0), porProd = {};
    D.pedidos.forEach(p => p.items.forEach(i => { const x = porProd[i.nombre] ||= { c: 0, m: 0 }; x.c += i.cant; x.m += i.cant * i.precio; }));
    const ord = [...D.pedidos].sort((a, b) => new Date(b.creado_at) - new Date(a.creado_at));
    main.innerHTML = head('Ventas', `${D.pedidos.length} pedidos · ${NB.money(total)}`) + `<div class="grid2">
      <div class="card" style="overflow:auto"><table><tr><th>Hora</th><th>Vendedor</th><th>Cliente</th><th>Detalle</th><th class="num">Total</th></tr>
        ${ord.map(p => `<tr><td>${NB.hora(p.creado_at)}</td><td>${esc(vend(p.vendedor_id).nombre)}</td><td><b>${esc((cli(p.cliente_id) || {}).nombre)}</b></td><td style="color:var(--mu)">${p.items.map(i => i.cant + '× ' + esc(i.nombre)).join(', ')}</td><td class="num"><b>${NB.money(p.total)}</b></td></tr>`).join('') || '<tr><td colspan="5" class="empty">Sin pedidos en esta fecha.</td></tr>'}</table></div>
      <div class="card pad"><h3>Por producto</h3><div style="margin-top:12px">${Object.entries(porProd).sort((a, b) => b[1].m - a[1].m).map(([n, x]) => `<div style="margin-bottom:14px"><div style="display:flex;justify-content:space-between"><b>${esc(n)}</b><span>${NB.money(x.m)}</span></div><div class="bar" style="margin:6px 0 2px"><i style="width:${total ? x.m / total * 100 : 0}%"></i></div><small style="color:var(--mu)">${x.c} unidades</small></div>`).join('') || '<div class="empty">—</div>'}</div></div></div>`;
    bindFecha();
  }

  /* ───────── CLIENTES ───────── */
  function clientes(filtro = '') {
    const f = filtro.toLowerCase(), lst = D.clientes.filter(c => (c.nombre + c.tipo + (c.direccion || '')).toLowerCase().includes(f));
    main.innerHTML = head('Clientes', `${D.clientes.length} puntos de venta`, `<input class="in" id="bus" placeholder="Buscar…" value="${esc(filtro)}" style="width:200px"><button class="btn pri" id="nuevo">+ Nuevo cliente</button>`) + `
      <div class="card" style="overflow:auto"><table><tr><th>Nombre</th><th>Tipo</th><th>Dirección</th><th>Teléfono</th><th></th></tr>
      ${lst.map(c => `<tr><td><b>${esc(c.nombre)}</b></td><td><span class="chip">${esc(c.tipo)}</span></td><td style="color:var(--mu)">${esc(c.direccion || '')}</td><td>${esc(c.telefono || '')}</td><td class="num"><button class="btn sm" data-e="${c.id}">Editar</button></td></tr>`).join('') || '<tr><td colspan="5" class="empty">Sin resultados.</td></tr>'}</table></div>`;
    bindFecha();
    const b = document.getElementById('bus'); b.oninput = () => { clientes(b.value); const n = document.getElementById('bus'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
    document.getElementById('nuevo').onclick = () => formCliente();
    document.querySelectorAll('[data-e]').forEach(x => x.onclick = () => formCliente(cli(x.dataset.e)));
  }
  function formCliente(c = {}) {
    NB.modal(`<h2>${c.id ? 'Editar' : 'Nuevo'} cliente</h2>
      <label class="f">Nombre del negocio</label><input class="in" id="fn" value="${esc(c.nombre || '')}">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div><label class="f">Tipo</label><select class="in" id="ft">${['Gimnasio', 'Minimarket', 'Cafetería', 'Farmacia', 'Universidad', 'Tienda', 'Otro'].map(t => `<option ${t === c.tipo ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div><label class="f">Teléfono</label><input class="in" id="fp" value="${esc(c.telefono || '')}"></div></div>
      <label class="f">Dirección / referencia</label><input class="in" id="fd" value="${esc(c.direccion || '')}">
      <label class="f">Ubicación — toca el mapa para colocar el punto</label><div id="pm" style="height:230px;border-radius:10px;overflow:hidden;border:1px solid var(--line)"></div>
      <div style="display:flex;gap:10px;margin-top:18px;justify-content:flex-end"><button class="btn" id="fc">Cancelar</button><button class="btn pri" id="fg">Guardar</button></div>`, (el, close) => {
      let pos = c.lat != null ? [c.lat, c.lng] : null;
      setTimeout(() => {
        const m = NB.mapa('pm', { centro: pos || CFG.CENTRO, z: pos ? 16 : 13 }); let mk = pos && L.marker(pos, { icon: NB.pin('•') }).addTo(m);
        m.on('click', e => { pos = [+e.latlng.lat.toFixed(6), +e.latlng.lng.toFixed(6)]; if (mk) mk.setLatLng(pos); else mk = L.marker(pos, { icon: NB.pin('•') }).addTo(m); });
      }, 50);
      el.querySelector('#fc').onclick = close;
      el.querySelector('#fg').onclick = async () => {
        const nombre = el.querySelector('#fn').value.trim(); if (!nombre || !pos) return NB.toast('Falta el nombre o la ubicación en el mapa', 'bad');
        try { await NB.data.guardarCliente({ id: c.id, nombre, tipo: el.querySelector('#ft').value, telefono: el.querySelector('#fp').value.trim(), direccion: el.querySelector('#fd').value.trim(), lat: pos[0], lng: pos[1] }); await reload(); close(); show('clientes'); NB.toast('Cliente guardado'); }
        catch (e) { console.error(e); NB.toast('No se pudo guardar', 'bad'); }
      };
    });
  }

  /* ───────── PRODUCTOS ───────── */
  function productos() {
    main.innerHTML = head('Productos', 'Catálogo y precios que ve el vendedor al tomar un pedido.', '<button class="btn pri" id="np">+ Nuevo producto</button>') + `
      <div class="card" style="overflow:auto"><table><tr><th>Producto</th><th style="width:150px">Precio (USD)</th><th style="width:110px">Activo</th></tr>
      ${D.productos.map(p => `<tr><td><b>${esc(p.nombre)}</b></td><td><input class="in" type="number" step="0.01" min="0" value="${p.precio}" data-p="${p.id}" style="width:110px"></td>
        <td><button class="btn sm ${p.activo ? 'ok' : ''}" data-a="${p.id}">${p.activo ? 'Activo' : 'Oculto'}</button></td></tr>`).join('')}</table></div>
      <p style="color:var(--mu);margin-top:12px">Los precios del ejemplo son referenciales: edítalos con tus precios reales.</p>`;
    bindFecha();
    document.querySelectorAll('[data-p]').forEach(i => i.onchange = async () => { await NB.data.guardarProducto({ id: i.dataset.p, precio: +i.value }); await reload(); NB.toast('Precio actualizado'); });
    document.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => { const p = D.productos.find(x => x.id === b.dataset.a); await NB.data.guardarProducto({ id: p.id, activo: !p.activo }); await reload(); productos(); });
    document.getElementById('np').onclick = () => NB.modal(`<h2>Nuevo producto</h2><label class="f">Nombre</label><input class="in" id="n"><label class="f">Precio (USD)</label><input class="in" id="pr" type="number" step="0.01" min="0">
      <div style="display:flex;gap:10px;margin-top:18px;justify-content:flex-end"><button class="btn" id="c">Cancelar</button><button class="btn pri" id="g">Guardar</button></div>`, (el, close) => {
      el.querySelector('#c').onclick = close;
      el.querySelector('#g').onclick = async () => { const n = el.querySelector('#n').value.trim(), pr = +el.querySelector('#pr').value; if (!n || !(pr >= 0)) return NB.toast('Revisa los datos', 'bad'); await NB.data.guardarProducto({ nombre: n, precio: pr, activo: true }); await reload(); close(); productos(); };
    });
  }

  // Tiempo real: refresca datos y repinta solo donde no se pisa el trabajo del usuario
  let t = null;
  NB.data.suscribir(() => { clearTimeout(t); t = setTimeout(async () => { try { await reload(); if (view === 'resumen') pintarResumen(); else if (view === 'ventas') ventas(); } catch (e) { console.error(e); } }, 250); });
  show('resumen');
})();
