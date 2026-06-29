# Template: Deploy

Ticket: [NOMBRE]
Commit a deployar: [SHA]

## Pre-deploy
- [ ] git status limpio
- [ ] npm run lint — 0 errores nuevos
- [ ] npm run build — OK
- [ ] git diff revisado y aprobado

## Ejecutar el procedimiento de deploy vigente
(Utilizar el procedimiento documentado actualmente para producción.)

## Post-deploy
- [ ] Verificar version.json en producción
- [ ] SHA en producción coincide con el commit deployado
- [ ] Confirmar que producción responde correctamente

## Resultado
| Item | Valor |
|---|---|
| SHA deployado | |
| Build time | |
| version.json verificado | sí / no |

## Si falla
1. No hacer rollback automático.
2. Reportar el error exacto.
3. Esperar instrucción del usuario antes de actuar.
