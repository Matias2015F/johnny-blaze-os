---
name: api-function-limit
description: api/ directory is at the exact Vercel Hobby 12-function limit; the documented function table is outdated
metadata:
  type: project
---

The `api/` directory contains exactly 12 non-underscore serverless functions, which is the Vercel Hobby hard limit. Adding any new file to `api/` without removing one will break the production deploy.

The 12 functions (verified by audit on 2026-06-02): admin-dashboard, cancel-plan, check-expirations, moderate-rating, mp-create-preference, mp-reconcile, mp-webhook, push-send-recordatorios, retention-offer, send-welcome, submit-rating, verify-document. Helpers `_email.js`, `_firebase-admin.js`, `_ratelimit.js` do not count.

**Why:** Vercel Hobby plan caps serverless functions at 12. The consolidation pattern is `?mode=` query param + rewrite in vercel.json (see verify-document.js which hosts 6+ modes: public-prices, public-workshops, publish-workshop, lead, receipt-incentive, plus the default uid+ot document verification).

**How to apply:** Before suggesting any new `api/*.js` file, confirm an existing function is being removed, or fold the new behavior into an existing function via `?mode=`. Note: `receipt-incentive` mode in verify-document.js is NOT in vercel.json rewrites — it's called directly as `/api/verify-document?mode=receipt-incentive`.

Related: [[reference-claudemd-drift]]
