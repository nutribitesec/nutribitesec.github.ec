// Utilidades compartidas por el panel de administración y el de vendedor.
(function () {
  const CFG = window.NB_CONFIG;
  const NB = (window.NB = window.NB || {});

  NB.COLORES = ['#FF8C42', '#4DA3FF', '#B07CFF', '#3DDC84', '#FFC83D', '#FF6FA8'];
  NB.hoy = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  NB.money = n => '$' + (+n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  NB.hora = iso => iso ? new Date(iso).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }) : '—';
  NB.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  NB.iniciales = n => (n || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  NB.dist = (a, b) => { // metros (haversine)
    const R = 6371000, r = x => x * Math.PI / 180;
    const dLa = r(b[0] - a[0]), dLo = r(b[1] - a[1]);
    const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLo / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  NB.km = m => m >= 1000 ? (m / 1000).toFixed(1) + ' km' : Math.round(m) + ' m';

  // Orden de visita: vecino más cercano + mejora 2-opt (ruta abierta desde "inicio").
  NB.optimizar = function (pts, inicio) {
    if (pts.length < 3) return pts.slice();
    const d = (a, b) => NB.dist([a.lat, a.lng], [b.lat, b.lng]);
    const start = inicio ? { lat: inicio[0], lng: inicio[1] } : pts[0];
    const left = pts.slice(), ruta = []; let cur = start;
    while (left.length) {
      let bi = 0, bd = Infinity;
      left.forEach((p, i) => { const x = d(cur, p); if (x < bd) { bd = x; bi = i; } });
      cur = left.splice(bi, 1)[0]; ruta.push(cur);
    }
    const total = r => r.reduce((s, p, i) => s + d(i ? r[i - 1] : start, p), 0);
    let mejor = true, it = 0;
    while (mejor && it++ < 50) {
      mejor = false;
      for (let i = 0; i < ruta.length - 1; i++) for (let j = i + 1; j < ruta.length; j++) {
        const n = ruta.slice(0, i).concat(ruta.slice(i, j + 1).reverse(), ruta.slice(j + 1));
        if (total(n) < total(ruta) - 1) { ruta.splice(0, ruta.length, ...n); mejor = true; }
      }
    }
    return ruta;
  };
  NB.largoRuta = pts => pts.reduce((s, p, i) => s + (i ? NB.dist([pts[i - 1].lat, pts[i - 1].lng], [p.lat, p.lng]) : 0), 0);

  // Mapa base oscuro (OpenStreetMap vía CARTO)
  NB.mapa = function (el, opts = {}) {
    const m = L.map(el, { zoomControl: opts.zoom !== false, attributionControl: true }).setView(opts.centro || CFG.CENTRO, opts.z || 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19, subdomains: 'abcd',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(m);
    return m;
  };
  NB.pin = (txt, cls = '', color) => L.divIcon({
    className: '', iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -28],
    html: `<div class="pin ${cls}" style="--c:${color || '#FF8C42'}"><span>${txt}</span></div>`
  });

  NB.toast = (msg, tipo = 'ok') => {
    const t = document.createElement('div'); t.className = 'toast ' + tipo; t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 2800);
  };
  NB.modal = (html, onMount) => {
    const bg = document.createElement('div'); bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal">${html}</div>`;
    bg.addEventListener('mousedown', e => { if (e.target === bg) bg.remove(); });
    document.body.appendChild(bg); onMount && onMount(bg.firstChild, () => bg.remove()); return bg;
  };

  // Estado de una parada para mostrar
  NB.estadoTxt = e => ({ pendiente: 'Pendiente', visitado: 'Visitado', no_compra: 'No compró' }[e] || e);
  NB.MOTIVOS = ['Tiene stock suficiente', 'No estaba el encargado', 'Local cerrado', 'Precio alto', 'Compra a otro proveedor', 'Pidió volver otro día', 'Otro'];
})();
