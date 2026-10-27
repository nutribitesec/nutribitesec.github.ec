(async function () {
  const root = document.getElementById('root'), CFG = NB.CFG = window.NB_CONFIG, esc = NB.esc, MAX = 20;
  const user = await NB.requireLogin('admin', root, 'Panel del dueño');
  let fecha = NB.hoy(), D = null, view = 'resumen', map = null, layer = null, fitted = false, focoV = null;
  let sel = [], selV = null;   // constructor de rutas

  const NAV = [['resumen', 'Resumen en vivo', '◉'], ['rutas', 'Asignar rutas', '⛓'], ['ventas', 'Ventas', '＄'], ['clientes', 'Clientes', '⌂'], ['productos', 'Productos', '▣']];
  root.innerHTML = `<div id="app">
    <nav><div class="logo">NUTRI<b>BITES</b><small>PANEL DEL DUEÑO</small></div>
      ${NAV.map(n => `<a class="t" data-v="${n[0]}"><span style="width:18px;text-align:center">${n[2]}</span>${n[1]}</a>`).join('')}
      ${NB.data.demo ? `<button class="btn sm" id="rst" style="margin-top:14px">Reiniciar datos demo</button>` : ''}
      <div class="me"><span class="avatar" style="--c:${user.color || '#FF8C42'}">${NB.iniciales(user.nombre)}</span><div style="flex:1;min-width:0"><b>${esc(user.nombre)}</b><br><a id="out" style="font-size:12px;cursor:pointer">Cerrar sesión</a></div></div>
    </nav><main id="main"></main></div>`;
  const main = document.getElementById('main');
  root.querySelectorAll('nav a.t').forEach(a => a.onclick = () => show(a.dataset.v));
  document.getElementById('out').onclick = async () => { await NB.data.logout(); location.reload(); };
  const rst = document.getElementById('rst'); if (rst) rst.onclick = async () => { if (confirm('¿Volver a los datos de ejemplo?')) { await NB.data.reiniciar(); await reload(); show(view); } };

  const cli = id => D.clientes.find(c => c.id === id), vend = id => D.vendedores.find(v => v.id === id) || { nombre: '—', color: '#888' };
  const ped = pid => D.pedidos.find(p => p.parada_id === pid);
  const paradasDe = r => r.paradas || [];
  async function reload() { D = await NB.data.dia(fecha); }
  function destroyMap() { if (map) { map.remove(); map = null; layer = null; fitted = false; } }

  function head(titulo, sub, extra = '') {
    return `<header class="top"><div><h1>${titulo}</h1><p>${sub}</p></div>
      <div class="tools">${extra}<span class="live"><i></i>En vivo</span><input class="in" type="date" id="fecha" value="${fecha}" style="width:auto"></div></header>`;
  }
  function bindFecha() { document.getElementById('fecha').onchange = async e => { fecha = e.target.value || NB.hoy(); sel = []; selV = null; await reload(); show(view); }; }

  async function show(v) {
    view = v; destroyMap();
    root.querySelectorAll('nav a.t').forEach(a => a.classList.toggle('on', a.dataset.v === v));
    if (!D) await reload();
    ({ resumen, rutas, ventas, clientes, productos }[v])();
  }

  /* ───────── RESUMEN ───────── */
  function stats() {
    const par = D.rutas.flatMap(paradasDe), hechas = par.filter(p => p.estado !== 'pendiente');
    const compras = par.filter(p => p.estado === 'visitado').length, ventas = D.pedidos.reduce((s, p) => s + p.total, 0);
    return { total: par.length, hechas: hechas.length, compras, ventas, pedidos: D.pedidos.length, efect: hechas.length ? Math.round(compras / hechas.length * 100) : 0, ticket: D.pedidos.length ? ventas / D.pedidos.length : 0 };
  }
  function resumen() {
    const hoy = fecha === NB.hoy();
    main.innerHTML = head('Resumen en vivo', hoy ? 'Qué está pasando hoy en la calle.' : 'Resultado del día ' + fecha) + `
      <div class="kpis" id="kpis"></div>
      <div class="grid2"><div><div class="mapbox" id="map"></div>
        <div class="legend"><span><i class="dot" style="--c:var(--gr)"></i>Visitado con pedido</span><span><i class="dot" style="--c:var(--rd)"></i>No compró</span><span><i class="dot" style="--c:var(--or)"></i>Pendiente (borde = color del vendedor)</span><span>🚚 Posición del vendedor</span></div></div>
        <div class="card pad"><h3>Actividad</h3><div class="feed" id="feed"></div></div></div>
      <div class="card" style="overflow:auto"><div class="pad" style="padding-bottom:6px"><h3>Equipo de ventas</h3></div><table id="team"></table></div>`;
    bindFecha();
    map = NB.mapa('map', { z: 13 }); layer = L.layerGroup().addTo(map);
    pintarResumen();
  }
  function pintarResumen() {
    if (view !== 'resumen') return;
    const s = stats();
    document.getElementById('kpis').innerHTML = [
      ['Visitas completadas', `${s.hechas}<span style="color:var(--mu);font-size:18px"> / ${s.total}</span>`, s.total ? Math.round(s.hechas / s.total * 100) + '% de la ruta del día' : 'Sin rutas asignadas'],
      ['Ventas del día', NB.money(s.ventas), `${s.pedidos} pedidos · ticket ${NB.money(s.ticket)}`],
      ['Efectividad', s.efect + '%', `${s.compras} compras de ${s.hechas} visitas`],
      ['Vendedores en ruta', D.rutas.length + '<span style="color:var(--mu);font-size:18px"> / ' + D.vendedores.length + '</span>', D.rutas.length ? 'con ruta asignada hoy' : 'Asigna rutas en el menú']
    ].map(k => `<div class="card kpi"><h3>${k[0]}</h3><div class="v">${k[1]}</div><div class="s">${k[2]}</div></div>`).join('');

    // mapa
    layer.clearLayers(); const all = [];
    D.rutas.forEach(r => {
      const v = vend(r.vendedor_id), ps = paradasDe(r), dim = focoV && focoV !== r.vendedor_id;
      const pts = ps.map(p => cli(p.cliente_id)).filter(Boolean).map(c => [c.lat, c.lng]);
      L.polyline(pts, { color: v.color, weight: 3, opacity: dim ? .15 : .7, dashArray: '6 8' }).addTo(layer);
      const next = ps.find(p => p.estado === 'pendiente');
      ps.forEach(p => {
        const c = cli(p.cliente_id); if (!c) return; all.push([c.lat, c.lng]);
        const cls = p.estado === 'visitado' ? 'done' : p.estado === 'no_compra' ? 'skip' : 'pend' + (p === next ? ' next' : '');
        const pd = ped(p.id);
        const pop = `<b>${esc(c.nombre)}</b><br><span style="color:var(--mu)">${esc(v.nombre)} · parada ${p.orden}</span><br>${NB.estadoTxt(p.estado)}${p.llegada_at ? ' · ' + NB.hora(p.llegada_at) : ''}${pd ? '<br><b>' + NB.money(pd.total) + '</b>' : ''}${p.motivo ? '<br>' + esc(p.motivo) : ''}`;
        L.marker([c.lat, c.lng], { icon: NB.pin(p.orden, cls, v.color), opacity: dim ? .3 : 1 }).bindPopup(pop).addTo(layer);
      });
      if (r.ultima_lat != null) {
        const min = Math.round((Date.now() - new Date(r.ultima_at)) / 60000);
        L.marker([r.ultima_lat, r.ultima_lng], { zIndexOffset: 1000, icon: L.divIcon({ className: '', iconSize: [34, 34], iconAnchor: [17, 17], html: `<div class="truck" style="--c:${v.color}">🚚</div>` }) })
          .bindPopup(`<b>${esc(v.nombre)}</b><br>última señal hace ${min < 1 ? 'instantes' : min + ' min'}`).addTo(layer);
      }
    });
    if (all.length && !fitted) { map.fitBounds(all, { padding: [40, 40] }); fitted = true; }
    if (!all.length) map.setView(CFG.CENTRO, 13);

    // actividad
    const ev = D.rutas.flatMap(r => paradasDe(r).filter(p => p.llegada_at).map(p => ({ r, p }))).sort((a, b) => new Date(b.p.llegada_at) - new Date(a.p.llegada_at)).slice(0, 14);
    document.getElementById('feed').innerHTML = ev.length ? ev.map(({ r, p }) => {
      const v = vend(r.vendedor_id), c = cli(p.cliente_id) || {}, pd = ped(p.id);
      const tag = pd ? `<span class="chip ok">Pedido ${NB.money(pd.total)}</span>` : p.estado === 'no_compra' ? `<span class="chip bad">No compró</span>` : `<span class="chip or">En el local</span>`;
      return `<div class="ev"><span class="avatar" style="--c:${v.color};width:32px;height:32px;font-size:12px">${NB.iniciales(v.nombre)}</span><div style="flex:1;min-width:0"><b>${esc(c.nombre)}</b><br><span style="color:var(--mu);font-size:12px">${esc(v.nombre)} · ${NB.hora(p.llegada_at)}${p.motivo ? ' · ' + esc(p.motivo) : ''}${p.distancia_m > CFG.RADIO_LLEGADA_M ? ` · <span style="color:var(--ye)">⚠ marcó a ${NB.km(p.distancia_m)}</span>` : ''}</span></div>${tag}</div>`;
    }).join('') : '<div class="empty">Aún no hay visitas registradas.</div>';

    // equipo
    document.getElementById('team').innerHTML = `<tr><th>Vendedor</th><th style="width:26%">Avance de ruta</th><th class="num">Pedidos</th><th class="num">Ventas</th><th class="num">Efectividad</th><th>Última señal</th><th></th></tr>` +
      (D.vendedores.map(v => {
        const r = D.rutas.find(x => x.vendedor_id === v.id), ps = r ? paradasDe(r) : [], h = ps.filter(p => p.estado !== 'pendiente').length;
        const pds = D.pedidos.filter(p => p.vendedor_id === v.id), ef = h ? Math.round(ps.filter(p => p.estado === 'visitado').length / h * 100) : 0;
        return `<tr><td><div class="seller"><span class="avatar" style="--c:${v.color}">${NB.iniciales(v.nombre)}</span><b>${esc(v.nombre)}</b></div></td>
          <td>${r ? `<div class="bar" style="--c:${v.color}"><i style="width:${ps.length ? h / ps.length * 100 : 0}%"></i></div><small style="color:var(--mu)">${h} de ${ps.length} puntos</small>` : '<span style="color:var(--mu)">Sin ruta</span>'}</td>
          <td class="num">${pds.length}</td><td class="num"><b>${NB.money(pds.reduce((s, p) => s + p.total, 0))}</b></td><td class="num">${ef}%</td>
          <td>${r && r.ultima_at ? NB.hora(r.ultima_at) : '—'}</td><td class="num">${r ? `<button class="btn sm" data-foco="${v.id}">${focoV === v.id ? 'Ver todos' : 'Ver ruta'}</button>` : ''}</td></tr>`;
      }).join('') || '<tr><td colspan="7" class="empty">Aún no hay vendedores.</td></tr>');
    document.querySelectorAll('[data-foco]').forEach(b => b.onclick = () => {
      focoV = focoV === b.dataset.foco ? null : b.dataset.foco; pintarResumen();
      const r = D.rutas.find(x => x.vendedor_id === focoV);
      const pts = (focoV && r ? paradasDe(r) : D.rutas.flatMap(paradasDe)).map(p => cli(p.cliente_id)).filter(Boolean).map(c => [c.lat, c.lng]);
      if (pts.length) map.fitBounds(pts, { padding: [40, 40] });
    });
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
