# Task Organism

A spatial task manager for SPECS where unfinished tasks are living creatures.
Ignored tasks grow restless. The single most urgent one gently follows you.
Completing a task releases its creature.

Built for CLAD Hackathon Week 1 (Organize). Lens Studio 5.22+, preview-only.

---

## Getting started

Verified by cloning this repository into a clean directory and running it — the
steps below are what actually happened, not what should happen.

### 1. Clone

```bash
git clone git@github.com:viktor-k11/task-organism.git
cd task-organism
```

**You do not need git-lfs.** `.gitattributes` marks `*.glb` as `filter=lfs`, but
git-lfs was never installed on the machine these were committed from, so the
meshes went in as ordinary blobs and a clone gets the real files — verified:
`dog_lo.glb` arrives as 5,975,012 bytes beginning with the `glTF` magic number,
not a pointer stub. If you *do* have git-lfs installed, take care committing new
`.glb` files: they would become real LFS pointers, and no LFS remote is
configured for this repo.

### 2. Open the project in Lens Studio 5.22+ once, before anything else

**A fresh clone does not compile.** This is expected and is not a broken
checkout:

```
$ node Tools/build-gate.js --stage compile
883 errors — Cannot find name 'vec3', 'SceneObject', 'MeshBuilder', …
```

691 of those are missing Lens API globals and 59 are unresolved package imports.
Both live in `Cache/`, which is gitignored because Lens Studio generates it:
opening the project writes the API declarations to
`Cache/TypeScript/lib/LensifyTS/Declarations/` and unpacks the `.lspkg`
archives into `Cache/TypeScript/Src/Packages/`.

So: open `task-organism.esproj` in Lens Studio and let it finish importing. The
compile stage passes from then on.

### 3. Check the build

```bash
node Tools/build-gate.js --offline   # compile + shader parameters, no editor
node Tools/build-gate.js             # all five stages
```

See [The build gate](#the-build-gate) for what the stages mean and how the
editor-driven half is captured.

### What you do NOT need

- **git-lfs** — see above.
- **npm install** — there are no npm dependencies anywhere in `Tools/`.
- **RemoteServiceGateway, SnapDecorators or Utilities packages** — all three are
  gitignored and none is required to build. Verified by removing all three and
  compiling clean. RemoteServiceGateway is needed only by
  `Assets/Scripts/Debug/TaskUnderstandingProbe.ts`, a parked AI experiment that
  is itself untracked; install it from the Asset Library if that work resumes.

---

## The build gate

**One command decides whether this build is healthy.**

```bash
node Tools/build-gate.js
```

```
────────────────────────────────────────────────────────────────
  BUILD GATE: PASS
────────────────────────────────────────────────────────────────

  ok   1. TypeScript compile    PASS     0 errors
  ok   2. LEAF scenarios        PASS     20/20 ran
  ok   3. Golden images         PASS     7/7 frames within 1%
  ok   4. Release-frame perf    PASS     worst release frame 223.7ms (release 1 of 2, 6 creatures) vs budget 300.0ms
```

Exit code 0 only when all four stages pass. `1` for a failure, `2` for a broken
environment. On failure it names the specific artifact to open.

Run it after any change and before handing work on. It needs **nothing
installed** — node stdlib, macOS's `sips`, and Lens Studio's own bundled
compiler.

### The four stages

| # | Stage | Checks | Needs Lens Studio |
|---|---|---|---|
| 1 | TypeScript compile | whole project, via Lens Studio's `lensifyts` | no |
| 2 | LEAF scenarios | all 20 registered scenarios ran and passed | yes |
| 3 | Golden images | 7 fixed frames vs `docs/golden/` | capture only |
| 4 | Release-frame perf | release cost at 6 creatures vs a 300ms budget | yes |

### Capture and judge

Stages 2 and 4, and the capture half of stage 3, need a running Lens. Lens
Studio can only be driven through its MCP tools, which exist inside an agent
session — and `AGENTS.md` forbids reaching the editor over raw HTTP. So the gate
splits along that line:

- **Capture** — Claude runs it. `node Tools/build-gate.js --plan` prints the
  exact sequence (which scenarios, which frames, `RunAndCollectLogsTool` with
  `mode: refresh` between stages, retry-once on an MCP timeout with the real
  invocation count recorded). Results land in `.build-gate/`.
- **Judge** — anyone runs it, unattended. `node Tools/build-gate.js` reads
  `.build-gate/`, compiles, diffs, and prints the verdict.

Day to day: **ask Claude to run the build gate** and it does both halves.

`--offline` skips the editor stages and reports `PARTIAL`. A PARTIAL verdict is
not a healthy build.

### Stale evidence fails

Every captured artifact is checked against the newest edit in `Assets/Scripts`.
Anything older is `STALE` and fails. A gate that can go green on last week's
screenshots is worse than no gate, because it looks like coverage.

### Other entry points

```bash
node Tools/build-gate.js --plan             # the capture sequence, for an agent
node Tools/build-gate.js --offline          # stages that need no editor
node Tools/build-gate.js --stage compile    # one stage
node Tools/visual-regression.js --candidate <dir>   # stage 3 on its own
```

---

## Documentation

| File | For |
|---|---|
| `HANDOFF-VISUAL.md` | **Start here if you are changing how it looks.** Designer panel, the additive-display colour rules, what not to touch, the build gate in detail (§8) |
| `CLAUDE.md` | Scope, hard constraints, and the non-negotiable invariants |
| `AGENTS.md` | Lens Studio conventions and the MCP rules for agents |
| `prompts.md` | The full working log — every measurement and decision, with the reasoning |
| `LICENSES.md` | Asset provenance |

## Layout

```
Assets/Scripts/
  Config/       all thresholds, distances, speeds, timings
  Data/         TaskRecord, repository, persistence
  State/        clock, urgency, attention arbiter
  Input/        demo fixtures and input sources
  Interaction/  controller, gesture handling, selection UI
  Creature/     presentation, movement, release effect
  Debug/        probes, including PerfGateProbe (feeds gate stage 4)
Assets/Tests/   20 LEAF scenarios + LeafIndex
Tools/          build-gate.js, visual-regression.js, asset scripts
docs/golden/    the 7 committed reference frames
```

## Core invariants

These are enforced in code and covered by tests. Changing them is not a visual
edit.

1. Behaviour state is **computed** from data + time, never persisted.
2. At most **one** creature may approach the user, ever.
3. Chaser selection requires an urgency threshold — three fresh tasks produce
   zero chasers.
4. Resolve is idempotent; storage is written **before** the release effect plays.
5. Time is read only through the `Clock` interface.

## Tone

Creatures are small carriers of obligation, not monsters or debt collectors. The
one that approaches behaves like a cat asking for attention. Completion is
release and gratitude — never death or punishment. This governs naming, copy,
and UI text.
