# Headroom CCR recovery acceptance evidence

The evaluation in this directory tests **instruction-level recovery**, not whether upstream CCR streaming interception works. Run `npm run eval -- evaluations/headroom-ccr-recovery/manifest.json`; the verifier checks that the model recovers the buoy fact from a durable source and describes the opaque marker as a presentation failure without asking for a paste. In the passing 0.39.1 run, the model used `read` with `offset: 1, limit: 20` and wrote the correct answer without asking for a paste. The evaluation deliberately cannot simulate the Headroom/OpenAI Responses transport defect.

## Manual upstream reproduction (2026-09-29)

- Installed the exact mise pin `pipx:headroom-ai[extras=all]@0.39.1`; `mise exec -- headroom --version` returned `headroom, version 0.39.1`. Bootstrap reconciliation tests passed.
- Started a fresh Pi **TUI** session (not `--print`, which skips Headroom auto-start) with `headroom.enabled: true`, model `openai-codex/gpt-5.6-luna`, and asked it to read `ladislas/mypac#487` with `gh issue view 487 --repo ladislas/mypac --json body,title`. Session ID: `01a0ece2-1245-7376-94bc-1a646bf6106d` (local evidence under `/tmp/mypac-491-ccr-tui/`).
- The recorded tool result contained the issue body; no raw `<<ccr:...>>` marker appeared in this attempt. The model nevertheless made additional reads (a second issue fetch, a persisted JSON read, and a body-only read) before answering correctly. That does **not** establish that upstream headroomlabs-ai/headroom#1877 is fixed: the marker failure was not triggered deterministically, and the Pi session log alone does not prove the proxy's exact wire representation.
- A separate `--print` attempt also returned the correct answer, but is not evidence of Headroom routing because the extension only auto-starts in TUI mode.

Do not replace this manual result with a mocked marker claimed to prove the upstream streaming behavior. Repeat with a future pinned upstream version if the failure becomes reliably triggerable.
