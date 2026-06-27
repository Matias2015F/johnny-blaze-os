# Comandos Claude — Set Personal

## Protección
/mejora — Mejorar sin romper lo que funciona.
/seguro — Revisar dependencias antes de tocar código sensible.
/respaldo — Crear backup antes de cambios grandes.

## Deploy y configuración
/deploy — Revisar Vercel, deploys, logs, rollback y errores de producción.
/variables — Gestionar env vars, Firebase, Mercado Pago, Resend, VAPID y claves.

## Calidad de app
/arquitectura — Revisar estructura, capas, acoplamiento y límites técnicos.
/interfaz — Mejorar pantallas, UI, UX, React, Tailwind y patrones visuales.
/revision — Auditar antes de commit: build, lint, strings y zonas protegidas.

## Seguridad
/seguridad — Auditar auth, pagos, endpoints, rate limiting y abuso.
/reglas — Auditar firestore.rules, aislamiento por uid y colecciones públicas.

## Datos
/datos — Diseñar o revisar schemas Firestore, colecciones, campos y retrocompatibilidad.

## Proyecto
/motogestion — Activar supervisor de sesion. Carga contexto completo, reporta estado de hooks SRP, activa reglas de entorno y coordina agentes. Invocar al inicio de cada sesion o tras corte de contexto. Skill en .clou/skills/motogestion/SKILL.md
/cierre — Cerrar sesion con traspaso limpio. Verifica produccion, actualiza backlog y contexto, genera tarjeta de cierre autocontenida para reanudar sin perder nada. Skill en .clou/skills/motogestion/CIERRE.md

## Agentes
/agents — Invocar un sub-agente especializado del equipo virtual. Agentes disponibles en .clou/agents/: backend-auditor (audita api/ contra el Baseline de Oro), growth-specialist (leads y propuestas comerciales), mcp-orchestrator (integraciones externas sin contaminar contexto de programacion), programacion-mentor (mentor bilingue que explica arquitectura y ensenanza antes de escribir codigo).
