# Directiva: useTallerConfig — extracción de PantallaTaller

## Componente origen

`PantallaTaller` en `src/views/ConfigView.jsx` (líneas ~157-602)

## Criterio de éxito

- `src/hooks/useTallerConfig.js` contiene lógica de dominio: cálculos de precio, persistencia LS, escrituras Firestore
- `PantallaTaller` retiene: UI state (`editUbicacion`, `draftLatLng`), effects de UI, todos los onChange simples, JSX
- Build pasa sin errores

## Frontera exacta

### Va al hook

| Qué | Por qué |
|---|---|
| `margen = cfg.margenPolitica ?? 25` | derivación de dominio |
| `horaCliente = Math.round(...)` | cálculo de precio cliente |
| `setPrecioConfig(newCfg)` | computa `valorHoraCliente` + escribe LS |
| `guardar()` — sin `showToast` | escribe LS + 2 `setDoc` Firestore; vista hace el toast |
| `setFactor(key, val)` | validación de factor + llama setPrecioConfig |

Hook recibe `{ cfg, setCfg }` como parámetros porque `cfg` vive en el padre `ConfigView`.

### Queda en la vista

| Qué | Por qué |
|---|---|
| `editUbicacion`, `draftLatLng` | UI state del editor de mapa |
| `useEffect` para sync draftLatLng | efecto de UI puro |
| `useEffect` auto-fill emailNotificacion | llama `setCfg` directamente, no LS |
| Todos los `onChange={e => setCfg(...)}` | mutaciones de UI state, no persisten solos |
| `handleGuardarPin` (inline en JSX) | llama `setCfg` + `setEditUbicacion` + `showToast` |
| GPS handler inline | browser API side effect |
| `showToast` en todos los handlers | regla global: hooks nunca toastean |

## Patrón del handler en la vista

```js
// En PantallaTaller:
const handleGuardar = () => {
  guardar();                      // hook persiste LS + Firestore
  showToast("Cambios guardados"); // vista hace el toast
};
```

## Escrituras Firestore en guardar() — documentadas

```js
// usuarios/{uid} — emailNotificacion
setDoc(doc(db, "usuarios", uid), { emailNotificacion }, { merge: true })

// admin_settings/global — notificationEmail
setDoc(doc(db, "admin_settings", "global"), { notificationEmail }, { merge: true })
```

Ambas son `merge: true` — no sobreescriben el documento completo. Fallos son silenciosos (`.catch(console.error)`).

## Regla de seguridad

NO tocar: `src/App.jsx`, `src/TallerPanel.jsx`, `src/lib/storage.js`, `src/services/saasService.js`, `api/`, `firestore.rules`

## Historial

| Fecha | Commit | Cambio |
|---|---|---|
| 2026-06-25 | — | Directiva creada |
