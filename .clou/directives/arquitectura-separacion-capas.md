# Directiva de Arquitectura: Separación de Capas (UI vs. Dominio)

## Protocolo de inicio de sesion obligatorio

Antes de proponer cualquier cambio a una vista o componente, leer este archivo.
Si el agente propone tocar una vista compleja sin haber extraido la logica primero, aplicar el freno:

> "Acordate de la regla: la UX no cumple funciones. Primero extrae la logica a un hook."

---

## 1. Diagnostico del problema actual

Las vistas (`views/` y `components/`) estan absorbiendo logica de negocio, calculo de estados operativos y mutaciones directas a Firestore. Esto genera archivos monstruosos (`OrderDetailView.jsx` >1600 lineas), rompe el principio de responsabilidad unica y bloquea la adopcion limpia del Design System — forzando la creacion de variantes visuales huerfanas (`violet`, `amber`, `emerald`) para resolver reglas de negocio que no le corresponden a la UI.

---

## 2. El principio fundamental

- **La UX no cumple funciones.** La interfaz es una capa de presentacion pura. Su unico trabajo es mapear un estado semantico ya procesado a un componente visual estandar.
- **El dominio gobierna la logica.** Las reglas de negocio, los calculos de tiempo, costos y las conexiones a la base de datos residen exclusivamente en los Custom Hooks (`src/hooks/`).

---

## 3. Matriz de responsabilidades

| Capa | Que SI hace | Que NO hace |
|---|---|---|
| **Presentacion** `src/views/` `src/components/ui/` | Recibe datos procesados via props o hooks. Usa nombres semanticos (`variant="warning"`). Dispara eventos genericos (`onClick`). Mapea tokens semanticos a clases CSS. | Calcular tiempos ni costos. Leer o escribir Firestore. Inyectar clases de Tailwind basadas en logica de negocio. |
| **Dominio/Estado** `src/hooks/use[Nombre].js` | Escucha y muta datos en Firestore/localStorage. Ejecuta logica de negocio. Traduce el negocio a semantica visual (`statusVariant`, `urgency`, `isOverdue`). | Importar componentes visuales. Exponer clases CSS hacia la vista. Manejar el arbol de renderizado. |

---

## 4. Patron autorizado

### Anti-patron (a erradicar)

La vista calcula el color y el comportamiento mezclando estado del taller con clases de Tailwind:

```jsx
// HomeView.jsx — INCORRECTO
const ACCION_MAP = {
  listo_para_emitir: { label: "Emitir comprobante", color: "text-emerald-400", urgencia: 1 },
};
<p className={`${accion.color}`}>{accion.label}</p>
```

### Patron autorizado

**Hook:** traduce logica de negocio a tokens semanticos.

```js
// src/hooks/useHomeView.js
const ACCION_CONFIG = {
  listo_para_emitir: { label: "Emitir comprobante", urgency: "ready", urgenciaOrder: 1 },
};
// Retorna: accion: { label, urgency: "ready" | "payment" | "blocked" | ... }
```

**Vista:** mapea tokens semanticos a clases CSS. Este mapeo ES logica de presentacion — pertenece aqui.

```jsx
// HomeView.jsx — CORRECTO
const URGENCY_COLOR = {
  ready:   "text-emerald-400",
  payment: "text-green-400",
  blocked: "text-red-400",
};
<p className={URGENCY_COLOR[accion.urgency]}>{accion.label}</p>
```

---

## 5. Caso de referencia implementado: HomeView

Commit de referencia: aplicado sobre `src/views/HomeView.jsx` + `src/hooks/useHomeView.js`.

**Lo que se movio al hook `useHomeView`:**
- Calculo de `ordenesActivas` con `evaluarEstado()` y sort por prioridad
- Enriquecimiento de `alertasService` con moto/cliente/estado evaluado
- `useMemo` de `accionesUrgentes` con logica de prioridades
- Todos los stats derivados: `alerta`, `bloqueado`, `totalPendienteCobro`, `listasParaEntregar`, `ingresosHoy`, `cobradoHoy`, `presupuestosActivos`
- Side effect de notificaciones del browser (Notification API + beep)
- Side effect de `trackEvent("open_home", ...)`
- Acciones con mutacion + side effect: `enviarWhatsAppRecordatorio`, `descartarRecordatorio`

**Lo que quedo en la vista:**
- JSX puro consumiendo los datos del hook
- `URGENCY_COLOR` — mapeo de token semantico a clase CSS (es presentacion)
- `SEVERITY_CLASSES` — idem para alertas de service
- Handlers de navegacion: `trackEvent(navigate_*) + setView(...)`

**Forma del hook:**
```js
const {
  userLabel,
  stats,           // { alerta, bloqueado, totalPendienteCobro, listasParaEntregar, ingresosHoy, cobradoHoy, presupuestosActivos, totalOrdenes }
  ordenesActivas,  // [{ id, patente, marca, modelo, statusVariant, statusLabel, costoActual, maxAutorizado }]
  alertasService,  // enriquecidos con moto, cliente, estado evaluado
  accionesUrgentes,// [{ orderId, patente, marca, modelo, accion: { label, urgency, urgenciaOrder } }]
  config,
  enviarWhatsAppRecordatorio,
  descartarRecordatorio,
} = useHomeView({ orders, bikes, presupuestos, modoLectura });
```

---

## 6. Plan de ejecucion

1. **Proof of concept — HomeView** `COMPLETADO`
   Extraccion a `useHomeView.js`. Demuestra el patron.

2. **Vistas medianas** `PENDIENTE`
   Aplicar extraccion-primero a cada vista antes de tocar su UI.
   Orden sugerido: `PagoView`, `RetiroView`, `RecordatoriosView`, `PagosView`.

3. **Zonas de alto riesgo** `PENDIENTE`
   `OrderDetailView` (1615 lineas) y `ConfigView` (2357 lineas).
   Obligatorio: crear `useOrderDetail.js` y `useConfigView.js` ANTES de tocar un solo componente visual.
   Nadie modifica UI en estas vistas hasta que la logica este en su hook.

---

## 7. Zonas protegidas durante este refactor

No tocar durante la extraccion de hooks:

- `saasService.js` — logica de acceso SaaS
- `storage.js` — LS singleton
- `firebase.js` — init Firebase
- `firestore.rules` — reglas de seguridad
- `api/` — logica de pagos, auth, webhooks
