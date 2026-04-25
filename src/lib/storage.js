// Capa de persistencia: LocalStorage con sincronización por eventos
import { useState, useEffect } from "react";

const appId = "johnny-blaze-os";

export const generateId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 9);

export const LS = {
  key: (col) => `jbos_${appId}_${col}`,
  getAll: (col) => {
    try { return JSON.parse(localStorage.getItem(LS.key(col)) || "[]"); }
    catch { return []; }
  },
  save: (col, arr) => {
    localStorage.setItem(LS.key(col), JSON.stringify(arr));
    window.dispatchEvent(new CustomEvent("ls_update", { detail: col }));
  },
  addDoc: (col, data) => {
    const id = generateId();
    const arr = LS.getAll(col);
    const newDoc = { id, ...data };
    arr.push(newDoc);
    LS.save(col, arr);
    return newDoc;
  },
  updateDoc: (col, id, data) => {
    const arr = LS.getAll(col).map(d => d.id === id ? { ...d, ...data } : d);
    LS.save(col, arr);
  },
};

export function useCollection(col) {
  const [data, setData] = useState(() => LS.getAll(col));
  useEffect(() => {
    const handler = (e) => { if (e.detail === col) setData(LS.getAll(col)); };
    window.addEventListener("ls_update", handler);
    return () => window.removeEventListener("ls_update", handler);
  }, [col]);
  return data;
}
