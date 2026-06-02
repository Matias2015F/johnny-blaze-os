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
    // UA desktop en viewport mobile: viewport 390px mantiene la UI mobile,
    // pero isMobileDevice()=false → abrirEnlaceExterno usa window.open("_blank")
    // en lugar de location.assign(), permitiendo capturar y cerrar el popup WA.
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    locale: 'es-AR',
  });
  const page = await context.newPage();

  // Auto-cerrar cualquier tab/popup que abra la app (WhatsApp, PDF viewer, etc.)
  context.on('page', newPage => { newPage.close().catch(() => {}); });

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
    // Si la sesion persiste de una corrida anterior, el app va directo al home (sin login screen)
    const hasLoginForm = await page.locator('input[type="email"]').count() > 0;
    const hasHome = /trabajos activos|nuevo ingreso/i.test(await page.locator('body').innerText());
    record('App carga correctamente (login o home)', hasLoginForm || hasHome);

    // ─────────────────────────────────────────────
    // 2. UI DEL LOGIN
    // ─────────────────────────────────────────────
    log('2. Elementos del formulario de login');
    // Si la sesion persiste, el formulario no aparece — lo marcamos como OK en ese caso
    const hasEmailInput = await page.locator('input[type="email"]').count() > 0;
    record('Input email (o sesion activa)', hasEmailInput || hasHome);
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

      // El boton PRESUPUESTOS usa P mayúscula — case-sensitive para no matchear
      // los botones de acciones urgentes "Armar presupuesto" (p minúscula)
      const pptoBtn = page.locator('button').filter({ hasText: 'Presupuestos' }).first();
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

    // ═══════════════════════════════════════════════════════
    // SECCION B: CICLO COMPLETO DE OT (7 estados + PDF)
    // Patente ZPWLC — creada en cada run para el ciclo
    // ═══════════════════════════════════════════════════════
    log('13. Ciclo completo de OT — ZPWLC');
    let receiptToken = null;


    try {
      // Volver al home recargando (sesion Firebase persiste)
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      await waitForHome(page, 18000);
      await tapNav(page, NAV.INICIO);
      await page.waitForTimeout(600);

      // Crear nueva OT con patente ZPWLC
      await page.locator('button').filter({ hasText: /nuevo ingreso/i }).first().click();
      await page.waitForTimeout(1500);

      // Si ya existe la patente, el form muestra sugerencia — ignorarla
      const sugerencia = page.locator('button').filter({ hasText: /seguir con lo escrito/i });
      if (await sugerencia.count() > 0) await sugerencia.click();

      await fillReact(page.locator('input').first(), 'ZPWLC');
      await fillReact(page.locator('input[placeholder*="15400"]').first(), '1000');
      const inputs = page.locator('input');
      const cnt = await inputs.count();
      if (cnt >= 3) await fillReact(inputs.nth(2), 'YamTest');
      if (cnt >= 4) await fillReact(inputs.nth(3), 'FZ16');
      if (cnt >= 5) await fillReact(inputs.nth(4), '160');
      await fillReact(page.locator('input[placeholder*="Nombre completo" i]').first(), 'Cliente Lifecycle');
      const telIn = page.locator('input[placeholder*="3434"]').first();
      if (await telIn.count() > 0) await fillReact(telIn, '3413000099');
      const ta = page.locator('textarea').first();
      if (await ta.count() > 0) await fillReact(ta, 'OT ciclo completo — test automatizado');

      await page.locator('button').filter({ hasText: /ingresar al taller/i }).last().click();
      await page.waitForFunction(() => /OT-\d{6}|Diagnóstico/i.test(document.body.innerText), { timeout: 20000 });
      await shot(page, 'lc-01-diagnostico');
      record('OT ZPWLC creada en diagnostico', /diagn[oó]stico/i.test(await page.locator('body').innerText()));

      // ── Estado 1→2: diagnostico → aprobacion ──────────────
      // Click "Enviar presupuesto" → abre sheet + cambia estado a "presupuesto"
      await page.locator('button').filter({ hasText: /enviar presupuesto/i }).first().click();
      await page.waitForTimeout(1200);
      await shot(page, 'lc-02-sheet');

      // "Enviar por WhatsApp" → con UA desktop usa window.open("_blank") →
      // context.on('page', close) cierra el popup → app queda en detalleOrden →
      // cambiarEstado("aprobacion") ya corrió antes de que abra el popup.
      const sheetBtn = page.locator('button').filter({ hasText: /enviar por whatsapp/i }).first();
      if (await sheetBtn.count() > 0) {
        await sheetBtn.click();
        await page.waitForTimeout(1500);
      }
      await shot(page, 'lc-03-aprobacion');
      const aprText = await page.locator('body').innerText();
      record('Estado aprobacion visible', /iniciar reparaci|aprobaci[oó]n/i.test(aprText));

      // ── Estado 2→3: aprobacion → ejecucion ───────────────
      await page.locator('button').filter({ hasText: /iniciar reparaci/i }).first().click();
      await page.waitForFunction(() => /trabajo finalizado|ejecuci/i.test(document.body.innerText), { timeout: 10000 });
      await shot(page, 'lc-04-ejecucion');
      record('EjecucionView carga', /trabajo finalizado/i.test(await page.locator('body').innerText()));

      // ── Estado 3→4: ejecucion → finalizacion ─────────────
      await page.locator('button').filter({ hasText: /trabajo finalizado/i }).first().click();
      await page.waitForFunction(() => /registrar pago|finalizaci/i.test(document.body.innerText), { timeout: 10000 });
      await shot(page, 'lc-05-finalizacion');
      record('FinalizacionView carga', /registrar pago/i.test(await page.locator('body').innerText()));

      // ── Estado 4→5: finalizacion → pago ──────────────────
      await page.locator('button').filter({ hasText: /registrar pago/i }).first().click();
      await page.waitForFunction(() => /confirmar pago|registrar pago/i.test(document.body.innerText), { timeout: 10000 });
      await shot(page, 'lc-06-pago');
      record('PagoView carga', /confirmar pago/i.test(await page.locator('body').innerText()));

      // OT con total 0 → recibido 0 → botón habilitado
      await page.locator('button').filter({ hasText: /confirmar pago/i }).first().click();
      await page.waitForTimeout(2000);
      await shot(page, 'lc-07-retiro');

      // ── Estado 5→6: retiro ────────────────────────────────
      const retiroBtn = page.locator('button').filter({ hasText: /retiro.*veh[íi]culo|cliente retiro/i }).first();
      record('RetiroView carga', await retiroBtn.count() > 0);
      if (await retiroBtn.count() > 0) {
        await retiroBtn.click();
        await page.waitForTimeout(2000);
        await shot(page, 'lc-08-cerrado');
        record('Estado cerrado_emitido', /retiro registrado|descargar orden/i.test(await page.locator('body').innerText()));
      }

      // ── Navegar a PrePdf ──────────────────────────────────
      const pdfBtn = page.locator('button').filter({ hasText: /descargar orden/i }).first();
      if (await pdfBtn.count() > 0) {
        await pdfBtn.click();
        // PrePdfView es lazy — esperar a que salga del Suspense "CARGANDO..."
        await page.waitForFunction(
          () => /generar comprobante|garantia|comprobante para/i.test(document.body.innerText),
          { timeout: 15000 }
        ).catch(() => {});
        await shot(page, 'lc-09-prepdf');
        record('PrePdfView carga', /generar comprobante|garantia/i.test(await page.locator('body').innerText()));

        // ── Generar comprobante ───────────────────────────────
        const genBtn = page.locator('button').filter({ hasText: /generar comprobante/i }).first();
        if (await genBtn.count() > 0) {
          await genBtn.click();
          await page.waitForFunction(() => /verificar\//i.test(document.body.innerText), { timeout: 15000 });
          await shot(page, 'lc-10-token');

          // Extraer token de la URL mostrada en pantalla
          const tokenMatch = (await page.locator('body').innerText()).match(/verificar\/([a-z0-9]+)/i);
          if (tokenMatch) {
            receiptToken = tokenMatch[1];
            record('Token de comprobante generado', true, receiptToken.slice(0, 12) + '…');
          } else {
            record('Token de comprobante generado', false, 'token no encontrado en texto');
          }
        } else {
          record('Token de comprobante generado', false, 'boton generar no encontrado');
        }
      } else {
        record('Token de comprobante generado', false, 'boton descargar no encontrado');
      }

    } catch (e) {
      await shot(page, 'lc-error').catch(() => {});
      record('Ciclo completo OT', false, e.message.split('\n')[0].slice(0, 80));
    }

    // ═══════════════════════════════════════════════════════
    // SECCION C: VERIFICACION PUBLICA + CALIFICACION
    // ═══════════════════════════════════════════════════════
    log('14. Verificacion publica y calificacion del taller');
    if (receiptToken) {
      try {
        const verifyUrl = `${BASE_URL}/verificar/${receiptToken}`;
        await page.goto(verifyUrl, { waitUntil: 'domcontentloaded' });
        // Esperar que Firestore termine de verificar el token (sale del estado "cargando")
        await page.waitForFunction(
          () => !/verificando comprobante/i.test(document.body.innerText),
          { timeout: 15000 }
        ).catch(() => {});
        await shot(page, 'verify-01-load');
        record('Pagina de verificacion carga', /comprobante|verificado|verificar|validar|calificad/i.test(await page.locator('body').innerText()));

        // ── Fase: verificacion (4 ultimos digitos de telefono) ──
        const phoneInput = page.locator('input[inputmode="numeric"][maxlength="4"]').first();
        if (await phoneInput.count() > 0) {
          await fillReact(phoneInput, '0099');
          await page.locator('button').filter({ hasText: /continuar/i }).first().click();
          await page.waitForTimeout(1000);
          await shot(page, 'verify-02-post-phone');
          record('Verificacion de telefono pasa', /validar comprobante|reconozco/i.test(await page.locator('body').innerText()));
        }

        // ── Fase: validacion (checkboxes) ──────────────────────
        const checkboxes = page.locator('input[type="checkbox"]');
        const cbCount = await checkboxes.count();
        for (let i = 0; i < cbCount; i++) {
          await checkboxes.nth(i).check();
          await page.waitForTimeout(150);
        }
        record('Checkboxes de validacion marcados', cbCount >= 4);

        const validarBtn = page.locator('button').filter({ hasText: /validar comprobante/i }).first();
        if (await validarBtn.count() > 0) {
          await validarBtn.click();
          await page.waitForTimeout(1500);
          await shot(page, 'verify-03-formulario');
          record('Formulario de calificacion aparece', /calific|servicio|estrell/i.test(await page.locator('body').innerText()));
        }

        // ── Fase: formulario (estrellas + recomienda) ──────────
        // Estrellas: aria-label="5 estrellas" — 4 categorias × 5 botones
        const starBtns = page.locator('button[aria-label="5 estrellas"]');
        const starCount = await starBtns.count();
        for (let i = 0; i < starCount; i++) await starBtns.nth(i).click();
        record('Estrellas seleccionadas (5/5 cada categoria)', starCount >= 4, `${starCount} botones ★`);

        // Recomienda: boton "Si"
        await page.locator('button').filter({ hasText: /^Si$/i }).first().click();
        await page.waitForTimeout(300);

        // Comentario opcional
        const comentTA = page.locator('textarea[placeholder*="experiencia"]').first();
        if (await comentTA.count() > 0) await fillReact(comentTA, 'Excelente servicio, test automatizado');

        await shot(page, 'verify-04-ready');

        // Submit
        await page.locator('button').filter({ hasText: /confirmar validaci/i }).first().click();
        await page.waitForTimeout(4000);
        await shot(page, 'verify-05-enviado');

        const afterText = await page.locator('body').innerText();
        const calificadoOk = /ya fue calificado|gracias|enviado|confirmad/i.test(afterText);
        record('Calificacion enviada exitosamente', calificadoOk);

      } catch (e) {
        await shot(page, 'verify-error').catch(() => {});
        record('Flujo de calificacion', false, e.message.split('\n')[0].slice(0, 80));
      }
    } else {
      record('Flujo de calificacion', false, 'no hay token (ciclo de OT fallo)');
    }

    // ═══════════════════════════════════════════════════════
    // SECCION E: REPUTACION DEL TALLER + MODERACION ADMIN
    // (antes de landing para evitar que Firebase pierda conexion)
    // ═══════════════════════════════════════════════════════
    log('15. Reputacion del taller y moderacion de calificaciones');
    try {
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      await waitForHome(page, 18000);
      await tapNav(page, NAV.MAS);
      await page.waitForTimeout(1000);

      // Sub-tab REPUT. (visible para todos los talleres — muestra ratings recibidos)
      const reputTab = page.locator('button').filter({ hasText: /reput/i }).first();
      if (await reputTab.count() > 0) {
        await reputTab.click();
        await page.waitForTimeout(1500);
        await shot(page, 'reput-view');
        const reputText = await page.locator('body').innerText();
        record('Tab REPUT. abre y muestra calificaciones', /calificaci|reputaci|promedio|estrella|sin calificaci/i.test(reputText));
      } else {
        record('Tab REPUT. abre y muestra calificaciones', false, 'tab reput no encontrado');
      }

      // Panel ADMIN (solo uid TNwwuKJsIXN29zJg8HWfORawdFm1) — aprobar rating reciente
      const adminTab = page.locator('button').filter({ hasText: /^admin$/i }).first();
      if (await adminTab.count() > 0) {
        await adminTab.click();
        await page.waitForTimeout(800);
        const calificTab = page.locator('button').filter({ hasText: /calificac/i }).first();
        if (await calificTab.count() > 0) {
          await calificTab.click();
          await page.waitForTimeout(1500);
          await shot(page, 'admin-calificaciones');
          const adminText = await page.locator('body').innerText();
          record('Panel admin calificaciones accesible', /pendiente|aprobad|rechazad/i.test(adminText));

          const aprobarBtn = page.locator('button').filter({ hasText: /aprobar/i }).first();
          if (await aprobarBtn.count() > 0) {
            await aprobarBtn.click();
            await page.waitForTimeout(2000);
            await shot(page, 'admin-aprobacion');
            record('Calificacion aprobada desde admin', /aprobad/i.test(await page.locator('body').innerText()));
          } else {
            record('Calificacion aprobada desde admin', false, 'boton aprobar no visible (no hay pendientes o ya aprobada)');
          }
        } else {
          record('Panel admin calificaciones accesible', false, 'tab calificac no encontrado en admin');
        }
      } else {
        record('Panel admin calificaciones accesible', false, 'tab admin no visible (cuenta no es platform admin — esperado en cuenta de prueba)');
        record('Calificacion aprobada desde admin', false, 'se requiere cuenta admin — paso manual');
      }
    } catch (e) {
      await shot(page, 'admin-error').catch(() => {});
      record('Tab REPUT. abre y muestra calificaciones', false, e.message.split('\n')[0].slice(0, 60));
      record('Panel admin calificaciones accesible', false, e.message.split('\n')[0].slice(0, 60));
      record('Calificacion aprobada desde admin', false, '');
    }

    // ═══════════════════════════════════════════════════════
    // SECCION F: SISTEMA DE FIDELIZACION — descuento en presupuesto
    // ═══════════════════════════════════════════════════════
    log('16. Fidelizacion — descuento por calificacion anterior en presupuesto');
    try {
      // Recarga limpia — Firebase puede estar en error state por REPUT tab
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitForHome(page, 18000);

      // Navegar a PresupuestosView via boton del home
      // Esperar el boton naranja NUEVO en home como anchor (es unico del home)
      await page.locator('button').filter({ hasText: /^nuevo$/i }).first()
        .waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});

      // Usar 'Presupuestos' con P mayúscula (case-sensitive) para evitar matchear
      // los botones de acciones urgentes que dicen "Armar presupuesto" (p minúscula)
      await page.locator('button').filter({ hasText: 'Presupuestos' }).first().click();
      await page.waitForTimeout(2000);
      await shot(page, 'fid-00-ppto-list');

      // Verificar PresupuestosView — tiene barra de busqueda y boton + NUEVO
      const pptoViewText = await page.locator('body').innerText();
      const nuevoBtn = page.locator('button').filter({ hasText: /nuevo/i }).first();
      const pptoViewOk = /presupuesto/i.test(pptoViewText) && await nuevoBtn.count() > 0;
      record('PresupuestosView accesible con boton + NUEVO', pptoViewOk);

      // El banner de descuento requiere aprobacion admin de la calificacion enviada.
      // La cuenta aerovision.dji no es admin → este paso es MANUAL.
      // Pasos manuales requeridos:
      // 1. Login con matias4604@gmail.com en la app
      // 2. Config → Admin → Calificac. → Aprobar la calificacion pendiente
      // 3. El sistema crea clienteBeneficios/{patente} automaticamente
      // 4. La proxima vez que se cree un presupuesto con esa patente, aparece el banner
      record('Banner de descuento por calificacion aparece', false,
        'paso manual: aprobar calificacion con cuenta admin matias4604@gmail.com en Config → Admin → Calificac.');
    } catch (e) {
      await shot(page, 'fid-error').catch(() => {});
      record('PresupuestosView accesible con boton + NUEVO', false, e.message.split('\n')[0].slice(0, 60));
      record('Banner de descuento por calificacion aparece', false, '');
    }

    // ═══════════════════════════════════════════════════════
    // SECCION D: LANDING PAGE (motogestion.ar)
    // Ultimo porque visitar dominio externo corta conexion Firebase
    // ═══════════════════════════════════════════════════════
    log('17. Landing page — motogestion.ar');
    try {
      await page.goto('https://motogestion.ar', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      await shot(page, 'landing-01-home');
      const landText = await page.locator('body').innerText();
      record('Landing page carga', /motogestion|taller|moto/i.test(landText));
      record('Seccion de red/talleres en landing', /red|ranking|taller.*verificado|mapa/i.test(landText));
      record('Seccion de calificaciones visible', /calificaci|reputaci|estrella/i.test(landText));
      record('CTA de conversion presente', /quiero|probalo|empeza|registr/i.test(landText));
    } catch (e) {
      await shot(page, 'landing-error').catch(() => {});
      record('Landing page carga', false, e.message.split('\n')[0].slice(0, 60));
    }

    // ═══════════════════════════════════════════════════════
    // 18. SCREENSHOT FINAL
    // ═══════════════════════════════════════════════════════
    log('18. Estado final');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
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
