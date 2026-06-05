# Checklist de Cambio y Deploy

## Antes de tocar

- [ ] Leer archivos involucrados.
- [ ] Revisar `git status --short`.
- [ ] Buscar productores y consumidores del dato.
- [ ] Confirmar contrato de datos.
- [ ] Confirmar flujo afectado.

## Durante el cambio

- [ ] Modificar solo archivos necesarios.
- [ ] No usar `git add .`.
- [ ] No crear nuevas API routes si se supera limite Vercel.
- [ ] No cambiar nombres de colecciones sin migracion.
- [ ] No crear nuevos estados sin documentarlos.

## Verificacion local

- [ ] `npm run build`
- [ ] `npm run lint`
- [ ] `git diff --stat`
- [ ] `git diff --check`
- [ ] Confirmar que solo se tocaron archivos necesarios.

## Prueba funcional

- [ ] Probar flujo principal afectado.
- [ ] Probar caso de error.
- [ ] Confirmar datos reales en Firestore/API si aplica.
- [ ] Confirmar que no se muestran datos sensibles.

## Commit y deploy

- [ ] Commit separado por fase.
- [ ] Push a GitHub.
- [ ] Deploy Vercel produccion.
- [ ] Alias actualizado si corresponde.
- [ ] Verificar `https://app.motogestion.ar/version.json`.
- [ ] Verificar ruta publica afectada.

## Cierre

- [ ] Informar archivos modificados.
- [ ] Informar pruebas realizadas.
- [ ] Informar commit hash.
- [ ] Informar deploy verificado.
- [ ] Informar riesgos pendientes.

Regla: si no se puede probar, no se considera terminado. Si no esta commiteado, no se considera implementado. Si no esta desplegado y verificado, no se considera disponible para vender.
