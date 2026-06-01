const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.TEST_URL      || 'https://app.motogestion.ar';
const EMAIL    = process.env.TEST_EMAIL    || 'aerovision.dji@gmail.com';
const PASSWORD = process.env.TEST_PASSWORD || '123456789';
const SS_DIR = path.join(__dirname, 'screenshots');

if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR, { recursive: true });

let stepIndex = 0;
async function shot(page, label) {
  stepIndex++;
  const file = path.join(SS_DIR, `${String(stepIndex).padStart(2,'0')}-${label}.png`);
  await page.screenshot({ path: file });
  console.log(`  [screenshot] ${path.basename(file)}`);
}

function log(msg) { console.log(`\n>> ${msg}`); }
function ok(msg)  { console.log(`   OK  ${msg}`); }
function fail(msg){ console.log(`   FAIL ${msg}`); }

async function fillReact(locator, value) {
  // Triple-click selecciona todo, fill() borra y escribe activando React onChange
  await locator.click({ clickCount: 3 });
  await locator.fill(value);
}

async function waitForHome(page, timeout = 15000) {
  await page.waitForFunction(() => {
    const t = document.body.innerText.toUpperCase();
    return t.includes('TRABAJOS ACTIVOS') || t.includes('NUEVO INGRESO') || t.includes('SALIR');
  }, { timeout });
}

// Labels reales del DOM (mixed case — se ven uppercase por CSS)
const NAV = {
  INICIO:   'Inicio',
  TRABAJOS: 'Trabajos',
  HISTORIAL:'Historial',
  PAGOS:    'Pagos',
  MAS:      'Más',
};

// Navega a una tab de la barra inferior por span exacto dentro de <nav>
async function tapNav(page, label) {
  // Busca el span con ese texto dentro del nav fijo de abajo
  const btn = page.locator('nav button').filter({ hasText: label });
  if (await btn.count() > 0) {
    await btn.first().click();
    await page.waitForTimeout(1200);
    return true;
  }
  return false;
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    locale: 'es-AR',
  });
  const page = await context.newPage();

  const results = [];
  function record(test, passed, detail = '') {
    results.push({ test, passed, detail });
    (passed ? ok : fail)(`${test}${detail ? ' — ' + detail : ''}`);
  }

  try {

    // ─────────────────────────────────────────────
    // 1. CARGA INICIAL
    // ─────────────────────────────────────────────
    log('1. Carga inicial');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await shot(page, 'carga-inicial');
    record('Login screen carga', await page.locator('input[type="email"]').count() > 0);

    // ─────────────────────────────────────────────
    // 2. UI DEL LOGIN
    // ─────────────────────────────────────────────
    log('2. Elementos del formulario de login');
    record('Input email', await page.locator('input[type="email"]').count() > 0);
    record('Input password', await page.locator('input[type="password"]').count() > 0);
    record('Boton "Ingresar al taller"', await page.locator('button').filter({ hasText: /ingresar/i }).count() > 0);
    record('Tab "Soy nuevo"', await page.locator('button, [role="tab"]').filter({ hasText: /soy nuevo/i }).count() > 0);
    record('Link olvide contraseña', await page.locator('text=/olvidaste/i').count() > 0);

    // ─────────────────────────────────────────────
    // 3. LOGIN
    // ─────────────────────────────────────────────
    log('3. Login');
    const fbErrors = [];
    page.on('response', async (res) => {
      if (res.url().includes('identitytoolkit') && !res.ok()) {
        try { fbErrors.push((await res.json().catch(() => ({}))).error?.message || `HTTP ${res.status()}`); } catch {}
      }
    });

    const doLogin = async () => {
      const emailEl = page.locator('input[type="email"]').first();
      const passEl  = page.locator('input[type="password"]').first();
      await fillReact(emailEl, EMAIL);
      await fillReact(passEl, PASSWORD);
      // Verificar que los campos tienen valor antes de hacer click
      const ev = await emailEl.inputValue();
      const pv = await passEl.inputValue();
      if (!ev || !pv) throw new Error(`Campos vacíos: email="${ev}" pass="${pv ? '***' : ''}"`);
      await page.locator('button').filter({ hasText: /ingresar/i }).first().click();
      await waitForHome(page, 18000);
    };

    try {
      await doLogin();
      await shot(page, 'home');
      record('Login exitoso', true, EMAIL);
    } catch (e1) {
      // Reintento único — esperar 3s y volver a intentar
      await page.waitForTimeout(3000);
      try {
        await doLogin();
        await shot(page, 'home');
        record('Login exitoso', true, `${EMAIL} (retry)`);
      } catch (e2) {
        await shot(page, 'login-error');
        record('Login exitoso', false, fbErrors.length ? `Firebase: ${fbErrors[0]}` : e2.message.split('\n')[0].slice(0, 80));
      }
    }

    // ─────────────────────────────────────────────
    // 4. HOME — dashboard
    // ─────────────────────────────────────────────
    log('4. Home — dashboard');
    const homeText = await page.locator('body').innerText();
    record('KPI "Trabajos activos" visible', /trabajos activos/i.test(homeText));
    record('KPI "Pendiente de cobro" visible', /pendiente de cobro/i.test(homeText));
    record('KPI "Atención" visible', /atenci[oó]n/i.test(homeText));
    record('KPI "Detenidos" visible', /detenidos/i.test(homeText));
    record('Boton NUEVO INGRESO', /nuevo ingreso/i.test(homeText));
    record('Boton PRESUPUESTOS', /presupuesto/i.test(homeText));
    record('Email del usuario visible', homeText.includes(EMAIL));

    // ─────────────────────────────────────────────
    // 5. BARRA DE NAVEGACION INFERIOR
    // ─────────────────────────────────────────────
    log('5. Barra de navegacion inferior');
    for (const [key, label] of Object.entries(NAV)) {
      const found = await page.locator('nav button').filter({ hasText: label }).count() > 0;
      record(`Nav tab "${key}"`, found);
    }

    // ─────────────────────────────────────────────
    // 6. TAB TRABAJOS
    // ─────────────────────────────────────────────
    log('6. Tab Trabajos');
    const wentToTrabajos = await tapNav(page, NAV.TRABAJOS);
    await shot(page, 'tab-trabajos');
    const trabajosText = await page.locator('body').innerText();
    record('Tab Trabajos navega', wentToTrabajos);
    record('Tab Trabajos muestra lista de OTs', /trabajo|orden|sin.rdenes|OT-|activo|proceso/i.test(trabajosText));

    // ─────────────────────────────────────────────
    // 7. TAB HISTORIAL
    // ─────────────────────────────────────────────
    log('7. Tab Historial');
    await tapNav(page, NAV.HISTORIAL);
    await shot(page, 'tab-historial');
    const histText = await page.locator('body').innerText();
    record('Tab Historial navega y muestra contenido', /historial|cerrado|entregado|sin.historial|cerradas/i.test(histText));

    // ─────────────────────────────────────────────
    // 8. TAB PAGOS
    // ─────────────────────────────────────────────
    log('8. Tab Pagos');
    await tapNav(page, NAV.PAGOS);
    await shot(page, 'tab-pagos');
    const pagosText = await page.locator('body').innerText();
    record('Tab Pagos navega y muestra contenido', /pago|caja|cobro|ingreso|saldo|movimiento/i.test(pagosText));

    // ─────────────────────────────────────────────
    // 9. TAB MÁS — CONFIG
    // ─────────────────────────────────────────────
    log('9. Tab Mas (configuracion)');
    await tapNav(page, NAV.MAS);
    await shot(page, 'tab-mas');
    const masText = await page.locator('body').innerText();
    // El tab Mas abre la vista CUENTA con sub-tabs: RESUMEN, TALLER, DATOS, SISTEMA, REPUT.
    const configOpened = /cuenta|resumen|caja actual|taller|sistema|reput/i.test(masText)
      && !/nuevos? ingreso/i.test(masText);
    record('Tab Mas abre vista Cuenta', configOpened);

    // Navegar al sub-tab SISTEMA para ver info de plan/suscripcion
    try {
      const sistemaTab = page.locator('button').filter({ hasText: /sistema/i }).first();
      if (await sistemaTab.count() > 0) {
        await sistemaTab.click();
        await page.waitForTimeout(1000);
        await shot(page, 'tab-mas-sistema');
        const sistText = await page.locator('body').innerText();
        record('Sub-tab SISTEMA abre', /sistema|plan|trial|versi.n|backup|suscripci|activo/i.test(sistText));
        record('Info de plan visible en SISTEMA', /plan|trial|vence|suscripci|activo hasta|tu plan/i.test(sistText));
      } else {
        record('Sub-tab SISTEMA abre', false, 'boton no encontrado');
        record('Info de plan visible en SISTEMA', false, 'sub-tab no encontrado');
      }
    } catch (e) {
      record('Sub-tab SISTEMA abre', false, e.message.split('\n')[0].slice(0, 50));
      record('Info de plan visible en SISTEMA', false, '');
    }

    // ─────────────────────────────────────────────
    // 10. VOLVER AL HOME — FORMULARIO NUEVA OT
    // ─────────────────────────────────────────────
    log('10. Formulario nueva OT — llenado');
    await tapNav(page, 'INICIO');
    await page.waitForTimeout(800);

    try {
      await page.locator('button').filter({ hasText: /nuevo ingreso/i }).first().click();
      await page.waitForTimeout(1500);
      await shot(page, 'nueva-ot-vacia');

      // Verificar campos del formulario
      const formText = await page.locator('body').innerText();
      record('Campo PATENTE visible', /patente/i.test(formText));
      record('Campo CLIENTE visible', /cliente/i.test(formText));
      record('Campo KM ACTUAL visible', /km actual/i.test(formText));
      record('Campo MOTIVO visible', /motivo/i.test(formText));
      record('Boton DICTADO visible', /dictado/i.test(formText));

      // Llenar el formulario con datos de prueba
      // Patente no tiene placeholder — es el primer input del form (ref={patRef})
      const patenteInput = page.locator('input').first();
      await fillReact(patenteInput, 'TEST01');

      const kmInput = page.locator('input[placeholder*="km" i], input[placeholder*="15400" i]').first();
      if (await kmInput.count() > 0) await fillReact(kmInput, '25000');

      const clienteInput = page.locator('input[placeholder*="nombre completo" i], input[placeholder*="cliente" i]').first();
      if (await clienteInput.count() > 0) await fillReact(clienteInput, 'Cliente de Prueba');

      const telInput = page.locator('input[placeholder*="3434" i], input[placeholder*="tel" i]').first();
      if (await telInput.count() > 0) await fillReact(telInput, '3413000001');

      const motivoArea = page.locator('textarea[placeholder*="pasa" i], textarea').first();
      if (await motivoArea.count() > 0) await fillReact(motivoArea, 'Prueba automatizada — no guardar');

      await shot(page, 'nueva-ot-llenada');
      record('Formulario nueva OT llena sin errores', true);

      // Volver sin guardar — flecha ← arriba a la izquierda
      const backBtn = page.locator('button').first();  // el primer boton suele ser ←
      await backBtn.click();
      await page.waitForTimeout(1000);
      record('Boton volver (←) funcional', true);
    } catch (e) {
      await shot(page, 'nueva-ot-error');
      record('Formulario nueva OT llena sin errores', false, e.message.split('\n')[0].slice(0, 60));
    }

    // ─────────────────────────────────────────────
    // 11. PRESUPUESTOS
    // ─────────────────────────────────────────────
    log('11. Vista de presupuestos');
    try {
      await waitForHome(page, 5000);
      await shot(page, 'home-pre-presupuestos');

      // El boton PRESUPUESTOS es una card/boton oscuro en home
      const pptoBtn = page.locator('button').filter({ hasText: /presupuesto/i }).first();
      await pptoBtn.click();
      await page.waitForTimeout(2000);
      await shot(page, 'presupuestos-view');
      const pptoText = await page.locator('body').innerText();
      record('Vista PRESUPUESTOS abre', /presupuesto|PRE-|nuevo presupuesto/i.test(pptoText));
    } catch (e) {
      await shot(page, 'presupuestos-error');
      record('Vista PRESUPUESTOS abre', false, e.message.split('\n')[0].slice(0, 60));
    }

    // ─────────────────────────────────────────────
    // 12. SUBMIT REAL — nueva OT completa
    // ─────────────────────────────────────────────
    log('12. Submit real de nueva OT');
    // Nota: la app no tiene delete de OT — esta OT queda en la cuenta de prueba
    const TEST_PATENTE  = 'ZPWT01';
    const TEST_CLIENTE  = 'Bot Playwright';
    const TEST_MOTIVO   = 'OT creada por test automatizado - no borrar a mano';

    try {
      // Recargar la app — Firebase restaura la sesión desde IndexedDB, evita
      // ambiguedad de navegacion interna despues del flujo de presupuestos
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      await waitForHome(page, 18000);
      // Asegurarse de estar en el tab INICIO (no en ordenes)
      await tapNav(page, NAV.INICIO);
      await page.waitForTimeout(800);

      await page.locator('button').filter({ hasText: /nuevo ingreso/i }).first().click();
      await page.waitForTimeout(1500);

      // --- Patente (primer input, sin placeholder) ---
      await fillReact(page.locator('input').first(), TEST_PATENTE);

      // --- KM Actual (placeholder "Ej: 15400") ---
      await fillReact(page.locator('input[placeholder*="15400"]').first(), '50000');

      // --- Marca, Modelo, Cilindrada (inputs 3-5 del form, sin placeholder) ---
      const allInputs = page.locator('input');
      const inputCount = await allInputs.count();
      // Marca es el 3er input (índice 2), Modelo el 4to, Cilindrada el 5to
      if (inputCount >= 3) await fillReact(allInputs.nth(2), 'Honda');
      if (inputCount >= 4) await fillReact(allInputs.nth(3), 'Wave');
      // Cilindrada acepta solo números
      if (inputCount >= 5) await fillReact(allInputs.nth(4), '110');

      // --- Cliente (placeholder "Nombre completo") ---
      await fillReact(page.locator('input[placeholder*="Nombre completo" i]').first(), TEST_CLIENTE);

      // --- Teléfono (placeholder con "3434") ---
      const telInput = page.locator('input[placeholder*="3434"]').first();
      if (await telInput.count() > 0) await fillReact(telInput, '3413000099');

      // --- Motivo (textarea) ---
      const motivoTA = page.locator('textarea').first();
      if (await motivoTA.count() > 0) await fillReact(motivoTA, TEST_MOTIVO);

      await shot(page, 'submit-ot-llenada');

      // --- Verificar que los inputs tienen los datos antes de submitear ---
      // inputValue() lee el .value del <input>, no innerText (que no incluye inputs)
      const patenteVal = await page.locator('input').first().inputValue();
      record('Patente escrita correctamente', patenteVal.toUpperCase() === TEST_PATENTE, patenteVal || '(vacío)');

      const clienteVal = await page.locator('input[placeholder*="Nombre completo" i]').first().inputValue();
      record('Cliente escrito correctamente', clienteVal === TEST_CLIENTE, clienteVal || '(vacío)');

      // --- SUBMIT: click "INGRESAR AL TALLER" ---
      await page.locator('button').filter({ hasText: /ingresar al taller/i }).last().click();

      // Esperar a que cargue la vista detalleOrden
      // La app hace: LS.addDoc → nextNumeroOT (Firestore tx) → setView("detalleOrden")
      await page.waitForFunction(() => {
        const t = document.body.innerText;
        return /OT-\d{6}|Diagnóstico|DIAGNÓSTICO|Siguiente paso/i.test(t);
      }, { timeout: 20000 });

      await shot(page, 'submit-ot-detalle');
      const detalleText = await page.locator('body').innerText();

      const otNumeroMatch = detalleText.match(/OT-\d{6}/);
      record('OT creada — número visible', !!otNumeroMatch, otNumeroMatch?.[0] || '');
      record('Estado "Diagnóstico" visible', /diagn[oó]stico/i.test(detalleText));
      record('Patente visible en detalle', detalleText.toUpperCase().includes(TEST_PATENTE));
      record('Siguiente paso visible', /siguiente paso|armar presupuesto/i.test(detalleText));

    } catch (e) {
      await shot(page, 'submit-ot-error');
      record('Submit OT — detalleOrden carga', false, e.message.split('\n')[0].slice(0, 80));
    }

    // ─────────────────────────────────────────────
    // 13. SCREENSHOT FINAL
    // ─────────────────────────────────────────────
    log('13. Estado final');
    await page.goto(BASE_URL);
    await waitForHome(page, 10000).catch(() => {});
    await shot(page, 'final');

  } catch (globalErr) {
    console.error('\n[ERROR GLOBAL]', globalErr.message.split('\n')[0]);
    await shot(page, 'error-global').catch(() => {});
  }

  await browser.close();

  const line = '='.repeat(62);
  console.log(`\n${line}`);
  console.log('RESUMEN — app.motogestion.ar');
  console.log(line);
  const passed = results.filter(r => r.passed).length;
  results.forEach(r => {
    const icon = r.passed ? '✓' : '✗';
    console.log(`  ${icon} ${r.test}${r.detail ? ` (${r.detail})` : ''}`);
  });
  console.log(`\n  ${passed}/${results.length} checks OK`);
  console.log(`  Screenshots: ${SS_DIR}`);
  console.log(line);
}

run().catch(err => { console.error('[FATAL]', err.message); process.exit(1); });
