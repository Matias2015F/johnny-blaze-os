export const formatMoney = (monto) =>
  `$${Math.round(monto || 0).toLocaleString("es-AR")}`;

export const formatMoneyInput = (val) => {
  if (val === "" || val === 0 || val === "0") return "";
  const clean = String(val).replace(/\D/g, "");
  return clean ? Number(clean).toLocaleString("es-AR") : "";
};

export const formatQtyInput = (val) => {
  if (val === "" || val === 0 || val === "0") return "";
  return String(val).replace(/\D/g, "");
};

// Soporta formato argentino con puntos de miles y coma decimal
export const parseMonto = (valor) => {
  if (typeof valor === "number") return valor;
  if (!valor) return 0;
  const limpio = valor.toString().replace(/\./g, "").replace(",", ".");
  const n = parseFloat(limpio);
  return isNaN(n) ? 0 : n;
};
