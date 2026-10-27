(async function () {
  const root = document.getElementById('root'), CFG = window.NB_CONFIG, esc = NB.esc;
  const user = await NB.requireLogin('vendedor', root, 'Mi ruta del día');
  const fecha = NB.hoy();
  let D = null, ruta = null, map = null, layer = null, me = null, meMarker = null, abierto = null, fitted = false, lastSend = 0;

  root.innerHTML = `<div id="app">
    <div class="bar-top"><div class="row"><div class="logo">NUTRI<b>BITES</b></div>
      <div style="display:flex;align-items:center;gap:10px"><span style="color:var(--mu)">${esc(user.nombre.split(' ')[0])}</span><button class="btn sm" id="out">Salir</button></div></div>
      <div class="prog"><b id="pg">0/0</b><span style="color:var(--mu)" id="pgs"></span></div>
      <div class="bar" style="margin-top:8px"><i id="pb" style="width:0;background:var(--or)"></i></div></div>
    <div id="mapa"></div><div class="sheet" id="sheet"></div></div>`;
  document.getElementById('out').onclick = async () => { await NB.data.logout(); location.reload(); };
  map = NB.mapa('mapa', { z: 14, zoom: false }); layer = L.layerGroup().addTo(map);

  const cli = id => D.clientes.find(c => c.id === id);
  const ped = pid => D.pedidos.find(p => p.parada_id === pid);
  const mine = d => d.rutas.find(r => r.vendedor_id === user.id) || null;
  async function reload() { D = await NB.data.dia(fecha); ruta = mine(D); }

  /* GPS */
  function iniciarGPS() {
    if (!navigator.geolocation) return;
    navigator.geolocation.watchPosition(p => {
      me = [p.coords.latitude, p.coords.longitude];
      if (meMarker) meMarker.setLatLng(me); else meMarker = L.marker(me, { icon: L.divIcon({ className: '', iconSize: [18, 18], html: '<div class="gps"></div>' }), zIndexOffset: 2000 }).addTo(map);
      if (ruta && Date.now() - lastSend > 30000) { lastSend = Date.now(); NB.data.posicion(ruta.id, me[0], me[1]).catch(() => { }); }
      if (!abierto) pintarLista();
    }, () => { }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
  }

  /* Pantalla principal */
  function pintar() {
    const ps = ruta ? ruta.paradas : [], hechas = ps.filter(p => p.estado !== 'pendiente').length;
    document.getElementById('pg').textContent = `${hechas}/${ps.length}`;
    document.getElementById('pgs').textContent = ps.length ? (hechas === ps.length ? 'Ruta completada' : 'paradas completadas') : '';
    document.getElementById('pb').style.width = ps.length ? hechas / ps.length * 100 + '%' : '0';
    layer.clearLayers();
    const next = ps.find(p => p.estado === 'pendiente'), pts = [];
    ps.forEach(p => {
      const c = cli(p.cliente_id); if (!c) return; pts.push([c.lat, c.lng]);
      const cls = p.estado === 'visitado' ? 'done' : p.estado === 'no_compra' ? 'skip' : 'pend' + (p === next ? ' next' : '');
      L.marker([c.lat, c.lng], { icon: NB.pin(p.orden, cls, user.color), zIndexOffset: p === next ? 900 : 0 }).on('click', () => abrir(p.id)).addTo(layer);
    });
    L.polyline(pts, { color: user.color || '#FF8C42', weight: 3, opacity: .6, dashArray: '6 8' }).addTo(layer);
    if (pts.length && !fitted) { map.fitBounds(pts, { padding: [30, 30] }); fitted = true; }
    pintarLista();
  }
  function pintarLista() {
    const sh = document.getElementById('sheet'); if (!sh) return;
    if (!ruta || !ruta.paradas.length) { sh.innerHTML = `<div class="empty"><div style="font-size:42px">🗺️</div><h3 style="margin:10px 0 4px;color:var(--tx);letter-spacing:0;font-size:18px;text-transform:none">Aún no tienes ruta para hoy</h3>El dueño te asignará tus puntos del día. Esta pantalla se actualiza sola.</div>`; return; }
    const ps = ruta.paradas, next = ps.find(p => p.estado === 'pendiente');
    let html = '';
    if (next) {
      const c = cli(next.cliente_id), d = me ? ' · a ' + NB.km(NB.dist(me, [c.lat, c.lng])) : '';
      html += `<div class="next"><small>Siguiente parada · #${next.orden}</small><h2>${esc(c.nombre)}</h2><span style="color:var(--mu)">${esc(c.direccion || '')}${d}</span>
        <div class="acts" style="margin-bottom:0"><a class="btn pri" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}&travelmode=driving">Cómo llegar</a><button class="btn" data-o="${next.id}">Abrir visita</button></div></div>`;
    } else {
      const v = D.pedidos.filter(p => p.vendedor_id === user.id);
      html += `<div class="next" style="border-color:rgba(61,220,132,.5);background:rgba(61,220,132,.08)"><small style="color:var(--gr)">Ruta completada</small><h2>¡Buen trabajo, ${esc(user.nombre.split(' ')[0])}!</h2><span style="color:var(--mu)">${v.length} pedidos · ${NB.money(v.reduce((s, p) => s + p.total, 0))} vendidos hoy</span></div>`;
    }
    html += ps.map(p => {
      const c = cli(p.cliente_id) || {}, pd = ped(p.id), cls = p.estado === 'visitado' ? 'done' : p.estado === 'no_compra' ? 'skip' : '';
      const chip = pd ? `<span class="chip ok">${NB.money(pd.total)}</span>` : p.estado === 'no_compra' ? `<span class="chip bad">No compró</span>` : p.llegada_at ? `<span class="chip or">En el local</span>` : '';
      return `<div class="stop" data-o="${p.id}"><span class="n ${cls}">${p.estado === 'visitado' ? '✓' : p.estado === 'no_compra' ? '✕' : p.orden}</span><div class="tx"><b>${esc(c.nombre)}</b><span>${esc(c.tipo || '')} · ${esc(c.direccion || '')}</span></div>${chip}</div>`;
    }).join('');
    sh.innerHTML = html;
    sh.querySelectorAll('[data-o]').forEach(e => e.onclick = () => abrir(e.dataset.o));
  }

  /* Detalle de una parada */
  function cerrar() { abierto = null; const f = document.getElementById('full'); if (f) f.remove(); pintar(); }
  function abrir(id) {
    abierto = id; let f = document.getElementById('full');
    if (!f) { f = document.createElement('div'); f.id = 'full'; f.className = 'full'; document.body.appendChild(f); }
    const p = ruta.paradas.find(x => x.id === id), c = cli(p.cliente_id), pd = ped(p.id);
    f.innerHTML = `<div class="hd"><button class="back" id="bk">←</button><div style="min-width:0"><small style="color:var(--or);font-weight:800;letter-spacing:1.2px">PARADA ${p.orden} DE ${ruta.paradas.length}</small><div style="font-weight:800;font-size:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.nombre)}</div></div></div>
      <div class="bd" id="bd"></div>`;
    f.querySelector('#bk').onclick = cerrar;
    const bd = f.querySelector('#bd');
    const cab = `<div class="info"><b>${esc(c.tipo || '')}</b> · ${esc(c.direccion || '')}${c.telefono ? `<br><a href="tel:${esc(c.telefono)}">📞 ${esc(c.telefono)}</a>` : ''}</div>
      <a class="btn block" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}&travelmode=driving">📍 Cómo llegar</a>`;

    if (p.estado !== 'pendiente') {   // resumen de solo lectura
      bd.innerHTML = cab + `<div class="info ${pd ? 'ok' : 'warn'}"><b>${pd ? 'Pedido registrado' : 'Visita sin compra'}</b> · ${NB.hora(p.llegada_at)}
        ${pd ? '<br>' + pd.items.map(i => `${i.cant}× ${esc(i.nombre)}`).join('<br>') + `<div class="tot" style="padding-bottom:0"><span>Total</span><b>${NB.money(pd.total)}</b></div>` : `<br>${esc(p.motivo || '')}`}</div>`;
      return;
    }
    if (!p.llegada_at) {              // paso 1: marcar llegada
      bd.innerHTML = cab + `<div class="info warn" style="margin-top:14px">Marca tu llegada cuando estés en el local. Se guarda tu ubicación y la hora.</div>
        <button class="btn pri big block" id="ll">Marcar llegada</button>`;
      bd.querySelector('#ll').onclick = () => llegada(p, c, bd.querySelector('#ll'));
      return;
    }
    bd.innerHTML = cab + `<div class="info ok">Llegada registrada a las <b>${NB.hora(p.llegada_at)}</b>${p.distancia_m != null ? ` · a ${NB.km(p.distancia_m)} del local` : ''}</div>
      <div class="acts"><button class="btn pri big" id="pp">Tomar pedido</button><button class="btn bad big" id="nc">No compró</button></div>`;
    bd.querySelector('#pp').onclick = () => formPedido(p, c, bd);
    bd.querySelector('#nc').onclick = () => formNoCompra(p, bd);
  }

  function posicionActual(c) {
    return new Promise((ok, no) => {
      const sim = () => NB.data.demo ? ok([c.lat + (Math.random() - .5) * .0006, c.lng + (Math.random() - .5) * .0006, true]) : no(new Error('gps'));
      if (!navigator.geolocation) return sim();
      navigator.geolocation.getCurrentPosition(g => ok([g.coords.latitude, g.coords.longitude]), sim, { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 });
    });
  }
  async function llegada(p, c, btn) {
    btn.disabled = true; btn.textContent = 'Obteniendo ubicación…';
    let pos; try { pos = await posicionActual(c); } catch (e) { btn.disabled = false; btn.textContent = 'Marcar llegada'; return NB.toast('No se pudo obtener el GPS. Activa la ubicación del teléfono.', 'bad'); }
    const d = Math.round(NB.dist([pos[0], pos[1]], [c.lat, c.lng]));
    if (d > CFG.RADIO_LLEGADA_M && !confirm(`Estás a ${NB.km(d)} del local. ¿Marcar llegada de todos modos? Quedará registrado.`)) { btn.disabled = false; btn.textContent = 'Marcar llegada'; return; }
    try {
      await NB.data.actualizarParada(p.id, { llegada_at: new Date().toISOString(), llegada_lat: pos[0], llegada_lng: pos[1], distancia_m: d });
      await reload(); NB.toast('Llegada registrada'); abrir(p.id);
    } catch (e) { console.error(e); btn.disabled = false; btn.textContent = 'Marcar llegada'; NB.toast('Sin conexión. Intenta de nuevo.', 'bad'); }
  }

  function formPedido(p, c, bd) {
    const prods = D.productos.filter(x => x.activo), q = {}; prods.forEach(x => q[x.id] = 0);
    bd.innerHTML = `<h2 style="font-size:18px;margin-bottom:4px">Pedido</h2>
      ${prods.map(x => `<div class="prod"><div class="nm"><b>${esc(x.nombre)}</b><small>${NB.money(x.precio)} c/u</small></div><div class="step"><button data-m="${x.id}">−</button><span id="q_${x.id}">0</span><button data-p="${x.id}">+</button></div></div>`).join('') || '<div class="empty">No hay productos activos. Pídele al dueño que active alguno.</div>'}
      <div class="tot"><span>Total</span><b id="tt">$0.00</b></div>
      <div class="acts"><button class="btn big" id="cx">Atrás</button><button class="btn ok big" id="cf" disabled>Confirmar</button></div>`;
    const calc = () => { const t = prods.reduce((s, x) => s + q[x.id] * x.precio, 0); bd.querySelector('#tt').textContent = NB.money(t); bd.querySelector('#cf').disabled = t <= 0; return t; };
    bd.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { q[b.dataset.p]++; bd.querySelector('#q_' + b.dataset.p).textContent = q[b.dataset.p]; calc(); });
    bd.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { q[b.dataset.m] = Math.max(0, q[b.dataset.m] - 1); bd.querySelector('#q_' + b.dataset.m).textContent = q[b.dataset.m]; calc(); });
    bd.querySelector('#cx').onclick = () => abrir(p.id);
    bd.querySelector('#cf').onclick = async e => {
      const items = prods.filter(x => q[x.id] > 0).map(x => ({ producto_id: x.id, nombre: x.nombre, precio: x.precio, cant: q[x.id] })), total = +calc().toFixed(2);
      e.target.disabled = true;
      try {
        await NB.data.crearPedido({ parada_id: p.id, vendedor_id: user.id, cliente_id: c.id, fecha, items, total });
        await NB.data.actualizarParada(p.id, { estado: 'visitado' });
        await reload(); NB.toast('Pedido guardado ✓'); cerrar();
      } catch (err) { console.error(err); e.target.disabled = false; NB.toast('No se pudo guardar. Revisa tu conexión.', 'bad'); }
    };
  }
  function formNoCompra(p, bd) {
    bd.innerHTML = `<h2 style="font-size:18px">¿Por qué no compró?</h2>
      <label class="f">Motivo</label><select class="in" id="mo">${NB.MOTIVOS.map(m => `<option>${esc(m)}</option>`).join('')}</select>
      <label class="f">Nota (opcional)</label><textarea class="in" id="nt" rows="3"></textarea>
      <div class="acts"><button class="btn big" id="cx">Atrás</button><button class="btn pri big" id="cf">Guardar</button></div>`;
    bd.querySelector('#cx').onclick = () => abrir(p.id);
    bd.querySelector('#cf').onclick = async e => {
      e.target.disabled = true;
      try { await NB.data.actualizarParada(p.id, { estado: 'no_compra', motivo: bd.querySelector('#mo').value, nota: bd.querySelector('#nt').value.trim() || null }); await reload(); NB.toast('Visita registrada'); cerrar(); }
      catch (err) { console.error(err); e.target.disabled = false; NB.toast('No se pudo guardar. Revisa tu conexión.', 'bad'); }
    };
  }

  let t = null;
  NB.data.suscribir(() => { clearTimeout(t); t = setTimeout(async () => { try { await reload(); if (!abierto) pintar(); } catch (e) { console.error(e); } }, 300); });
  await reload(); pintar(); iniciarGPS();
})();
