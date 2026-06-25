# Johnny Blaze OS — Cookbook de Desarrollo

Patrones reales extraídos del codebase. Seguir esto al agregar features.

---

## 1. Estado local en views/components

No hay un patrón unificado `f`. Usar `useState` individual para campos independientes,
o un objeto de estado cuando los campos se guardan juntos.

```jsx
// Campos independientes → useState separado
const [nombre, setNombre] = useState("");
const [monto, setMonto] = useState("");

// Objeto cuando se guarda todo junto (ej: config)
const [cfg, setCfg] = useState(LS.getDoc("config", "global") || CONFIG_DEFAULT);
const handleChange = (campo, valor) => setCfg(prev => ({ ...prev, [campo]: valor }));
```

---

## 2. Leer y escribir datos

```jsx
// Lectura reactiva (re-render automático cuando cambia)
const clientes = useCollection("clientes");
const config = LS.getDoc("config", "global");

// Escritura
LS.addDoc("clientes", { nombre: "Juan", tel: "11-1234" });
LS.updateDoc("trabajos", orden.id, { estado: "reparacion", updatedAt: Date.now() });
LS.deleteDoc("recordatorios", rec.id);

// Nunca:
import { doc, setDoc } from "firebase/firestore"; // ❌ directo a Firestore desde views
```

---

## 3. Estructura de vista principal

```jsx
export default function MiView({ setView, showToast, bikes, clients }) {
  // estado local
  // handlers

  return (
    <div className="flex flex-col min-h-screen bg-[#0A0A0A] pb-28 animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 bg-zinc-950 flex items-center gap-3">
        <button onClick={() => setView("home")} className="p-2.5 rounded-2xl bg-zinc-800 active:scale-95 text-zinc-300 transition-all">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-black text-white uppercase tracking-tight">Título</h1>
          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Subtítulo</p>
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 px-4 space-y-3">
        {/* cards, listas, etc */}
      </div>
    </div>
  );
}
```

---

## 4. Cards

```jsx
// Card estándar
<div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-4">
  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Sección</p>
  {/* contenido */}
</div>

// Card de acento (primario)
<div className="rounded-[2rem] border border-orange-500/20 bg-orange-500/10 p-4">
  {/* contenido */}
</div>

// Card de éxito
<div className="rounded-[2rem] border border-emerald-500/20 bg-emerald-500/10 p-4">
  {/* contenido */}
</div>
```

---

## 5. Botones

```jsx
// Primario
<button className="w-full rounded-2xl bg-orange-600 py-4 text-[11px] font-black uppercase tracking-widest text-white active:scale-95 transition-all">
  Acción
</button>

// Secundario (zinc)
<button className="rounded-2xl bg-zinc-800 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-300 active:scale-95 transition-all">
  Cancelar
</button>

// Destructivo
<button className="rounded-2xl bg-red-600/20 border border-red-500/30 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-red-300 active:scale-95 transition-all">
  Eliminar
</button>

// Deshabilitado — agregar disabled:opacity-40 al className
<button disabled={!condicion} className="... disabled:opacity-40">
```

---

## 6. Inputs

```jsx
// Input de texto
<input
  type="text"
  value={valor}
  onChange={e => setValor(e.target.value)}
  placeholder="..."
  className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-orange-500/60 transition-all"
/>

// Input numérico (teclado numérico en mobile)
<input
  type="text"
  inputMode="numeric"
  value={montoStr}
  onChange={e => setMontoStr(e.target.value.replace(/\D/g, ""))}
  className="w-full bg-transparent font-black text-white outline-none"
/>

// Textarea
<textarea
  rows={3}
  className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-orange-500 resize-none transition-all"
/>
```

---

## 7. Bottom Sheet (modal)

```jsx
{showSheet && (
  <div className="fixed inset-0 z-50 flex items-end">
    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowSheet(false)} />
    <div className="relative w-full max-h-[85vh] overflow-y-auto rounded-t-[2rem] bg-zinc-900 border-t border-zinc-700 shadow-2xl animate-in slide-in-from-bottom duration-300">
      <div className="mx-auto max-w-[440px] p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">Título del sheet</h3>
          <button onClick={() => setShowSheet(false)} className="rounded-xl bg-zinc-800 p-2 text-zinc-400 active:scale-95 transition-all">
            <X size={18} />
          </button>
        </div>
        {/* contenido */}
      </div>
    </div>
  </div>
)}
```

---

## 8. Chips / badges de estado

```jsx
// Chip de estado
<span className={`border rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${
  estado === "activo" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" :
  estado === "vencido" ? "bg-red-500/20 text-red-300 border-red-500/30" :
  "bg-zinc-700 text-zinc-400 border-zinc-600"
}`}>
  {estado}
</span>
```

---

## 9. Filtros tipo chip (tabs horizontales)

```jsx
const FILTROS = [{ id: "todos", label: "Todos" }, { id: "activos", label: "Activos" }];
const [filtro, setFiltro] = useState("activos");

<div className="px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-none">
  {FILTROS.map(({ id, label }) => (
    <button
      key={id}
      onClick={() => setFiltro(id)}
      className={`shrink-0 px-3.5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${
        filtro === id ? "bg-orange-600 text-white" : "bg-zinc-800 text-zinc-400"
      }`}
    >
      {label}
    </button>
  ))}
</div>
```

---

## 10. Sticky footer con acción principal

```jsx
<div className="fixed bottom-[64px] left-0 right-0 z-40 px-4">
  <div className="mx-auto max-w-[440px]">
    <button className="w-full rounded-2xl bg-orange-600 py-4 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-orange-500/30 active:scale-95 transition-all">
      Confirmar
    </button>
  </div>
</div>
```

---

## 11. Navegación y flujo de datos

```
TallerPanel.jsx
  ├─ view="home"           → HomeView
  ├─ view="ordenes"        → OrderListView
  ├─ view="detalleOrden"   → OrderDetailView (necesita selectedOrderId)
  ├─ view="gestionarTareas"→ TaskManagerView
  ├─ view="presupuestos"   → PresupuestosView
  ├─ view="recordatorios"  → RecordatoriosView
  ├─ view="config"         → ConfigView
  └─ ... (ver TallerPanel.jsx completo)

Agregar vista nueva:
  1. Crear src/views/NuevaView.jsx
  2. Importar en TallerPanel.jsx
  3. Agregar {view === "nuevaVista" && <NuevaView ... />}
  4. Linkear desde donde corresponda con setView("nuevaVista")
```

---

## 12. Formateo de moneda

```jsx
import { formatMoney, formatMoneyShort } from "../utils/format.js";

formatMoney(15000)      // → "$ 15.000"
formatMoneyShort(15000) // → "$ 15k"
```

---

## 13. WhatsApp

```jsx
import { abrirEnlaceExterno } from "../lib/whatsappService.js";
import { normalizarTelWA } from "../lib/messages.js";

const tel = normalizarTelWA(cliente.whatsapp || cliente.tel || "");
abrirEnlaceExterno(`https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`);
```

---

## 14. Mostrar toast

```jsx
// showToast viene como prop desde TallerPanel
showToast("Guardado correctamente");
// Toast de error (si el componente lo soporta)
showToast("Error al guardar", "error");
```
