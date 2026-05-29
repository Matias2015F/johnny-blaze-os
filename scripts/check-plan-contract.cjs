const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const checks = [
  {
    file: "api/mp-create-preference.js",
    required: [
      'base: { label: "Mensual"',
      'pro:  { label: "Trimestral"',
      'full: { label: "Anual"',
      'PLANES_FALLBACK[plan]',
      'metadata: { uid, plan }',
    ],
  },
  {
    file: "api/mp-webhook.js",
    required: [
      "const PLAN_BILLING_DAYS = { base: 30, pro: 90, full: 365 }",
      "normalizePlanKey(planPagado)",
      "currentPlanKey: nuevoPlan",
      "requestedPlanKey = FieldValue.delete()",
      "planDurations?.[planKey]",
    ],
  },
  {
    file: "api/verify-document.js",
    required: [
      "Vercel-CDN-Cache-Control",
      "no-store",
      "base:     Number(precios.base",
      "pro:      Number(precios.pro",
      "full:     Number(precios.full",
    ],
  },
  {
    file: "src/services/saasService.js",
    required: [
      "base: PLAN_BILLING_DAYS.base",
      "pro: PLAN_BILLING_DAYS.pro",
      "full: PLAN_BILLING_DAYS.full",
      'plan === "full"',
    ],
  },
  {
    file: "src/views/ConfigView.jsx",
    required: [
      'abrirConfirmacionPago("base")',
      'abrirConfirmacionPago("pro")',
      'abrirConfirmacionPago("full")',
      'Activar Anual',
      'full: "Anual"',
    ],
  },
];

const failures = [];

for (const check of checks) {
  const content = read(check.file);
  for (const token of check.required) {
    if (!content.includes(token)) {
      failures.push(`${check.file}: falta "${token}"`);
    }
  }
}

if (failures.length) {
  console.error("Contrato de planes roto. No se puede buildear/desplegar.");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Contrato de planes OK: Mensual/base, Trimestral/pro y Anual/full protegidos.");
