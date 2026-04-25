# Johnny Blaze Taller OS — Documento de Contexto

## Descripción general

Aplicación web progresiva (PWA) para la gestión operativa de un taller mecánico de motos.
Permite registrar ingresos de vehículos, cargar tareas por orden de trabajo, calcular presupuestos
automáticamente en base al valor hora del taller, y controlar el estado de cada trabajo.

Diseñada para uso móvil (pantalla de celular), instalable como app desde el navegador.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework UI | React 18 |
| Build tool | Vite 5 |
| Estilos | Tailwind CSS v3 (via PostCSS) |
| Íconos | lucide-react |
| Backend / Auth | Firebase (Authentication + Firestore) |
| Persistencia local | localStorage (con eventos personalizados) |
| Deploy | Vercel |
| Repositorio | GitHub: Matias2015F/johnny-blaze-os |
| URL producción | https://johnny-blaze-os.vercel.app |

---

## Estructura de carpetas

```
taller-v1-dev/
├── index.html                    ← entrada HTML, apunta a /src/main.jsx
├── vite.config.js                ← config Vite con plugin React
├── tailwind.config.js
├── postcss.config.js
├── public/
│   ├── manifest.json             ← PWA manifest (ícono, colores, display standalone)
│   └── logo512.svg               ← ícono de la app (JB, naranja sobre negro)
└── src/
    ├── main.jsx                  ← punto de entrada React
    ├── index.css                 ← estilos globales Tailwind
    ├── firebase.js               ← inicialización Firebase (auth, db, functions)
    ├── App.jsx                   ← control de acceso y estado de sesión
    ├── LoginScreen.jsx           ← pantalla de login / registro
    ├── TallerPanel.jsx           ← router principal de la app
    ├── services/
    │   ├── authService.js        ← escucha cambios de auth (onAuthStateChanged)
    │   └── accessService.js      ← valida acceso trial/activo, crea trial
    ├── lib/
    │   └── storage.js            ← capa de localStorage (LS) + hook useCollection
    ├── utils/
    │   └── format.js             ← formateadores de moneda argentina (ARS)
    ├── views/
    │   ├── HomeView.jsx          ← pantalla inicio con estadísticas
    │   ├── OrderListView.jsx     ← lista de órdenes activas
    │   ├── NewOrderView.jsx      ← formulario de nuevo ingreso
    │   └── ConfigView.jsx        ← configuración del taller (gastos, metas)
    └── components/
        └── OrderDetailView.jsx   ← detalle de orden: tareas, presupuesto, estado
```

---

## Flujo de la aplicación

### 1. Autenticación y acceso (App.jsx)

```
Inicio
  └─ onAuthStateChanged (Firebase Auth)
       ├─ No logueado → LoginScreen
       ├─ Usuario nuevo (doc no existe en Firestore) → espera
       ├─ estado: "trial" y trialFin > ahora → TallerPanel
       ├─ estado: "activo" → TallerPanel
       └─ trial vencido / sin permisos → pantalla "Acceso Restringido"
```

El estado del usuario vive en Firestore: `db/usuarios/{uid}`.
Campos relevantes: `estado` ("trial" | "activo"), `trialFin` (timestamp ms), `activoHasta` (timestamp ms).

Al registrarse, se crea el documento con `estado: "trial"` y `trialFin: ahora + 30 minutos`.

### 2. Router principal (TallerPanel.jsx)

Maneja un estado `view` con estos valores:

| View | Componente |
|---|---|
| `"home"` | HomeView |
| `"ordenes"` | OrderListView |
| `"nuevaOrden"` | NewOrderView |
| `"detalle"` | OrderDetailView |
| `"config"` | ConfigView |

La navegación se hace pasando `setView` como prop a cada vista.
No usa React Router — ruteo manual por estado.

### 3. Persistencia de datos

**Datos de taller (localStorage):**
- `jbos_johnny-blaze-os_ordenes` — array de órdenes de trabajo
- `jbos_johnny-blaze-os_motos` — array de motos registradas

El hook `useCollection(col)` en `src/lib/storage.js` escucha el evento personalizado
`ls_update` para re-renderizar cuando cambian los datos. Funciona entre componentes
sin necesidad de estado global.

```js
// Ejemplo de uso
const orders = useCollection("ordenes"); // reactivo, se actualiza solo
```

**Configuración del taller (Firestore):**
- `db/usuarios/{uid}.config` — objeto con gastos, objetivos, perfil
- Se sincroniza en tiempo real con `onSnapshot` desde TallerPanel
- Se guarda con `setDoc(..., { merge: true })` desde ConfigView

### 4. Lógica de cálculo del valor hora

El núcleo financiero de la app. Se calcula en tiempo real en ConfigView y OrderDetailView:

```
valorHora = (totalGastosMensuales + gananciaDeseada) / horasFacturablesMes
```

Cada tarea de una orden tiene:
- `texto` — descripción del trabajo
- `horas` — tiempo estimado en horas (decimal, ej: 1.5)
- `repuestos` — costo de repuestos en ARS
- `total` — calculado: (horas × valorHora) + repuestos
- `check` — boolean, si la tarea está completada

El presupuesto total de la orden es la suma de `total` de todas las tareas.

### 5. Estados de una orden de trabajo

```
diagnostico → reparacion → lista → entregada
```

Al pasar a `"entregada"`, la orden desaparece de la lista activa.
Todos los cambios de estado se guardan en localStorage vía `LS.updateDoc`.

---

## Modelos de datos

### Orden (`ordenes`)
```json
{
  "id": "lz4abc123",
  "patente": "ABC123",
  "modelo": "Honda CB 250",
  "problema": "No arranca, pérdida de aceite",
  "estado": "reparacion",
  "fecha": "25/04/2026",
  "tareas": [
    {
      "id": 1745612345678,
      "texto": "Cambio de aceite",
      "horas": 0.5,
      "repuestos": 3500,
      "total": 8750,
      "check": true
    }
  ]
}
```

### Moto (`motos`)
```json
{
  "id": "lz4xyz789",
  "patente": "ABC123",
  "modelo": "Honda CB 250"
}
```

### Config (Firestore: `usuarios/{uid}.config`)
```json
{
  "perfil": {
    "nombreTaller": "Johnny Blaze",
    "responsable": "Matias",
    "direccion": "",
    "telefono": ""
  },
  "gastos": [
    { "id": 1745600000, "desc": "Alquiler", "monto": 80000 },
    { "id": 1745600001, "desc": "Luz", "monto": 15000 }
  ],
  "objetivos": {
    "horasMes": 120,
    "gananciaDeseada": 200000
  },
  "lastUpdate": "25/04/2026"
}
```

---

## Formateo de moneda (ARS)

Todas las funciones están en `src/utils/format.js`:

| Función | Uso |
|---|---|
| `formatMoney(monto)` | Muestra: `$ 15.000` |
| `formatMoneyInput(val)` | Formatea mientras el usuario escribe |
| `formatQtyInput(val)` | Solo números enteros (horas) |
| `parseMonto(val)` | Convierte `"15.000"` → `15000` para guardar |

---

## Firebase — configuración y colecciones

**Proyecto Firebase:** `johnny-blaze-taller`

**Auth:** Email/Password habilitado.

**Firestore — colecciones:**
- `usuarios/{uid}` — documento por usuario con su config

**Reglas recomendadas Firestore:**
```
match /usuarios/{uid} {
  allow read, write: if request.auth.uid == uid;
}
```

---

## Sistema de acceso / monetización

Implementado en `src/services/accessService.js` y `src/App.jsx`.

| Estado en Firestore | Resultado |
|---|---|
| `estado: "trial"` + `trialFin` futuro | Acceso OK |
| `estado: "trial"` + `trialFin` pasado | Bloqueado |
| `estado: "activo"` + `activoHasta` futuro | Acceso OK |
| `estado: "activo"` + `activoHasta` pasado | Bloqueado |
| Sin documento | Espera (usuario recién creado) |

Para activar un usuario manualmente: editar su documento en Firestore Console,
cambiar `estado` a `"activo"` y agregar `activoHasta: <timestamp futuro en ms>`.

---

## Lo que NO tiene todavía (mejoras posibles)

- Historial de órdenes entregadas
- Perfil del taller visible en la app
- Sistema de clientes / base de datos de motos por cliente
- Exportar presupuesto a PDF / WhatsApp
- Notificaciones push cuando una moto está lista
- Panel de administración para gestionar suscripciones
- Modo offline robusto (Service Worker / PWA completa)
- Múltiples técnicos / roles
- Estadísticas y reportes mensuales
- Integración con MercadoPago para cobrar suscripciones

---

## Comandos útiles

```bash
npm run dev       # servidor local en http://localhost:5173
npm run build     # build de producción en /dist
git push          # sube cambios → Vercel deploya automáticamente
```

---

## Contexto para IA o programador externo

Esta es una app MVP funcional para un taller mecánico argentino real.
El dueño es mecánico, no programador. El objetivo es que la app sea simple,
rápida de usar en el celular durante el trabajo, y que calcule sola el presupuesto
basándose en el costo real del taller.

La prioridad es **funcionalidad sobre arquitectura perfecta**.
El código usa localStorage porque es suficiente para un solo usuario/dispositivo.
Firestore se usa solo para la configuración (que sí necesita persistir entre dispositivos).

Cualquier mejora debe mantener el diseño actual (oscuro, naranja, tipografía bold/uppercase)
y no agregar complejidad innecesaria al flujo de uso.
