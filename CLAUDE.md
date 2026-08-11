@AGENTS.md


# Task Organism — SPECS Lens for CLAD Hackathon Week 1 (Organize)

## What this is
A spatial task manager where unfinished tasks are living creatures.
Ignored tasks grow restless; the single most urgent one gently follows the user.
Completing a task releases the creature.

## Hard constraints
- Target platform: SPECS (not Snapchat). Lens Studio 5.22+
- Preview-only development — no physical device available.
  Never write code that can only be verified on hardware.
- ASR is OUT of scope this week (device-only API). Do not add voice input.
- Manual deadlines are OUT of scope. `deadlineAtMs` exists in the model but is
  populated by demo fixtures only. Never promise user-entered deadlines.
- Max 6 creatures alive at once. Demo uses 3–4.
- Direct transform control for all movement. No physics engine.
- Unlit materials. Keep polycount and draw calls low.

## Architecture
```
DemoInput / KeyboardInput -> TaskInputSource -> TaskRepository + PersistentStorage
  -> StateEngine (Clock, urgency, thresholds) -> AttentionArbiter
  -> CreaturePresentation -> select / resolve / snooze -> repository
```

## Data model
```ts
type TaskRecord = {
  id: string;
  text: string;
  createdAtMs: number;
  deadlineAtMs?: number;
  importance: "normal" | "high";
  deferCount: number;
  snoozedUntilMs?: number;
  status: "open" | "done";
  appearanceSeed: number;
};
type BehaviorState = "CALM" | "URGENT" | "CHASING"; // derived, never stored
```

## Non-negotiable invariants
1. Behavior state is COMPUTED from data + current time. Never persisted.
2. `RELEASED` is not a state. Completion sets `status: "done"` in the repository;
   release is a one-shot presentation event.
3. Chaser selection REQUIRES a threshold:
   ```ts
   eligible = openTasks.filter(t =>
     now >= (t.snoozedUntilMs ?? 0) && urgency(t, now) >= CHASE_THRESHOLD);
   chaser = eligible.length ? maxBy(eligible, urgency) : null;
   ```
   Three fresh tasks must produce ZERO chasers.
4. At most ONE chaser at any moment.
5. Resolve is idempotent. Save to storage BEFORE playing the release effect.
6. Time is read ONLY through the `Clock` interface (RealClock / DemoClock).
   Never call Date.now() inside the state engine.
7. Storage payload carries `schemaVersion`. Parse failure -> safe empty state, no crash.
8. Completed tasks are removed from storage (or capped at last 5).

## Spatial comfort rules
- Habitat: compact zone 1–1.5m in front of the user
- Chaser: target 1.1–1.3m from camera, 8–12 degree side offset (NOT 30), stops at 1m
- Max speed 0.5 m/s, capped acceleration, easing, arrival radius, dead zone
- Creature must have a readable FRONT (two simple eyes) so its glance is visible
- Short label in habitat only. Full text (max 2 lines, safe truncation) on selection

## Interaction contract
- Short pinch = SELECT: full text + one "Later" button
- Pinch and hold 0.6–0.8s = RESOLVE, with visible progress feedback
- Early release cancels with no consequence
- These two must never conflict or trigger from the same gesture

## Conventions
- TypeScript for all behavior code
- All constants in one config file (thresholds, distances, speeds, timings)
- Comments and commit messages in English
- Commit after each meaningful change
- Run relevant LEAF tests before committing logic changes

## Tone (matters for naming, copy, and UI text)
Creatures are small carriers of obligation, not monsters or debt collectors.
The chaser behaves like a cat asking for attention.
Completion = release and gratitude, never death or punishment.
Never use the words: kill, die, destroy, "can't ignore", "forces you".

## Testing priority
1. Arbiter lifecycle: 3 fresh -> 0 chasers -> age one -> exactly 1 -> snooze -> 0 -> expire -> 1
2. Persistence restore across lens restart
3. Elapsed-time transition without waiting
4. Resolve idempotency
(input parity and corrupt-storage recovery come after the full loop works)

## Out of scope this week
boids/flocking, generated meshes as a dependency, always-visible labels,
voice input or voice completion, throw-to-defer, ambient music, full list UI,
cloud backend, room-anchor restoration.

## Resume After Codex

- Read `HANDOFF.md`, `git status`, and `git diff` before making changes.
- Treat the frozen v3 plan and playbook as authoritative.
- Preserve all existing Codex changes.
- Continue only from `Exact Next Step`.
- Do not repeat work listed under `Do Not Repeat`.
- Verify the next step with CLAD and Lens Studio Preview.
- Update `prompts.md` and `HANDOFF.md` before returning work to Codex.
