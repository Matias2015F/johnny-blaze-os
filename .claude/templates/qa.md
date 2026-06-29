# Template: QA — Auditoría Funcional

Ticket: [QA-001 / QA-002 / QA-003]
Superficie: [ ] App  [ ] Admin  [ ] Landing
Entorno: [ ] Producción  [ ] Local

---

## Metodología

Por cada flujo auditado, registrar:

| Campo | Descripción |
|---|---|
| Flujo | Nombre del flujo o funcionalidad |
| Resultado esperado | Qué debería ocurrir |
| Resultado observado | Qué ocurrió realmente |
| Clasificación | Ver tabla abajo |
| Severidad | Crítica / Alta / Media / Baja |
| Reproducibilidad | Siempre / Intermitente / No reproducido |
| Evidencia | Captura, log, descripción observable |
| Estado | Abierto / Resuelto / Postergado |

---

## Clasificación obligatoria

| Color | Significado |
|---|---|
| 🟥 Bloquea RC-1 | Impide el lanzamiento. Debe resolverse antes de RC-1. |
| 🟨 Deuda documentada | Problema conocido, no bloquea. Queda en backlog. |
| 🟩 Fuera de alcance | No corresponde resolver en este release. |
| 🟦 Mejora futura | Idea o mejora detectada durante QA. No es un bug. |

---

## Hallazgos

### [Nombre del flujo]

- **Resultado esperado:** [descripción]
- **Resultado observado:** [descripción]
- **Clasificación:** 🟥 / 🟨 / 🟩 / 🟦
- **Severidad:** Crítica / Alta / Media / Baja
- **Reproducibilidad:** Siempre / Intermitente / No reproducido
- **Evidencia:** [descripción o referencia]
- **Estado:** Abierto

---

## Criterio de cierre del QA

- [ ] Todos los flujos del alcance auditados
- [ ] Cada hallazgo clasificado con color + severidad + reproducibilidad
- [ ] Hallazgos 🟥 documentados con ticket de corrección
- [ ] Hallazgos 🟦 movidos al backlog de mejoras sin abrir ticket inmediato
- [ ] Resumen final presentado antes de cerrar

---

## Resumen final

| Clasificación | Cantidad |
|---|---|
| 🟥 Bloquea RC-1 | |
| 🟨 Deuda documentada | |
| 🟩 Fuera de alcance | |
| 🟦 Mejora futura | |
| **Total hallazgos** | |

**Veredicto:** [ ] Listo para RC-1  [ ] Requiere correcciones  [ ] No apto para RC-1
