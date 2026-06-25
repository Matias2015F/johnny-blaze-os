---
name: fefe-admin-fallback
description: Two admin API endpoints fall back to a hardcoded fefe@gmail.com platform-admin email if the env var is unset
metadata:
  type: project
---

`api/admin-dashboard.js` (line 8) and `api/moderate-rating.js` (line 10) compute `ADMIN_EMAILS` as `process.env.PLATFORM_ADMIN_EMAILS || "matias4604@gmail.com,fefe@gmail.com"`. If `PLATFORM_ADMIN_EMAILS` is NOT set in Vercel, any Firebase user authenticated with `fefe@gmail.com` is treated as a platform admin and can view the admin dashboard and approve/reject ratings. `api/mp-reconcile.js` does NOT have this fallback (only matias4604@gmail.com).

**Why:** `fefe@gmail.com` looks like a leftover dev/test address. Security here is entirely dependent on `PLATFORM_ADMIN_EMAILS` being correctly set in the production Vercel env, which removes the fallback. This was flagged in the 2026-06-02 audit as HIGH severity.

**How to apply:** Verify `PLATFORM_ADMIN_EMAILS` is set in Vercel production before relying on admin auth. Recommend removing `fefe@gmail.com` from the hardcoded fallback string regardless. Note the firestore.rules `isPlatformAdmin()` does NOT include fefe@gmail.com (only matias4604 + the admin uid), so this gap is API-layer only, not Firestore-rules-layer.
