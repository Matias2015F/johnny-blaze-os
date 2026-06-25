---
name: rating-status-contract
description: ratings.status is always written as "aprobado" (masculine); the "aprobada" query in publish-workshop is dead code
metadata:
  type: reference
---

The `ratings` collection `status` field is only ever WRITTEN as one of: `"pendiente_validacion"`, `"aprobado"`, `"rechazado"` (all masculine). Confirmed writers: `submit-rating.js` (sets aprobado/pendiente_validacion), `moderate-rating.js` line 72 (aprobado/rechazado). Readers ConfigView.jsx and `.clou/directives/ratings.md` also use `"aprobado"`.

`api/verify-document.js` handlePublishWorkshop (line 138-144) queries BOTH `status == "aprobada"` (feminine) AND `status == "aprobado"`, with a comment claiming "frontend/admin usa aprobada (femenino)". That comment is FALSE — the feminine `"aprobada"` is never written by any code path, so that branch of the query always returns empty. Not a bug (the correct masculine query runs alongside it), but misleading dead defensive code.

**How to apply:** When touching rating reputation aggregation, treat `"aprobado"` as the only real approved value. The `"aprobada"` query can be removed safely but is harmless. Do not "fix" it by switching writers to feminine — that would break existing data.
