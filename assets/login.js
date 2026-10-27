// Pantalla de acceso compartida. rol: 'admin' | 'vendedor'
NB.requireLogin = async function (rol, root, titulo) {
  await NB.data.init(rol);
  let u = await NB.data.session().catch(() => null);
  if (u && (u.rol === rol)) return u;
  return new Promise(async ok => {
    const demo = NB.data.demo;
    const usuarios = demo ? (await NB.data.usuariosDemo()).filter(x => x.rol === rol) : [];
    root.innerHTML = `<div class="login"><div class="box">
      <div class="logo">NUTRI<b>BITES</b></div>
      <p class="sub">${NB.esc(titulo)}</p>
      <span class="ribbon">${rol === 'admin' ? 'Acceso del dueño' : 'Acceso del vendedor'}</span>
      ${u && u.rol !== rol ? `<div class="demo-tag">Esta cuenta no tiene permiso para este panel.</div>` : ''}
      ${demo ? `<div class="demo-tag">Modo demo: datos de ejemplo guardados en este navegador. Elige un usuario.</div>
        ${usuarios.map(x => `<button class="userpick" data-id="${x.id}"><span class="avatar" style="--c:${x.color}">${NB.iniciales(x.nombre)}</span><span><b>${NB.esc(x.nombre)}</b><br><span style="color:var(--mu);font-size:12px">${x.rol === 'admin' ? 'Administrador' : 'Vendedor'}</span></span></button>`).join('')}`
      : `<form id="lf"><label class="f">Correo</label><input class="in" type="email" name="e" required autocomplete="username">
          <label class="f">Contraseña</label><input class="in" type="password" name="p" required autocomplete="current-password">
          <p id="le" style="color:#ff7a7e;margin-top:10px;min-height:18px"></p>
          <button class="btn pri block" style="margin-top:6px">Entrar</button></form>`}
    </div></div>`;
    root.querySelectorAll('.userpick').forEach(b => b.onclick = async () => { await NB.data.loginDemo(b.dataset.id); ok(await NB.data.session()); });
    const f = root.querySelector('#lf');
    if (f) f.onsubmit = async e => {
      e.preventDefault(); const le = root.querySelector('#le'); le.textContent = '';
      try {
        await NB.data.login(f.e.value.trim(), f.p.value);
        const s = await NB.data.session();
        if (!s || s.rol !== rol) { await NB.data.logout(); le.textContent = 'Esta cuenta no tiene permiso para este panel.'; return; }
        ok(s);
      } catch (err) { le.textContent = 'Correo o contraseña incorrectos.'; }
    };
  });
};
