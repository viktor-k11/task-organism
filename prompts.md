# CLAD Development Cycles

## 2026-08-11 — Emotional Prototype acceptance

1. **Inspect:** Read the authored scene with VirtualScene and queried live Camera, Creature, Body, EyeLeft, and EyeRight transforms. The first Preview query landed during reset; after a clean TypeScript compile/runtime refresh, the retry succeeded.
2. **Observe:** The initial user-view capture placed the wandering creature at the extreme left edge and side-on, making the face unreadable. Live inspection confirmed both eyes existed at mirrored local offsets `(±2, 2.5, -6.7)`.
3. **Test:** Used the existing recenter/chase debug seams. After settling, the creature was 126 cm from the camera at about 8.5° side offset; the Preview capture showed both eyes clearly. No face geometry change was needed.
4. **Motion:** Reset to idle and sampled live transforms at separate timestamps. World position changed from approximately `(0.5, -10, -129.8)` to `(26.2, -10, -116.9)` while body scale changed from `0.992` to `0.983`, confirming wander plus breathing. Glance code remains active on its 5–10 s interval.
5. **Release:** Changed the Preview-only debug trigger to call `release()` twice in one tick and logged the effect boundary. Clean lifecycle logs contained one `[ReleaseEffect] play` per Lens reset, confirming the second request was suppressed by the idempotency guard.
6. **Verify:** TypeScript compile passed and refreshed runtime logs contained no errors; SIK 0.18.0 initialized normally.

## 2026-08-11 — Gate 1 character redesign

1. **Inspect:** Preserved `CreatureBehavior` chase/release state and reviewed the procedural lathe, eye builder, movement composition, authored hierarchy, and live Preview scene.
2. **Build:** Added offset-ring body geometry for a tilted pear/bean silhouette, dimensional unequal eye whites and pupils, timed blinking, two procedural flippers, and a flattened unlit contact shadow.
3. **Animate:** Increased squash/stretch and composed movement lean, idle sway, and flipper lag with the existing breathing, wander, glance, and chase motion.
4. **Observe:** First isolated capture read as a creature but the upper body was broad, flippers read like ears, and pupils were too faceted.
5. **Fix:** Tightened and offset the crown, lowered/rounded the flippers, and increased pupil profile resolution.
6. **Verify:** Front and three-quarter isolated captures show the asymmetrical living silhouette; the real user-view chase capture shows the face, flippers, body lean, and grounded placement at habitat scale. TypeScript and runtime logs passed. Release still produced one effect-start per Preview lifecycle despite two calls from the idempotency harness.

## 2026-08-11 — Technical character freeze

1. **Inspect:** Audited the authored and runtime hierarchy. `MovementRoot` owns the behavior controller only; all replaceable presentation nodes are below `VisualRoot`.
2. **Isolate:** Reparented `ParticleAnchor` and moved the optional release audio component to `VisualRoot`; updated controller discovery without changing chase, state, or release semantics.
3. **Opacity:** Audited `BlobBody.mat` and confirmed alpha 1, opacity texture disabled, blend mode Disabled, depth test/write enabled, and back-face culling. Added runtime opaque-pass hardening to every cloned body material, including release-brighten clones.
4. **Verify:** Recompiled TypeScript, refreshed Preview logs, inspected the live hierarchy/material result, and captured Preview evidence before freezing the technical checkpoint.
5. **Debt:** Recorded remaining silhouette, face, flipper, material, shadow, effect, and camera-framing work as scheduled polish-phase art debt in `HANDOFF.md`.

## 2026-08-11 — Data layer

1. **Inspect:** Confirmed the frozen v3 plan/playbook files remain absent, then constrained implementation to the model and invariants explicitly present in `CLAUDE.md`.
2. **Build:** Added `TaskRecord`, `Clock`/`RealClock`/`DemoClock`, schema-versioned persistent and in-memory storage adapters, and a six-open-task repository.
3. **Guards:** Added safe-empty recovery for invalid/unknown storage payloads, copy-on-read boundaries, duplicate/cap rejection, clock-based snooze, completed-task removal, and idempotent resolve.
4. **Test:** Installed official LEAF 2.0.2, registered `task-organism-data-layer`, and ran it in Lens Studio Preview.
5. **Verify:** LEAF passed restore/add/snooze/resolve/restart/corrupt-storage coverage. TypeScript compilation and refreshed runtime logs also passed.

## 2026-08-11 — Gate 2 Product Truth

1. **Fresh threshold:** `gate2-1-4-chaser-lifecycle` asserted three fresh open tasks produce `null` from `AttentionArbiter.selectChaser`.
2. **Single chaser:** Advanced `DemoClock` past one task's demo deadline while the other two remained below the age threshold; the arbiter selected exactly `urgent`.
3. **Snooze suppression:** Snoozed `urgent`; the arbiter immediately returned zero chasers.
4. **Snooze expiry:** Advanced `DemoClock` beyond the snooze timestamp; the arbiter again selected exactly `urgent`.
5. **Real restart restore:** Ran `gate2-5-persistence-seed`, then `gate2-5-persistence-restore` as separate LEAF Preview runs (and therefore separate Lens resets). Restored `id=persist-id` and `text=Persisted task text` exactly.
6. **Elapsed restore:** `gate2-6-8-elapsed-clock` restored an old task with `DemoClock` already beyond the age window and selected it immediately, with no real-time wait.
7. **Resolve idempotency:** `gate2-7-resolve-idempotency` called resolve twice and asserted one storage save plus one release callback.
8. **Clock isolation:** The elapsed scenario proved injected-clock behavior; static `rg` found no `Date.now()` under `Assets/Scripts/State`. The sole project call is inside `RealClock.nowMs()`.

All five Gate 2 scenario runs returned `succeeded`. Remaining body capture streaking/transparency appearance remains non-blocking polish-phase art debt.
