# Interface Design

When the user wants to explore alternative interfaces for a chosen deepening candidate, use this design-it-twice pattern. Based on "Design It Twice" (Ousterhout) — your first idea is unlikely to be the best.

Uses the vocabulary in [LANGUAGE.md](LANGUAGE.md) — **module**, **interface**, **seam**, **adapter**, **leverage**.

## Process

### 1. Frame the problem space

Before exploring interface options, write a user-facing explanation of the problem space for the chosen candidate:

- The constraints any new interface would need to satisfy
- The dependencies it would rely on, and which category they fall into (see [DEEPENING.md](DEEPENING.md))
- Any issue or PR constraints that narrow the design space
- A rough illustrative code sketch to ground the constraints — not a proposal, just a way to make the constraints concrete

Show this to the user, then proceed to Step 2.

### 2. Produce multiple designs

Produce 3 or more **radically different** interfaces for the deepened module.

If parallel sub-agents are available and useful, you may use them. They are optional, not required.

Whether you do this yourself or with sub-agents, explore at least these design constraints:

- Design 1: minimize the interface — aim for 1–3 entry points max. Maximise leverage per entry point.
- Design 2: maximise flexibility — support many use cases and extension.
- Design 3: optimise for the most common caller — make the default case trivial.
- Design 4 (if applicable): design around ports & adapters for cross-seam dependencies.

Use both [LANGUAGE.md](LANGUAGE.md) vocabulary and `CONTEXT.md` vocabulary so each design names things consistently with the architecture language and the project's domain language.

Each design should include:

1. Interface (types, methods, params — plus invariants, ordering, error modes)
2. Usage example showing how callers use it
3. What the implementation hides behind the seam
4. Dependency strategy and adapters (see [DEEPENING.md](DEEPENING.md))
5. Trade-offs — where leverage is high, where it's thin

### 3. Present and compare

Present designs sequentially so the user can absorb each one, then compare them in prose. Contrast by **depth** (leverage at the interface), **locality** (where change concentrates), and **seam placement**.

After comparing, give your own recommendation: which design you think is strongest and why. If elements from different designs would combine well, propose a hybrid. Be opinionated — the user wants a strong read, not a menu.
