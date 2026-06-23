# Runbook: Rotación de Credenciales Críticas

> Ejecutar este runbook ante: sospecha de filtración, baja de un colaborador con acceso, o política de rotación periódica.
> Tiempo estimado total: 20-30 minutos.
> Prerequisito: acceso a Firebase Console, Mercado Pago Developers y Vercel Dashboard.

---

## Índice de credenciales

| Credencial | Variable Vercel | Proyectos afectados | Impacto si se filtra |
|---|---|---|---|
| Firebase Service Account | `FIREBASE_SERVICE_ACCOUNT_B64` | `motogestion-app`, `motogestion-admin` | Control total: leer/escribir/borrar cualquier dato |
| MP Access Token | `MP_ACCESS_TOKEN` | `motogestion-app` | Consultar y operar pagos en Mercado Pago |
| MP Webhook Secret | `MP_WEBHOOK_SECRET` | `motogestion-app` | Inyectar pagos aprobados falsos |

---

## 1. FIREBASE_SERVICE_ACCOUNT_B64

**Tiempo estimado:** 10 minutos

### Pasos

**1.1 — Generar nueva clave en Firebase Console**

1. Ir a [console.firebase.google.com](https://console.firebase.google.com) → Proyecto MotoGestión
2. Engranaje (⚙) → **Configuración del proyecto** → pestaña **Cuentas de servicio**
3. Hacer clic en **Generar nueva clave privada** → confirmar → descargar el JSON
4. Guardar el archivo como `sa-nuevo.json` en un directorio temporal (NO en el repo)

**1.2 — Codificar en Base64**

PowerShell:
```powershell
$bytes = [IO.File]::ReadAllBytes("C:\ruta\temporal\sa-nuevo.json")
[Convert]::ToBase64String($bytes) | Set-Clipboard
# El valor está en el portapapeles
```

Bash:
```bash
base64 -w 0 sa-nuevo.json | pbcopy   # macOS
base64 -w 0 sa-nuevo.json | xclip    # Linux
```

**1.3 — Actualizar en Vercel (ambos proyectos)**

Para `motogestion-app`:
```bash
npx vercel env rm FIREBASE_SERVICE_ACCOUNT_B64 production --scope matias2015fs-projects --yes
npx vercel env add FIREBASE_SERVICE_ACCOUNT_B64 production --scope matias2015fs-projects
# Pegar el valor del portapapeles cuando lo solicite
```

Para `motogestion-admin`:
```bash
npx vercel env rm FIREBASE_SERVICE_ACCOUNT_B64 production --scope matias2015fs-projects --project motogestion-admin --yes
npx vercel env add FIREBASE_SERVICE_ACCOUNT_B64 production --scope matias2015fs-projects --project motogestion-admin
```

Alternativa vía dashboard: Vercel → Proyecto → Settings → Environment Variables → editar `FIREBASE_SERVICE_ACCOUNT_B64`.

**1.4 — Redesployar ambos proyectos**

```bash
# App usuario
npx vercel --prod --scope matias2015fs-projects

# Admin (requiere swap de .vercel/project.json — ver CLAUDE.md sección Deploy)
npx vercel --prod --scope matias2015fs-projects --project motogestion-admin
```

**1.5 — Verificar**

- `https://app.motogestion.ar/version.json` — debe mostrar el nuevo build
- Iniciar sesión en la app y cargar una OT — el SDK debe funcionar sin errores en consola
- Verificar en `admin.motogestion.ar` que el panel carga correctamente

**1.6 — Revocar la clave vieja en Firebase Console**

1. Firebase Console → Configuración del proyecto → Cuentas de servicio
2. En la lista de claves, identificar la clave anterior (por fecha de creación)
3. Ícono de papelera → confirmar eliminación

**1.7 — Limpiar archivos locales**

```powershell
Remove-Item "C:\ruta\temporal\sa-nuevo.json" -Force
```

---

## 2. MP_ACCESS_TOKEN

**Tiempo estimado:** 5 minutos

### Pasos

**2.1 — Regenerar credenciales en Mercado Pago**

1. Ir a [developers.mercadopago.com.ar](https://developers.mercadopago.com.ar) → iniciar sesión con la cuenta del negocio
2. **Mis aplicaciones** → seleccionar la aplicación de MotoGestión
3. Ir a la sección **Credenciales de producción**
4. Hacer clic en **Renovar credenciales** (o equivalente según la UI actual de MP)
5. Copiar el nuevo `Access Token de producción`

> Si MP no permite renovar el token de la misma aplicación, crear una nueva aplicación, migrar el `MP_ACCESS_TOKEN` y apuntar el webhook a la nueva app antes de eliminar la vieja.

**2.2 — Actualizar en Vercel**

```bash
npx vercel env rm MP_ACCESS_TOKEN production --scope matias2015fs-projects --yes
npx vercel env add MP_ACCESS_TOKEN production --scope matias2015fs-projects
# Pegar el nuevo token cuando lo solicite
```

**2.3 — Redesployar**

```bash
npx vercel --prod --scope matias2015fs-projects
```

**2.4 — Verificar**

- Crear una preferencia de pago de prueba desde la app (pantalla de suscripción)
- Verificar que el link de MP se genera sin error 401/403

---

## 3. MP_WEBHOOK_SECRET

**Tiempo estimado:** 10 minutos

> Esta rotación tiene una ventana de riesgo: entre el momento en que MP empieza a firmar con el nuevo secret y el momento en que el servidor lo acepta, los webhooks fallan. El orden de pasos a continuación minimiza esa ventana a segundos.

### Pasos

**3.1 — Obtener el nuevo secret de Mercado Pago**

1. Ir a [developers.mercadopago.com.ar](https://developers.mercadopago.com.ar) → **Mis aplicaciones** → aplicación MotoGestión
2. Ir a la sección **Webhooks** o **Notificaciones**
3. Encontrar el campo **Clave secreta** (secret para firma HMAC)
4. Generar o renovar el secret — copiar el valor nuevo

**3.2 — Actualizar en Vercel ANTES de confirmar en MP**

```bash
npx vercel env rm MP_WEBHOOK_SECRET production --scope matias2015fs-projects --yes
npx vercel env add MP_WEBHOOK_SECRET production --scope matias2015fs-projects
# Pegar el nuevo secret cuando lo solicite
```

**3.3 — Redesployar inmediatamente**

```bash
npx vercel --prod --scope matias2015fs-projects
```

Esperar a que el deploy termine (el dashboard de Vercel muestra el progreso).

**3.4 — Confirmar el nuevo secret en MP**

Solo después de que el deploy de 3.3 esté activo, guardar el nuevo secret en el portal de MP. Esto activa la firma con el nuevo secret en MP.

**3.5 — Verificar**

- Hacer un pago de prueba real o usar el simulador de MP
- El webhook debe llegar a `api/mp-webhook.js` y ser aceptado (status 200)
- Verificar en logs de Vercel (dashboard → Functions → mp-webhook) que no hay errores de firma HMAC

**3.6 — Si el webhook falla post-rotación**

El error esperado si hay desincronización: `HMAC mismatch` o similar en los logs. Pasos de recuperación:
1. Verificar que el valor en Vercel env y el configurado en MP son idénticos (sin espacios, sin salto de línea)
2. Si el deploy no terminó antes de que MP empezara a usar el nuevo secret, redesployar nuevamente
3. MP reintenta webhooks fallidos — una vez que el servidor acepta el secret, los reintentos se procesan

---

## Checklist de cierre

Después de rotar cualquier credencial, verificar:

- [ ] Nueva clave/token generado
- [ ] Variable actualizada en Vercel (producción)
- [ ] Redesployado y `version.json` actualizado
- [ ] Flujo funcional verificado en producción
- [ ] Clave/token viejo revocado en el sistema de origen
- [ ] Archivo JSON local eliminado (si aplica)
- [ ] Fecha de rotación anotada abajo

---

## Historial de rotaciones

| Credencial | Fecha | Motivo | Quién |
|---|---|---|---|
| — | — | (primera rotación documentada) | — |

---

## Referencias

- Firebase Console: [console.firebase.google.com](https://console.firebase.google.com)
- MP Developers: [developers.mercadopago.com.ar](https://developers.mercadopago.com.ar)
- Vercel Dashboard: [vercel.com/matias2015fs-projects](https://vercel.com/matias2015fs-projects)
- Amenazas relacionadas: THREAT_MODEL.md — T2, T4, T5
