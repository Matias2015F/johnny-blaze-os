---
name: claudemd-drift
description: Specific places where CLAUDE.md documentation is stale vs actual code, found during 2026-06-02 audit
metadata:
  type: reference
---

CLAUDE.md has drifted from the real code in these spots (code is authoritative):

- calc.js: CLAUDE.md says `src/utils/calc.js`; actual location is `src/lib/calc.js` (imported as `../lib/calc.js` in PrePdfView). `src/utils/calc.js` does not exist.
- API route table: the "API routes" table lists a partial set and omits `cancel-plan.js`, `retention-offer.js`, `mp-reconcile.js` from the primary inventory (they appear elsewhere in CLAUDE.md). Real count is 12 — see [[api-function-limit]].
- receiptService indirection: `src/services/receiptVerificationService.js` is a thin re-export shim of `src/services/receiptService.js`. PrePdfView imports `crearPublicReceipt`/`generateReceiptToken` from receiptVerificationService. Both files are live; neither is dead.
- PDF views live in `src/components/` (PrePdfView.jsx, ExportPdfView.jsx), not `src/views/`, despite CLAUDE.md's views-centric structure description.

**How to apply:** When CLAUDE.md names a path, verify with Glob before acting. The data-model and security sections of CLAUDE.md are accurate; the file-path/structure sections have drifted.
