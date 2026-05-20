import { LS, DATA_COLS } from "./storage.js";
import { buildDataIntegrityReport } from "./integrity.js";

export function runIntegrityCheckFromCache() {
  const data = {};
  for (const col of DATA_COLS) {
    data[col] = LS.getAll(col);
  }
  return buildDataIntegrityReport(data);
}

export function logIntegrityCheckFromCache() {
  const report = runIntegrityCheckFromCache();
  console.table(report.counts);
  if (report.warnings.length) console.warn("Integrity warnings:", report.warnings);
  if (report.errors.length) console.error("Integrity errors:", report.errors);
  return report;
}
