# Directiva: ConfigView — análisis de dominio y zonas de riesgo

## Ubicación

`src/views/ConfigView.jsx` (~2497 líneas)

## Estructura real del archivo

El archivo no es una sola vista monolítica. Es un contenedor de tabs que incluye **6 sub-componentes internos** independientes:

| Componente | Líneas aprox. | Contiene |
|---|---|---|
| `PantallaResumen` | ~60 | Display only: caja + stats del mes |
| `PantallaTaller` | ~300 | Formulario de config + `guardar()` a Firestore |
| `PantallaDatos` | ~400 | Backup local + nube + exportaciones |
| `PantallaSistema` | ~350 | PWA update, notificaciones push, logout, delete account |
| `PantallaReputacion` | ~130 | Display: ratings del taller |
| `PublicarRedCard` | ~100 | API call a `/api/publish-workshop` |

El **root `ConfigView`** (export default, líneas 2388–2497) ya es delgado:
- `activeTab` — tab seleccionada (persistida en localStorage)
- `cfg` — config del taller leída de LS cache
- `bkpEstado` — estado del backup local
- 2 handlers: `handleRestaurarArchivo`, `handleRestaurarAuto`
- `renderContent()` — switch de tabs

## Por qué NO tiene hook todavía

El patrón `useXxxView` tiene retorno alto cuando un solo componente mezcla 200+ líneas de estado con mutaciones de dominio. En ConfigView la lógica ya está particionada por sub-componente. Un `useConfigView` mueve código de lado sin mejorar la arquitectura.

## Zonas de riesgo — no tocar sin instrucción explícita

### CRITICO: PantallaTaller.guardar()
```js
// PantallaTaller línea ~190
const guardar = () => {
  LS.setDoc("config", "global", toSave);
  setDoc(doc(db, "usuarios", uid), { emailNotificacion: ... }, { merge: true });
  setDoc(doc(db, "admin_settings", "global"), { notificationEmail: ... }, { merge: true });
  showToast("Cambios guardados.");
};
```
Si se rompe: las notificaciones de plan, recibos de pago y alertas de vencimiento dejan de llegar al taller.

### CRITICO: PantallaSistema — auth flows
- `handleLogout` — `auth.signOut()` pasado como prop desde TallerPanel
- `deleteUser(auth.currentUser)` — borra la cuenta de Firebase Auth permanentemente
- `forceSyncCacheToFirestore()` — migración de datos, irreversible en caso de conflicto

### PROTEGIDO: imports de saasService.js
`PantallaSuscripcion` importa y llama:
- `actualizarSuscripcionUsuario` — escribe plan de usuario en Firestore
- `guardarAdminSettings` — escribe settings de admin
- `isPlatformAdminUser` — verifica si el usuario es admin de plataforma
- `validateAdminSettings`, `validatePlanKey` — validaciones de suscripción

Estos son métodos de `saasService.js` que está **explícitamente protegido** en la directiva de seguridad del proyecto. No extraer, no wrappear, no modificar llamadas sin auditoría dedicada.

## Qué SÍ se puede mejorar en el futuro (con scope acotado)

### Objetivo A: PantallaTaller → useTallerConfig
Extraer `guardar()` y `setPrecioConfig()` a un hook. Bajo riesgo relativo si se hace con cuidado. Requiere directiva propia antes de implementar.

### Objetivo B: PantallaDatos → useBackupPanel
Extraer handlers de backup local/nube a hook. Riesgo medio — `restaurarDesdeTexto` y `restaurarAutoBackup` son destructivos.

### Objetivo C: PantallaSistema → NO TOCAR hasta decisión explícita
Auth flows, PWA update y delete account son operaciones críticas con efectos permanentes. Cualquier refactor requiere revisión manual completa.

## Regla de seguridad

NO tocar:
- `src/App.jsx`
- `src/TallerPanel.jsx`
- `src/lib/storage.js`
- `src/services/saasService.js`
- `api/`
- `firestore.rules`

## Historial

| Fecha | Cambio |
|---|---|
| 2026-06-25 | Directiva creada. Sin implementación. ConfigView auditado — se decide NO crear hook por ahora. |
