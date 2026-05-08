export const formatMoneyParts = (monto) => {
  const value = Number(monto || 0);
  const abs = Math.abs(value).toFixed(2);
  const [pesosRaw, centavosRaw] = abs.split(".");
  return {
    sign: value < 0 ? "-" : "",
    pesos: Number(pesosRaw).toLocaleString("es-AR"),
    centavos: centavosRaw || "00",
    formatted: `ARS ${new Intl.NumberFormat("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)}`,
  };
};

export const formatMoney = (monto) => formatMoneyParts(monto).formatted;

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
