# CLAD Development Cycles

## 2026-08-11 — Emotional Prototype acceptance

1. **Inspect:** Read the authored scene with VirtualScene and queried live Camera, Creature, Body, EyeLeft, and EyeRight transforms. The first Preview query landed during reset; after a clean TypeScript compile/runtime refresh, the retry succeeded.
2. **Observe:** The initial user-view capture placed the wandering creature at the extreme left edge and side-on, making the face unreadable. Live inspection confirmed both eyes existed at mirrored local offsets `(±2, 2.5, -6.7)`.
3. **Test:** Used the existing recenter/chase debug seams. After settling, the creature was 126 cm from the camera at about 8.5° side offset; the Preview capture showed both eyes clearly. No face geometry change was needed.
4. **Motion:** Reset to idle and sampled live transforms at separate timestamps. World position changed from approximately `(0.5, -10, -129.8)` to `(26.2, -10, -116.9)` while body scale changed from `0.992` to `0.983`, confirming wander plus breathing. Glance code remains active on its 5–10 s interval.
5. **Release:** Changed the Preview-only debug trigger to call `release()` twice in one tick and logged the effect boundary. Clean lifecycle logs contained one `[ReleaseEffect] play` per Lens reset, confirming the second request was suppressed by the idempotency guard.
6. **Verify:** TypeScript compile passed and refreshed runtime logs contained no errors; SIK 0.18.0 initialized normally.
