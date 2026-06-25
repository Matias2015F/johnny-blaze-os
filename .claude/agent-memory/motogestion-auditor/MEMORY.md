# Memory Index

- [API function count at hard limit](project_api_function_limit.md) — api/ has exactly 12 non-underscore functions; deploy breaks if one more is added
- [Hardcoded fallback admin email risk](feedback_fefe_admin_fallback.md) — admin-dashboard.js + moderate-rating.js fall back to fefe@gmail.com if env var unset
- [Rating status string contract](reference_rating_status_contract.md) — only "aprobado" (masculine) is ever written; "aprobada" query is dead defensive code
- [CLAUDE.md doc drift](reference_claudemd_drift.md) — several documented paths/tables are stale vs actual code
