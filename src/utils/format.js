// 🇦🇷 Formateadores argentinos — utilidades puras de formato numérico

export const formatMoney = (monto) =>
  `$ ${Math.round(monto || 0).toLocaleString("es-AR")}`;

export const formatMoneyInput = (val) => {
  if (val === "" || val === 0 || val === "0") return "";
  const clean = String(val).replace(/\D/g, "");
  return clean ? Number(clean).toLocaleString("es-AR") : "";
};

export const formatQtyInput = (val) => {
  if (val === "" || val === 0 || val === "0") return "";
  return String(val).replace(/\D/g, "");
};

export const parseMonto = (val) => {
  const clean = String(val).replace(/\./g, "");
  return clean === "" ? "" : Number(clean);
};
