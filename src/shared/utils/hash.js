export function generarHashSimple(str) {
  let hash = 0;
  if (!str || str.length === 0) return "00000000";

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  return Math.abs(hash).toString(16).padStart(8, "0");
}
