export const hoyEstable = () => new Date().toLocaleDateString("sv-SE");

export const normalizeDateMs = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
  }
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  return null;
};
