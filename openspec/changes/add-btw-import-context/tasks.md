## 1. Import snapshot pipeline

- [x] 1.1 Add BTW state and persistence for imported context, including reset and restore behavior after session reloads.
- [x] 1.2 Build the explicit import pipeline from the current main session using `buildSessionContext(...)`, `convertToLlm(...)`, and BTW-specific filtering for compact tool summaries.
- [x] 1.3 Recreate or invalidate the active BTW side session when imported context changes, and handle import attempts safely while BTW is busy.

## 2. BTW overlay integration

- [x] 2.1 Add an in-overlay `Import context` action and footer hint alongside the existing BTW overlay actions.
- [x] 2.2 Render imported context visibly in the BTW transcript so users can tell when BTW is using an explicitly imported snapshot.
- [x] 2.3 Update BTW status and copy so import, refresh, and isolated-by-default behavior are clear during use.

## 3. Verification

- [x] 3.1 Verify the BTW flows for first import, re-import, reset, and session reload against the OpenSpec requirements.
- [x] 3.2 Run the smallest available repository checks relevant to `extensions/btw.ts` and confirm the change does not regress isolated-by-default BTW behavior.
