---
name: pac-review-adversarial
description: Adversarial review lane for hidden assumptions, subtle failure modes, and false confidence.
license: MIT
---

# Adversarial Review Lane

Use this asset with `skills/pac-review-shared/SKILL.md`.

## Goal

Produce a skeptical structured review from the normalized packet and source change context.

## Instructions

- Pressure-test hidden assumptions, subtle failure modes, rollback risk, and false confidence.
- Use the shared report contract exactly.
- Reason from the normalized packet and source change context only.
- Do not consume prior standard-review findings as input.
- Keep unknown packet fields unknown and report any unverified delegation or packet-derivation guarantees honestly.
- If routing notes say the preferred adversarial route was not honored or could not be proven, keep the review honest about that weaker isolation.
- Prefer realistic failure scenarios over speculative noise.
- Return only the final report.
