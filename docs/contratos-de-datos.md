# Contratos de Datos - MotoGestion.ar

## Reglas generales

- Campos internos en ingles y camelCase.
- Fechas persistidas en Firestore como Timestamp.
- Fechas expuestas por API como ISO 8601.
- Todo documento nuevo debe incluir `schemaVersion`.
- No crear variantes de estados sin actualizar productores, consumidores y reglas.
- No usar `users/{uid}` para datos publicos de landing.

## Colecciones publicas

```txt
publicWorkshops/{publicSlug}
workshopReputation/{uid}
publicReceipts/{token}
```

## users/{uid}

Documento privado del taller. No se usa directamente para landing ni mapa publico.

```json
{
  "schemaVersion": 1,
  "uid": "string",
  "email": "string",
  "role": "workshop | admin",
  "createdAt": "Firestore Timestamp",
  "updatedAt": "Firestore Timestamp",

  "workshop": {
    "businessName": "string",
    "ownerName": "string",
    "whatsappNumber": "string",
    "city": "string",
    "province": "string",
    "addressText": "string",
    "location": {
      "lat": "number | null",
      "lng": "number | null",
      "locked": "boolean"
    }
  },

  "subscription": {
    "status": "free | trial | active | expired | suspended | cancelled",
    "planKey": "free | monthly | quarterly | yearly",
    "expiresAt": "Firestore Timestamp | null",
    "lastPaymentId": "string | null",
    "updatedAt": "Firestore Timestamp"
  },

  "publicProfile": {
    "enabled": "boolean",
    "slug": "string | null",
    "showWhatsapp": "boolean",
    "showAddress": "boolean",
    "showLocation": "boolean",
    "updatedAt": "Firestore Timestamp | null"
  },

  "settings": {
    "currency": "ARS",
    "defaultWarrantyDays": "number",
    "loyaltyDiscountPct": "number",
    "nextServiceKmOptions": ["number"]
  },

  "onboarding": {
    "profileCompleted": "boolean",
    "firstOrderCreated": "boolean",
    "firstReceiptIssued": "boolean"
  },

  "audit": {
    "createdBy": "string",
    "updatedBy": "string",
    "lastLoginAt": "Firestore Timestamp | null"
  }
}
```

## clients/{clientId}

Cliente privado del taller.

```json
{
  "schemaVersion": 1,
  "id": "string",
  "uidTaller": "string",
  "name": "string",
  "phone": "string",
  "email": "string | null",
  "dni": "string | null",
  "notes": "string | null",
  "createdAt": "Firestore Timestamp",
  "updatedAt": "Firestore Timestamp"
}
```

## bikes/{bikeId}

Moto asociada a un cliente.

```json
{
  "schemaVersion": 1,
  "id": "string",
  "uidTaller": "string",
  "clientId": "string",
  "brand": "string",
  "model": "string",
  "plate": "string",
  "currentKm": "number | null",
  "year": "number | null",
  "createdAt": "Firestore Timestamp",
  "updatedAt": "Firestore Timestamp"
}
```

## workOrders/{orderId}

Orden de trabajo. Es el eje del flujo del taller.

```json
{
  "schemaVersion": 1,
  "id": "string",
  "uidTaller": "string",
  "clientId": "string",
  "bikeId": "string",
  "numeroOrden": "string",
  "status": "open | diagnosis | quoted | approved | in_repair | finished | delivered | cancelled",
  "entryReason": "string",
  "entryKm": "number | null",
  "deliveryKm": "number | null",
  "diagnosis": "string | null",
  "workItems": ["object"],
  "parts": ["object"],
  "payments": ["object"],
  "warranty": {
    "days": "number | null",
    "expiresAt": "Firestore Timestamp | null",
    "mechanicResponsibility": "string | null",
    "clientResponsibility": "string | null"
  },
  "nextService": {
    "km": "number | null",
    "date": "Firestore Timestamp | null"
  },
  "receipt": {
    "token": "string | null",
    "numeroComprobante": "string | null",
    "issuedAt": "Firestore Timestamp | null"
  },
  "createdAt": "Firestore Timestamp",
  "updatedAt": "Firestore Timestamp"
}
```

## payments/{paymentId}

Pago interno o pago Mercado Pago ya reconciliado.

```json
{
  "schemaVersion": 1,
  "id": "string",
  "uidTaller": "string",
  "source": "cash | transfer | mercado_pago | manual_admin",
  "amount": "number",
  "currency": "ARS",
  "status": "pending | approved | rejected | refunded",
  "mercadoPagoPaymentId": "string | null",
  "externalReference": "string | null",
  "metadataUid": "string | null",
  "createdAt": "Firestore Timestamp",
  "approvedAt": "Firestore Timestamp | null"
}
```

## publicReceipts/{token}

Comprobante publico verificable. No debe exponer datos sensibles.

```json
{
  "schemaVersion": 1,
  "token": "string",
  "uidTaller": "string",
  "orderId": "string",
  "numeroOrden": "string",
  "numeroComprobante": "string",
  "estado": "emitido | anulado",
  "validationStatus": "pendiente | validado | vencido",
  "documentType": "servicio_realizado | diagnostico_presupuesto_cerrado",
  "fechaEmision": "Firestore Timestamp",
  "ratingEnabled": "boolean",
  "ratingUsed": "boolean",
  "ratingExpiresAt": "Firestore Timestamp",
  "taller": {
    "nombre": "string",
    "ciudad": "string",
    "provincia": "string"
  },
  "moto": {
    "descripcion": "string",
    "patenteParcial": "string",
    "km": "number | null"
  },
  "resumen": {
    "trabajos": ["string"],
    "repuestos": ["string"],
    "garantia": "string | null",
    "condicionCierre": "string | null"
  },
  "pdfUrl": "string | null",
  "pdfStoragePath": "string | null",
  "createdAt": "Firestore Timestamp"
}
```

## ratings/{ratingId}

Calificacion asociada a comprobante real.

```json
{
  "schemaVersion": 1,
  "id": "string",
  "uidTaller": "string",
  "orderId": "string",
  "receiptToken": "string",
  "numeroOrden": "string",
  "numeroComprobante": "string",
  "documentType": "servicio_realizado | diagnostico_presupuesto_cerrado",
  "scoreAtencion": "number",
  "scoreClaridad": "number",
  "scoreTrabajo": "number",
  "scoreCumplimiento": "number",
  "recomienda": "boolean",
  "comentario": "string | null",
  "source": "receipt_link",
  "status": "pendiente_validacion | aprobado | rechazado | sospechoso",
  "fraudScore": "number",
  "reputationWeight": "number",
  "createdAt": "Firestore Timestamp",
  "validatedAt": "Firestore Timestamp | null"
}
```
