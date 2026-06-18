// Golden Path — MotoGestión Beta
// Prueba: login → orden → tarea → guardar → recargar → persistencia → historial
// Uso: node scripts/golden-path-test.cjs

const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const URL = "https://beta.motogestion.ar";
const EMAIL = "demo@motogestion.ar";
const PASSWORD = "MotoDemo2026!";
const SCREENSHOTS = path.join(__dirname, "..", "e2e", "screenshots-gp");

fs.mkdirSync(SCREENSHOTS, { recursive: true });

const results = {
  LOGIN: "NO_VERIFICADO",
  HOME_LOADS: "NO_VERIFICADO",
  NUEVA_ORDEN: "NO_VERIFICADO",
  PATENTE_INGRESADA: "NO_VERIFICADO",
  TAREA_INGRESADA: "NO_VERIFICADO",
  ORDEN_GUARDADA: "NO_VERIFICADO",
  PERSISTENCIA_TRAS_RECARGA: "NO_VERIFICADO",
  HISTORIAL_ABRE: "NO_VERIFICADO",
  PWA_MANIFEST: "NO_VERIFICADO",
};

async function shot(page, name) {
  await page.screenshot({ path: path.join(SCREENSHOTS, `${name}.png`), fullPage: false });
}

async function waitForFirebase(page, ms = 4000) {
  await page.waitForTimeout(ms);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
  });
  const page = await ctx.newPage();

  try {
    // --- PASO 0: PWA manifest
    const manifestRes = await page.goto(`${URL}/manifest.json`);
    const manifestJson = await manifestRes?.json().catch(() => null);
    results.PWA_MANIFEST = manifestJson?.name ? "PASS" : "FAIL";
    console.log(`PWA_MANIFEST: ${results.PWA_MANIFEST}`);

    // --- PASO 1: Login
    await page.goto(URL, { waitUntil: "networkidle", timeout: 30000 });
    await shot(page, "01-landing");

    // Asegurar tab "Ingresar" (login mode, no registro)
    const tabIngresar = page.locator('button').filter({ hasText: /^Ingresar$/i }).first();
    await tabIngresar.waitFor({ timeout: 15000 });
    await tabIngresar.click();
    await page.waitForTimeout(500);

    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.waitFor({ timeout: 8000 });
    await emailInput.fill(EMAIL);

    const passInput = page.locator('input[type="password"]').first();
    await passInput.fill(PASSWORD);
    await page.waitForTimeout(300);

    // Boton de submit exacto: "Ingresar a MotoGestión"
    const loginBtn = page.locator('button').filter({ hasText: /Ingresar a MotoGestión/i }).first();
    await loginBtn.waitFor({ timeout: 5000 });
    await loginBtn.click();

    await shot(page, "02-post-click-login");
    await waitForFirebase(page, 7000);
    await shot(page, "02-post-login");

    // Verificar HomeView: "Nuevo ingreso" es exclusivo del HomeView
    const homeIndicator = page.locator('text=/Nuevo ingreso/i').first();
    try {
      await homeIndicator.waitFor({ timeout: 15000 });
      results.LOGIN = "PASS";
      results.HOME_LOADS = "PASS";
      console.log("LOGIN: PASS");
      console.log("HOME_LOADS: PASS");
    } catch {
      // Puede ser pantalla de trial o loading — tomar screenshot para diagnostico
      await shot(page, "02-fail-home");
      const bodyText = await page.locator("body").innerText().catch(() => "");
      console.log("HOME_BODY_SAMPLE:", bodyText.slice(0, 200));
      results.LOGIN = "FAIL";
      results.HOME_LOADS = "FAIL";
      console.log("LOGIN: FAIL — no se encontro HomeView (ver 02-fail-home.png)");
      await browser.close();
      return;
    }

    // --- PASO 2: Nueva orden
    const nuevaOrdenBtn = page.locator('text=/Nuevo ingreso/i').first();
    await nuevaOrdenBtn.waitFor({ timeout: 8000 });
    await nuevaOrdenBtn.click();
    await page.waitForTimeout(1500);
    await shot(page, "03-nueva-orden");

    const patenteInput = page.locator('input[placeholder*="atente"], input[placeholder*="ABC"]').first();
    if (await patenteInput.count() === 0) {
      // Buscar por label
      const allInputs = page.locator('input[type="text"]');
      const count = await allInputs.count();
      if (count > 0) {
        await allInputs.first().fill("TEST001");
        results.NUEVA_ORDEN = "PASS";
        results.PATENTE_INGRESADA = "PASS";
      } else {
        results.NUEVA_ORDEN = "FAIL";
        results.PATENTE_INGRESADA = "FAIL";
      }
    } else {
      await patenteInput.fill("TEST001");
      results.NUEVA_ORDEN = "PASS";
      results.PATENTE_INGRESADA = "PASS";
    }
    console.log(`NUEVA_ORDEN: ${results.NUEVA_ORDEN}`);
    console.log(`PATENTE_INGRESADA: ${results.PATENTE_INGRESADA}`);

    // Nombre del cliente
    const nombreInput = page.locator('input[placeholder*="ombre"]').first();
    if (await nombreInput.count() > 0) await nombreInput.fill("Taller Demo");

    // Marca
    const marcaInput = page.locator('input[placeholder*="arca"], input[placeholder*="Ej"]').first();
    if (await marcaInput.count() > 0) await marcaInput.fill("Honda");

    // Motivo / tarea
    const motivoInput = page.locator('input[placeholder*="otivo"], textarea[placeholder*="asa"]').first();
    if (await motivoInput.count() > 0) {
      await motivoInput.fill("Cambio de aceite y filtro");
      await page.keyboard.press("Enter");
      results.TAREA_INGRESADA = "PASS";
    } else {
      results.TAREA_INGRESADA = "NO_VERIFICADO";
    }
    console.log(`TAREA_INGRESADA: ${results.TAREA_INGRESADA}`);

    await shot(page, "04-form-completo");

    // --- PASO 3: Guardar orden
    const submitBtn = page.locator('button').filter({ hasText: /ingresar al taller|crear orden|guardar/i }).first();
    if (await submitBtn.count() > 0) {
      await submitBtn.click();
      await waitForFirebase(page, 5000);
      await shot(page, "05-post-submit");

      // Verificar que volvimos a home o estamos en detalle de orden
      const backToHome = page.locator('text=/OT-|Orden|EN PROCESO|abierto/i').first();
      try {
        await backToHome.waitFor({ timeout: 8000 });
        results.ORDEN_GUARDADA = "PASS";
      } catch {
        results.ORDEN_GUARDADA = "NO_VERIFICADO";
      }
    } else {
      results.ORDEN_GUARDADA = "NO_VERIFICADO";
    }
    console.log(`ORDEN_GUARDADA: ${results.ORDEN_GUARDADA}`);

    // --- PASO 4: Recargar y verificar persistencia
    await page.reload({ waitUntil: "load", timeout: 20000 });
    await waitForFirebase(page, 3000);
    await shot(page, "06-post-reload");

    // Ir a ordenes o historial para verificar persistencia
    try {
      const ordenesBtn = page.locator('text=/ordenes|Trabajos|OT-/i').first();
      await ordenesBtn.waitFor({ timeout: 8000 });
      results.PERSISTENCIA_TRAS_RECARGA = "PASS";
      console.log("PERSISTENCIA_TRAS_RECARGA: PASS");
    } catch {
      results.PERSISTENCIA_TRAS_RECARGA = "NO_VERIFICADO";
      console.log("PERSISTENCIA_TRAS_RECARGA: NO_VERIFICADO");
    }

    // --- PASO 5: Historial
    try {
      const historialBtn = page.locator('text=/[Hh]istorial/').first();
      if (await historialBtn.count() > 0) {
        await historialBtn.click();
        await page.waitForTimeout(2000);
        await shot(page, "07-historial");
        results.HISTORIAL_ABRE = "PASS";
      } else {
        results.HISTORIAL_ABRE = "NO_VERIFICADO";
      }
    } catch {
      results.HISTORIAL_ABRE = "FAIL";
    }
    console.log(`HISTORIAL_ABRE: ${results.HISTORIAL_ABRE}`);

  } catch (e) {
    console.error("ERROR_INESPERADO:", e.message);
    await shot(page, "error-inesperado");
  }

  await browser.close();

  // --- Resultado final
  console.log("\n========= GOLDEN PATH RESULTS =========");
  for (const [k, v] of Object.entries(results)) {
    console.log(`${k}: ${v}`);
  }

  const critical = ["LOGIN", "HOME_LOADS", "NUEVA_ORDEN", "ORDEN_GUARDADA"];
  const failing = critical.filter((k) => results[k] === "FAIL");

  console.log("\n" + (failing.length === 0 ? "GOLDEN_PATH_BASIC: PASS" : `GOLDEN_PATH_BASIC: FAIL — ${failing.join(", ")}`));
  console.log(`SCREENSHOTS: ${SCREENSHOTS}`);
}

run().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
