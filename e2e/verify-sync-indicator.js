const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL  = process.env.TEST_URL      || 'http://localhost:5173';
const EMAIL     = process.env.TEST_EMAIL    || '';
const PASSWORD  = process.env.TEST_PASSWORD || '';
const SS_DIR    = path.join(__dirname, 'screenshots');

if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR, { recursive: true });

let step = 0;
async function shot(page, label) {
  step++;
  const file = path.join(SS_DIR, `sync-${String(step).padStart(2,'0')}-${label}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  [screenshot] ${path.basename(file)}`);
  return file;
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 400 });
  const ctx     = await browser.newContext({ viewport: { width: 390, height: 844 } }); // iPhone 14
  const page    = await ctx.newPage();

  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console',   m => { if (m.type() === 'error') errors.push(m.text()); });

  console.log('\n>> Abriendo app...');
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await shot(page, 'app-cargada');

  // Si no hay credenciales, detener aqui con lo que tenemos
  if (!EMAIL || !PASSWORD) {
    console.log('\n>> Sin credenciales — verificacion parcial (solo carga)');
    console.log(errors.length ? `   ERRORES JS: ${errors.join(' | ')}` : '   Sin errores JS en carga');
    await browser.close();
    return;
  }

  // Login
  console.log('\n>> Login...');
  const emailInput = page.locator('input[type="email"]');
  await emailInput.waitFor({ timeout: 10000 });
  await emailInput.fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"], button:has-text("Entrar"), button:has-text("Iniciar")').first().click();
  await shot(page, 'post-login');

  // Esperar home
  console.log('\n>> Esperando dashboard...');
  await page.waitForFunction(() =>
    document.body.innerText.toUpperCase().includes('TRABAJOS ACTIVOS') ||
    document.body.innerText.toUpperCase().includes('NUEVO INGRESO'),
    { timeout: 20000 }
  );
  await shot(page, 'home');

  // Capturar el nav bar completo
  console.log('\n>> Capturando nav bar...');
  const nav = page.locator('nav').first();
  await nav.waitFor({ timeout: 5000 });
  await shot(page, 'nav-estado-synced');

  // Verificar que el indicador existe en el DOM
  const indicadorSynced = page.locator('text=/\\d{1,2}:\\d{2}|Guardado/').first();
  const synced = await indicadorSynced.isVisible({ timeout: 3000 }).catch(() => false);
  console.log(`   Indicador synced visible: ${synced}`);

  // Verificar que NO existe el chip rojo (estado normal)
  const chipRojo = page.locator('text=/Error.*reintentar/i').first();
  const errorVisible = await chipRojo.isVisible({ timeout: 1000 }).catch(() => false);
  console.log(`   Chip rojo visible en estado normal: ${errorVisible} (esperado: false)`);

  // Trigger un cambio para provocar un sync y capturar estado "syncing"
  console.log('\n>> Provocando sync...');
  await page.locator('button:has-text("NUEVO INGRESO"), button:has-text("Nueva")').first().click().catch(() => {});
  await page.waitForTimeout(200);
  await shot(page, 'nav-estado-syncing');

  // Resumen
  console.log('\n== RESULTADO ==');
  if (errors.length) console.log(`   Errores JS: ${errors.join('\n   ')}`);
  else console.log('   Sin errores JS');

  await browser.close();
})();
