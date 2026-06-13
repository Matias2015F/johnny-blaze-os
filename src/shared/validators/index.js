export const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
export const isFinitePositiveNumber = (value) => Number.isFinite(Number(value)) && Number(value) >= 0;
