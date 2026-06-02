# DIRECTIVES.md — Reglas de seguridad de código

> Leer este archivo ANTES de modificar cualquier código.
> CLAUDE.md describe la arquitectura. Este archivo describe las reglas de cambio seguro.

---

## Regla de confianza

No escribir código hasta tener 90% de certeza de que no rompe dependencias existentes.
Antes de cualquier cambio: grep el valor exacto que ya existe, leer el productor y el consumidor.

---

## Zonas protegidas — NO tocar sin instrucción explícita

| Zona | Motivo |
|---|---|
| MercadoPago (`mp-webhook.js`, `mp-create-preference.js`) | Flujo de pago en produccion. Cualquier error cuesta dinero real. |
| Counters (`counterService.js`) | Transacciones Firestore garantizan secuencialidad OT/PRE. |
| `noModificaCamposSuscripcion()` en `firestore.rules` | Bloquea autopromociones de plan desde el cliente. No tocar. |
| Claves internas de plan: `base`, `pro`, `full` | Guardadas en Firestore en docs de usuarios existentes. Renombrar rompe todo. |
| `PLAN_BILLING_DAYS` en `saasService.js` | Base=30, Pro=90, Full=365. No cambiar. |
| `LS` en `storage.js` | Unico punto de escritura de datos desde frontend. No escribir directo a Firestore desde views. |
| `api/_firebase-admin.js` | Admin SDK. No modificar la inicializacion. |
| `resolveAccountAccess` / boot flow en `App.jsx` | Logica de acceso SaaS. Error aqui deja a usuarios sin acceso. |
| `calcularResultadosOrden` en `calc.js` | Calculos financieros de OTs. No tocar sin tests manuales. |

---

## Strings exactos en uso — NO crear variantes

Cualquier string de status/estado usado en Firestore y en el frontend debe ser identico en ambos lados.
Antes de escribir un string nuevo, grep el archivo destino para ver qué valor ya existe.

### ratings.status
```
"aprobado"          — auto-aprobado por submit-rating.js y aprobado manualmente por moderate-rating.js
"pendiente_validacion" — estado inicial cuando no se auto-aprueba
"rechazado"         — rechazado manualmente por moderate-rating.js
```

### usuarios.estado
```
"trial" | "activo" | "gracia" | "vencido" | "cancelado"
```

### trabajos.estado
```
"abierto" | "en_proceso" | "finalizado" | "entregado"
```

### recordatorios.estado
```
"pendiente" | "avisado" | "completado"
```

---

## Protocolo de actualización segura (3 pasos obligatorios)

### Paso 1 — Leer antes de tocar
- Leer el archivo completo que se va a modificar.
- Grep todos los consumidores del valor/función que se cambia.
- Identificar: ¿quién produce este dato? ¿quién lo consume? ¿son coherentes?

### Paso 2 — Proponer, no ejecutar
- Describir el cambio exacto (qué línea, qué valor, qué reemplaza a qué).
- Verificar que el productor y el consumidor quedan coherentes después del cambio.
- Si el cambio toca un string en Firestore: verificar que los documentos existentes no quedan huérfanos.

### Paso 3 — Cirugía mínima
- Modificar solo las líneas necesarias.
- No refactorizar, no renombrar, no "mejorar" código adyacente que no es parte del fix.
- Verificar con `npm run build` que no hay errores de compilación.

---

## Reglas de API routes (Vercel Hobby — límite 12 funciones)

Archivos en `api/` sin prefijo `_`: contar antes de crear.
Estado actual: **12 funciones exactas.**

```
check-expirations.js
mp-webhook.js
admin-dashboard.js
moderate-rating.js
submit-rating.js
verify-document.js     ← concentra: public-prices, public-workshops, publish-workshop, lead
send-welcome.js        ← concentra: send-password-reset
mp-create-preference.js ← concentra: mp-diagnose
push-send-recordatorios.js ← concentra: push-subscribe
```

Para agregar un endpoint: usar `?mode=nombre` en una función existente + rewrite en `vercel.json`.
NUNCA crear un archivo nuevo en `api/` sin eliminar otro primero.

---

## Anti-patrones prohibidos

- **No hardcodear strings de status** sin verificar que el resto del sistema use el mismo valor.
- **No agregar campos a Firestore docs** sin verificar que el consumidor (view o API) los lee.
- **No cambiar nombres de colecciones** — los datos en producción usan los nombres actuales.
- **No modificar `vercel.json` rewrites** sin verificar que la URL pública sigue funcionando.
- **No tocar `firestore.rules`** sin verificar que la app puede seguir leyendo y escribiendo.
- **No usar `git add .` o `git add -A`** — siempre añadir archivos específicos.

---

## Checklist pre-commit

- [ ] `npm run build` sin errores
- [ ] grep del string/campo modificado confirma coherencia productor-consumidor
- [ ] no se creó un archivo nuevo en `api/` (o se eliminó uno para compensar)
- [ ] no se tocaron zonas protegidas sin instrucción explícita
- [ ] el cambio es quirúrgico: solo las líneas necesarias
