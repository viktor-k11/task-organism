# Task Organism Handoff

## Handoff Route

- From: the design Claude session (2026-08-16)
- To: partner, for review + commit + push **from the partner's account**

## Why nothing is committed

Deliberate. All submission commits must carry the partner's authorship, so this
session left every change in the working tree (some staged, none committed).
Review with `git status` / `git diff`, then commit and push from your account.

## What is in the working tree, all of it verified

1. **Voice task creation** (scope amendment in CLAUDE.md, 2026-08-16):
   - `Assets/Scripts/Input/VoiceInput.ts` (+`.meta`) — NEW. V key = push-to-talk
     through AsrModule; single utterance -> one task through the same
     TaskCreationService the keyboard uses; degrades to a status-line pointer at
     the K keyboard when ASR is unavailable.
   - `TaskOrganismController.ts` — V key binding, VoiceInput construction,
     `bindLiveTask` so runtime-created tasks (keyboard AND voice) become
     creatures (before, they landed in the repository but never appeared).
   - `TaskCreationService.ts` — `onCreated` hook that powers the above; unset
     during seeding so fixtures never double-bind.
2. **Three interaction bug fixes**, each with a comment explaining the trap:
   - `CreatureInteractionState.pressEnd(sourceTaskId?)` — a stray pinch-release
     on a NEIGHBOURING creature can no longer cancel an in-flight hold.
   - `TaskSelectionView.ts` + controller `uiPressFrame` — a pinch that starts on
     the open panel or the Later button no longer counts as a "miss", so
     deselect-on-miss can't close the panel out from under the reader or race
     the Later button's onTriggerUp.
   - Controller `onSelectionChanged` — a direct A->B selection switch now
     releases creature A from INTERACTING (before, it stayed frozen because the
     release only ran in the null branch).
3. **Deletion of `Assets/Scripts/Debug/TaskUnderstandingProbe.ts`** (+meta) —
   the throwaway AI-cost probe; its only dependency (RemoteServiceGateway) is
   already gitignored.
4. **Doc archive (staged renames):** `AUDIT-2026-08-13.md`,
   `VERIFICATION-2026-08-13.md`, `plan-day1-hero.md` -> `docs/archive/`.
   `HANDOFF-VISUAL.md` and `prompts.md` stay at root (mechanics guardrail and
   engineering log, both still load-bearing).
5. **CLAUDE.md** — the voice-creation scope amendment.

## Verification evidence (2026-08-16, this session)

- TypeScript recompile: zero errors.
- Full LEAF suite in Preview: **18/20 pass** — data layer, all gate2 (arbiter
  lifecycle, persistence seed+restore, elapsed clock, resolve idempotency),
  all gate3, gate4, gate5, and gate6 pinch-select / hold-resolve /
  early-release / miss.
- **gate6-moving-chaser and gate6-moving-chaser-hold are red and are expected
  to be red.** Commit be9d406 documents the cause: the synthetic
  AiHandInteractor samples the aim point ONCE, and a chaser at the 0.5 m/s cap
  outruns it (~25cm during a ~0.5s pinch delivery vs a 17cm collider
  half-width). A real hand tracks; the instrument cannot. Do NOT green them by
  pausing the creature — they assert the product question "can a moving chaser
  be pinched", which needs HUMAN validation in Preview.
- Voice, verified live: injected V in Preview -> `[VoiceInput] session started`;
  second V -> `session stopped`. AsrModule loads in Preview, toggle works, no
  stray task created. **Not yet tested: one real spoken utterance** (needs a
  human and a microphone — press V, say a task, watch a creature appear).

## Exact Next Step (partner)

1. Review the working tree, run `node Tools/build-gate.js`.
2. Commit from your account. Suggested split:
   - `feat: voice task creation (V push-to-talk) + live-task creature binding`
   - `fix: interaction — neighbour pressEnd guard, UI-press vs miss race, A->B switch release`
   - `chore: archive dated process docs`
3. Push.
4. Human-validate the two open items: pinch a MOVING chaser by hand in
   Preview, and create one task by voice.

## Decisions left open (deliberately not made here)

- `Assets/3d assets/dog.glb` (7MB, tracked) — raw source for the
  `Tools/prepare-pet-glb.js` bake pipeline; referenced by nothing at runtime.
  Keep if the visual pass will re-bake pet meshes from it; drop otherwise.
- `docs/golden/` will need re-baselining after the visual pass
  (`node Tools/visual-regression.js --candidate <dir> --update`).

## Proposed next-phase scope (needs a scope amendment, like voice got)

**Todoist sync as an opt-in start screen**: on first open the user chooses
"Sync with Todoist" or "Add tasks myself" (voice/keyboard). Sketch:
- A Todoist source is just another `TaskInputSource` feeding the repository;
  completions push back (`POST /tasks/{id}/close`) on release, after the
  repository save, same ordering rule as the release effect.
- Todoist REST v2 is Bearer-token auth. Token must NOT live in the Lens —
  proxy through a small backend (Snap Cloud / Supabase edge function).
- The 6-creature cap needs a selection policy for big lists: top-N by the
  existing urgency ranking.
- Google Tasks is phase two: OAuth needs a companion web page + token store;
  strictly more moving parts.
- Cloud backend is out of the frozen v3 week-1 scope — this is week-2+ work.

## UI placeholder pass (same session, after the audit above)

The 2026-08-16 design brief — the retro-desktop care-loop UI — is now
in the working tree as PLACEHOLDERS (UIKit plates + Segoe text; her designed
textures replace the visuals later without structural change):

- `Assets/Scripts/UI/UiCopy.ts` — every user-facing string, designer-editable.
- `Assets/Scripts/UI/RetroUi.ts` — system-dialog builder + hill backdrop.
  NOTE: a dialog BackPlate's Interactable must stay ENABLED or SIK cannot
  target the buttons standing on it (verified live).
- `Assets/Scripts/UI/OnboardingFlow.ts` — O key: backdrop -> YOUR TASKS HAVE
  ARRIVED -> manual/voice/typing -> HERE'S WHAT I HEARD -> done. Walked
  end-to-end with real synthetic pinches.
- `Assets/Scripts/UI/AmbientHud.ts` — headline left, one-at-a-time system
  notification right (chaser announcement uses it), release toasts.
- `Assets/Scripts/UI/StickyNotes.ts` — two rotating encouragement notes.
- `Assets/Scripts/UI/EndOfDayView.ts` — T key: TODAY.TXT with creature/task
  table + template-tier "A NOTE ABOUT TODAY" (pickNote is the single swap
  point for the AI tier).
- `TaskSelectionView.ts` — panel copy is now "What can we do for you?" with
  [Give this one attention] / [Mark as done] / [Not yet]; hold still resolves.
- Controller — attending state (presentation-only single-approacher override,
  invariants 3/4 intact), completion card + toasts after the repository save
  (invariant 5), completed-today log, O/T/P keys.
- `DEMO_AUTOPLAY_ON_START` now false; P actually starts the story (the old
  "P plays the story" status line was a stale promise — no binding existed).
- New assets: `Generated Textures/BlissfulHill.png` (original generated
  wallpaper — the real XP Bliss photo is Microsoft's copyright, do not ship
  it) + `Materials/BlissBackdrop.mat` (unlit, ENABLE_BASE_TEX on).

Verified live: full onboarding walk, attend ("give attention" pulled the
creature out of the habitat to stay close), story-driven release showing the
completion card, TODAY.TXT with two completions. LEAF regression after all
changes: lifecycle, resolve-idempotency, later-snooze, no-gesture-conflict,
pinch-select, pinch-hold-resolve, pinch-miss — all green.

Placeholder debts (deliberate): emoji (💖/creature icons) need sprite images
— LS Text does not render them; HUD is rigidly head-locked (lazy-follow is a
polish pass); onboarding overlays the already-seeded world rather than gating
creation; voice = one task per pause (LLM transcript-tidy pending backend);
AI note = keyword templates (live LLM needs RemoteServiceGateway reinstall +
an RSG token, which requires a Snap account action in the editor).

## Design-review pass 2 (same session)

The designer's 8-item flow review. All still PLACEHOLDER visuals, all verified live.

**Designer-editable layout (new).** `Camera Object > UI Layout (designer panel)`
holds six empty anchors — BackdropAnchor, DialogAnchor, HudHeadlineAnchor,
HudNotifyAnchor, StickyNoteAnchor_1/2. Drag one in the Scene panel and the
matching UI moves; nothing in code overwrites it. Deleting an anchor is safe
(code falls back to the position in `Assets/Scripts/UI/UiLayout.ts`, which also
holds every font size in `UI_TEXT_SIZE`).

**New config knobs** (`CreatureConfig.ts`): `DEMO_SEED_TASK_COUNT` (now 2),
`SHOW_DEMO_CONTROL_PANEL` (now false — that was the "6 tasks • staging" panel),
`BACKDROP_WIDTH/HEIGHT_CM` (220x140, deliberately wider than the display).
Storage key bumped to v6 so the smaller seed takes effect without a manual R.

**Three real bugs found and fixed:**
1. **Typed/spoken tasks were silently refused.** Six seeded fixtures filled the
   repository's six-task cap, so `add()` returned false and no creature ever
   appeared. `DEMO_SEED_TASK_COUNT` leaves room; the typing screen now also
   lists the tasks as they land (`OnboardingFlow.notifyTaskAdded`).
2. **Global hotkeys fired while typing.** KeyPressEvent is shared with the text
   keyboard, so typing "call THE dentist" opened TODAY.TXT on each T and would
   have played the story on a P. `KeyboardInput.isOpen` now gates them.
   Reproduced and fixed live.
3. **Panel buttons could die mid-press.** The "a pinch hit UI, not empty space"
   stamp hung off UIKit's `Button.onTriggerDown`, which does not fire reliably;
   the deferred miss-check then deselected the panel two frames in, disabling
   the button before `onTriggerUp`. Now stamped from the SIK Interactable's
   `onTriggerStart`. Symptom was "Mark as done does nothing".

**Dialog buttons must stand 5cm proud of the plate**, not 2cm: a tall dialog's
BackPlate InteractionPlane box swallowed them and every pinch timed out waiting
for onTriggerStart. Same family as the staging-panel lesson.

**Voice (unresolved upstream).** ASR reports code 3 = NoInternet and Snap's
speech backend drops the gRPC stream (`upstream connect error ... connection
termination`) — and took 4.5 MINUTES to surface, so the UI sat on "I'm
listening…". A 12s watchdog now fails honestly instead. Worth checking the
Preview panel's microphone toggle before assuming the service is at fault.

**Copy/flow changes:** headlines now run WHAT ARE YOU CARRYING TODAY? ->
WHAT'S ON YOUR MIND? -> YOUR TASKS HAVE ARRIVED (voice path keeps HERE'S WHAT
I HEARD); HUD + sticky notes stay hidden until onboarding finishes, then appear
on the same translucent plate as the dialogs with headline/subline tightened;
sticky-note and creature-panel fonts enlarged; starting the story dismisses a
stray onboarding window.

**End of day (new).** Releasing the LAST creature shows "THAT'S EVERYTHING."
instead of the ordinary card, and its `[See what I cared for]` button opens
TODAY.TXT — so the button press still owns opening the document. Verified by
log marker: `completion card lastOne=false` on the first release,
`lastOne=true headline="THAT'S EVERYTHING."` on the last. No emoji anywhere.

LEAF regression after all of it: gate2-1-4, gate2-7, gate3-later,
gate6-pinch-select, gate6-pinch-hold-resolve, gate6-pinch-miss — all PASSED.

## Design-review pass 3 — screen-space UI (same session)

**The ambient messages moved to SCREEN SPACE.** World-space text kept getting
cropped, and the reason is now measured rather than guessed: the Camera
component reports `fov` = 0.6386 rad = **36.6 degrees**, so only about
+/-69cm is ever on screen at the habitat's 2.3m — the sticky notes sat past
it. The HUD headline, the system notifications and the floating
encouragements are now ScreenTransform children of
`Orthographic Camera > Full Frame Region` (that camera already existed in the
project). They cannot fall off the display by construction, and they are
positioned in fractions of the frame, which is also far easier to art-direct.

New authored anchors, all editable in the Inspector via their Screen
Transform: `HudHeadlineScreen`, `HudNotifyScreen`, `StickyNoteScreen_1/_2`.

Two traps worth remembering for any future screen-space work:
- **Layers.** The orthographic camera renders layer mask `1048576`. Objects
  created via scene-graphql (and at runtime) land on the DEFAULT layer `1`
  and are simply never drawn. Both the authored anchors and every runtime
  child now inherit `1048576`.
- **`screenTransform.anchors.left = x` can silently no-op** (property reads
  back a copy). Assign the whole Rect: `anchors = Rect.create(l, r, b, t)`.

Also disabled the leftover template object `Screen Image` under Full Frame
Region — a default mountain/sun placeholder graphic that was covering the view
in portrait aspect.

**`DEMO_SEED_TASK_COUNT` is now 0** — the habitat starts empty so the only
creatures are the ones the user adds. That removed the "two tasks I never
typed" confusion (they were these fixtures). Consequence: the gate6 gesture
scenarios had nothing to pinch, so `gestureHarnessEnsureCreatures()` now seeds
the fixtures on demand when the harness arms. Tests no longer depend on a
designer-facing number.

Confirmed from logs, not guesswork: a typed task DOES bind
(`live task bound task=demo-3 slots=3`), and the end-of-day card DOES fire
(`completion card lastOne=true headline="THAT'S EVERYTHING."`) — the run where
it appeared to do nothing had only released one of two tasks.

LEAF after this pass: gate2-1-4, gate2-7, gate3-later, gate4,
gate6-pinch-select, gate6-pinch-hold-resolve, gate6-pinch-miss — all PASSED.

Open: screen-space text currently has no plate behind it. On the additive
display a dark plate is invisible anyway (black = transparent), so bright bold
text may be the correct Specs answer; verify against a bright room before
adding one.

## Design-review pass 4 — care loop, audio, closing ritual

- **"Mark as done" removed** from the creature panel. Completing a task is now
  ONLY the held gesture — the emotional beat should cost a deliberate hold,
  not a tap. Panel is [Give this one attention] / [Not yet] + hold.
- **One encouragement note**, right side only. All messages rotate through it.
- **Voice status no longer leaks into the ambient notification slot.** It was
  routed to `hud.toast`, so onboarding chrome ("listening…", "added: …")
  appeared over the living habitat. It now writes to the voice SCREEN via
  `OnboardingFlow.setVoiceStatus`.
- **The ambient layer goes quiet when the day ends** — on the release that
  takes the count to zero, HUD and note hide, so the closing card and
  TODAY.TXT are the only things on screen.
- **Two generated audio beds** (algorithmic, license-clean, in
  `Assets/GeneratedSFX/`): `FocusAmbience.wav` (39.7s) loops quietly at 0.35
  volume while a creature is being attended; `ClosingRitual.wav` (67.5s) backs
  the ritual at 0.6. Both verified at -0.4 dB peak.
- **The 1-minute closing ritual** (`Assets/Scripts/UI/ClosingRitual.ts`),
  offered as [Take a minute] on TODAY.TXT and never forced. Three 20-second
  stages of breathing copy with a live countdown, driven from the frame clock
  so the timer and the stage text cannot drift. Verified live: stage 1 at
  "51 sec", stage 2 ("You can leave today here.") arrived on schedule.

LEAF after this pass: gate2-1-4, gate3-later, gate3-no-conflict,
gate6-pinch-hold-resolve, gate6-pinch-miss — all PASSED.

Still template-based, NOT AI: "A NOTE ABOUT TODAY" (`pickNote` in
EndOfDayView.ts). Wiring a live model needs an RSG token, which requires a
Snap account action in the editor that only the owner can perform.

## Design-review pass 5 — one REMINDER block

The floating encouragement note and the notification slot were doing the same
job in two places. They are now ONE block, top-right, in screen space:

    REMINDER                          <- constant header, unchanged styling
    The penguin is not judging you.   <- cycles through REMINDER_MESSAGES

`REMINDER_MESSAGES` in UiCopy.ts holds every line — the creature notes and the
reinforcing messages share one rotation (16s per line, order as written, so
reordering the array reorders the experience). `StickyNotes.ts` is deleted and
its screen anchors removed; the block borrows the same slot for event messages
(chaser announcement, release toasts) and returns to the rotation afterwards.

The chaser announcement now splits into a header and body
(`HUD.chaserHeadline` / `HUD.chaserBody`) so it fits the same two-line shape.

Verified live: header held its place while the line beneath advanced from the
penguin note to "One thing is enough to begin."

LEAF: gate2-1-4, gate3-later, gate6-pinch-hold-resolve, gate6-pinch-miss —
all PASSED.

## Design-review pass 6 — retro artwork, generated in-project

The whole UI now wears authored retro-desktop artwork. The textures are
**SVG authored in-project and converted**, not AI-generated images: diffusion
blurs pixel edges, and this style is all hard bevels and 2px lines.

  Assets/Design assets/ReminderPanel.svg  -> ReminderPanel_512x192.png
  Assets/Design assets/WindowPanel.svg    -> WindowPanel_512x384.png
  Assets/Design assets/ButtonPanel.svg    -> ButtonPanel_256x64.png

Edit an .svg and re-run the SVG-to-texture conversion to restyle everything;
missing PNGs fall back to the plain UIKit plates so a fresh clone still runs.

**Inverted fill, on purpose.** The chrome (frame, blue title bar, bevels) is
bright; the message field is DARK (#23282b). The Specs display is additive, so
dark reads as transparent and bright copy on a classic light-grey field would
wash out completely. The designer's own reference texture had already solved it
the same way.

**How the artwork attaches without breaking input:** BackPlate and Button are
kept (BackPlate's InteractionPlane is what SIK targets buttons through, Button
owns the collider and events) — only their `RenderMeshVisual` is disabled and
a textured quad is drawn in their place. Verified after the swap: a pinch on
"Enter the task" resolved correctly.

Also in this pass:
- Welcome window buttons are **two columns** (`sideBySide` on DialogSpec, only
  honoured for exactly two buttons, each still 22cm wide so the collider stays
  real). Order swapped: **Enter the task** first, Connect Todoist second.
- Dialog title now sits inside the artwork's blue bar (`TITLE_BAR_CENTRE` /
  `TITLE_BAR_BOTTOM` are fractions of the texture, so it tracks any dialog
  height), and the code-drawn close glyph is skipped since the artwork has one.
- Backdrop enlarged to 380x240cm so it runs past the edges of vision. It stays
  WORLD space deliberately: the orthographic camera draws after the
  perspective one, so a screen-space backdrop would cover the dialogs.
- The ritual gets its own generated `RitualSky.png` backdrop for the minute.
- End-of-day is now two screens: "THAT'S EVERYTHING… Is that all for today?"
  -> TODAY.TXT summary + ritual offer.
- `closeOnboarding()` — the story, TODAY.TXT and the ritual all dismiss a
  stray onboarding window first; two stacked windows read as a glitch.

**Bug fixed — phantom tasks.** A LEAF gesture run seeds fixtures through the
real repository, so they persisted into the same save the habitat restores
from, filling all six slots and refusing every new task. Startup now drops a
restored set that is entirely fixture text when DEMO_SEED_TASK_COUNT is 0.
(The six-task cap itself is MAX_OPEN_TASKS in TaskRepository.ts, and matches
CLAUDE.md's "max 6 creatures alive".)

LEAF: gate2-1-4, gate3-later, gate6-pinch-select, gate6-pinch-hold-resolve,
gate6-pinch-miss — all PASSED.

## Design-review pass 7 — proportions, task editing, panel parity

**Why dialogs looked "deformed".** The window artwork is a 4:3 texture
stretched to each dialog, so a tall narrow dialog stretched its title bar and
borders — the taller the window, the fatter its chrome. Fixed by shape, not by
a new texture: DIALOG_WIDTH_CM 56 -> 64, MARGIN 3 -> 2.2, every vertical gap
tightened, and each caller's `bodyHeightCm` trimmed. Real dialogs now land
near the texture's own proportions and the stretch disappears. The reminder
panel was re-exported at 1024x384 (2x sharper) with its "reminder" label moved
to x=26 so it shares a left edge with the message.

**The duplicate task screen is gone.** Typing used to hand off to a review
screen that repeated the same list and the same button. The typing screen now
finishes directly; the review screen survives only on the VOICE path, where
confirming what was heard is the point.

**Tasks can be removed while writing the list.** `TaskRepository.discard(id)`
is a plain removal, deliberately separate from `resolve()`: discarding is not
an achievement, so it releases no creature, plays no completion effect and
never reaches TODAY.TXT. Surfaced as `[ ✕ Remove last ]`, sharing a row with
`[ Add another ]` via the new per-button `column: "left" | "right"` hint.

**The creature panel now matches everything else** — same window artwork, same
blue title bar, and scaled 1.3 -> 2.0 so it reads from habitat distance
(2.4m). `applyWindowArtwork` / `applyButtonArtwork` are exported from RetroUi
so any view can wear the same skin.

Also: the completion card takes a narrower button (`buttonWidthCm`) instead of
a full-width slab.

LEAF: gate2-1-4, gate3-later, gate6-pinch-select, gate6-pinch-hold-resolve,
gate6-pinch-miss — all PASSED after the artwork was applied to the panel,
which is the check that matters: the artwork hides UIKit's drawn mesh but
keeps its collider and interaction plane.

## Design-review pass 8 — the 20-unit-deep collider, and what it cost

**The most important finding in this session.** A UIKit `Button`'s collider is
**20 units DEEP** no matter what size you request — measured on a live button:
requested 26x5x1, actual extents `{x: 10.5, y: 2.5, z: 10.0}`. At the old
z=5.0 that volume swallowed the dialog plate's InteractionPlane sitting behind
it, and SIK could not resolve which one a pinch meant, so EVERY button on the
window went dead. Buttons now stand at **z=12.0**, which clears the plate.

This also explains the earlier "small buttons overlap" lore: the problem was
never only width, it is depth.

**The close box stays decorative.** Three attempts to make it a real control
(10 wide, 20 wide, full title-bar width) each killed the window's action
buttons for the same reason. It needs a bare `Interactable` with an explicitly
sized collider rather than a UIKit Button — worth doing, but not worth
shipping dead windows for. `DialogSpec.onClose` exists and is currently unused.

Also in this pass:
- Reminder panel is smaller (screen anchor 0.37..0.97 x, 0.68..0.95 y), its
  aspect now matches the 1024x384 texture, and the "reminder" label aligns
  with the message's left edge.
- HUD headline is centred, and its anchor stops short of the reminder panel so
  the two never collide.
- Creature panel: headline is now "Give it some time", title bar reads "TASK"
  in bold.
- TODAY.TXT title bar is empty (the headline already names the window).
- The day-complete card offers "Add another task" as well as closing the day.
- Ritual: narrower window (52cm), the countdown is the LARGEST element on the
  screen via the new `DialogSpec.emphasis`, and the backdrop is a generated
  forest. Backdrop enlarged to 620x400 so it surrounds the view.
- `plate.size` now follows `widthCm` — the InteractionPlane must match the
  window or the hit area lands in the wrong place.

VERIFIED: LEAF gate6-pinch-select, gate6-pinch-hold-resolve, gate3-later,
gate6-pinch-miss all PASS, and a real pinch on the welcome window's
"Enter the task" button succeeds after the z=12 fix.

NOT YET VERIFIED, needs a human click: the buttons on TODAY.TXT and the
ritual window. The synthetic hand times out on them while the same code works
on the welcome window; that may be reach rather than a bug, but it has not
been proven either way.

## Design-review pass 9 — icons, landscape backdrops, fitted windows

- **Pixel-art title-bar icons**, authored as SVG like the panels:
  `IconComputer.svg` (system windows) and `IconHourglass.svg` (the ritual),
  converted to 128x128 PNGs. `DialogSpec.icon` places one at the left of the
  title bar and shifts the title text right.
- **Landscape backdrops.** The first hill texture was PORTRAIT with the hill
  in its lower half, so enlarging the quad to 620x400 showed only a crop of
  its middle — the sky. Two new 16:9 textures (`WelcomeHillWide`,
  `RitualHillsWide`) plus a quad sized to just overfill the visible cone
  (150x95 at 1.2m). Note for future: a bigger backdrop quad does NOT show
  more picture — it is head-locked, so it only crops further in.
- **Content now fits inside the frame.** Window height is derived from
  `BODY_INSET_TOP/BOTTOM` — the fractions of the texture that are chrome
  rather than usable body — so buttons and captions can no longer land on the
  border, which is what pushed them outside the window.
- Creature panel enlarged (56x44) with genuinely larger type
  (`creaturePanelBody` 46 -> 62) so it reads at habitat distance.
- Ritual countdown reads "56 sec" rather than a bare number.
- Backdrops use `StretchMode.Stretch` so the whole picture always shows.

LEAF after this pass: gate6-pinch-select, gate6-pinch-hold-resolve,
gate3-later-snooze — all PASSED.

### Still open
- The close box remains decorative (see pass 8 — UIKit Button colliders are
  20 units deep and kill the window's other buttons).
- TODAY.TXT and ritual buttons still need a human click to confirm; the
  synthetic hand times out on them while the same code works elsewhere.
- Screens are built in code, not authored as scene objects. Making each one a
  editable "card" in the Scene panel is a real refactor, not a tweak.

## Design-review pass 10 — retro cursor, Courier titles, world-anchored walls

- **The SIK targeting cursor is now the retro pixel arrow.** SIK spawns four
  plain RenderMeshVisual quads named "CursorVisual" under InteractorCursors
  during its own start, so `skinCursorVisuals()` (RetroUi) runs on a 1.5s
  delayed callback from the controller and swaps each one's material for the
  arrow texture. Log confirms `skinned 4 cursor(s)`. How the cursor works on
  Specs: the hand aims a ray, the arrow marks where it points, a pinch is the
  click. Authored as `IconCursor.svg`.
- **Window titles now use Courier New Bold** — the same face baked into the
  "reminder" artwork, so every title bar matches. Font copied from macOS
  Supplemental fonts; same licensing category as the Segoe files already in
  the project (fine internally, swap before publishing).
- **The backdrops are WORLD-anchored walls now, not head-locked quads.** A
  9x5.6m wall standing 4m in front of where the user was looking when the
  screen opened (same yaw-flattening + forward inversion as HabitatFloor).
  Covers roughly +/-48 degrees of head turn — the user can look around and
  the picture is still there. Key lesson chain now complete: head-locked =
  turning reveals nothing; bigger head-locked = crops further in; world
  anchoring is what "look around and still see it" actually means.
- Dialog body copy is much larger (dialogBody 30 -> 40, body boxes deepened
  so Shrink does not cap it back down).
- Two-column buttons pulled fully inside the artwork body (COLUMN_W 24,
  tighter gap) with proper caption room (4.2cm per row with captions).
- Icons: IconComputer on system windows, IconHourglass on the ritual, drawn
  at the left of the title bar via `DialogSpec.icon`.

LEAF after: gate6-pinch-select, gate6-pinch-hold-resolve, gate3-later — all
PASSED, plus a live pinch on the two-column [Enter the task].

## Design-review pass 11 — slimmer windows, honest captions, a real wall

- Intro window slimmed (body 24 -> 18, width 64 -> 58) and every dialog's
  bottom padding reduced (MARGIN + 1.2 instead of a full double margin).
- Button captions no longer hide under the button artwork: the caption's
  2.4cm box was dropping only 0.9cm below the button's bottom edge, so its
  top half sat behind the button quad. Now drops 2.2cm, with row allocation
  grown to match (5.8cm for a captioned row).
- Backdrop wall enlarged to 16x9m at 4.5m — about +/-60 degrees of head turn
  horizontally, +/-45 vertically, and 16:9 exactly matches the generated
  textures so nothing distorts. Within the display, the picture now fills
  everything.
- The retro arrow cursor is visible in captures and confirmed live.

LEAF after: gate6-pinch-select, gate6-pinch-hold-resolve PASSED, plus a live
pinch on the slimmed window's [Enter the task].

## Recording constraint — additive display (unchanged)

The SPECS Preview composites Lens content additively over the passthrough
background; a fully opaque object reads washed-out against bright backgrounds.
**All demo recording against a dark background.** No colour choice fully
escapes wash-out against a very bright one.

## Frozen v3 documents (unchanged)

- `../task-organism-playbook-v3.md`
- `../task-organism-plan-v3-final.md`

Do not modify their frozen scope.

## Preservation constraints (unchanged)

- Do not rewrite the backend, repository, persistence, arbiter, or interaction
  contracts.
- The design phase works through the `Art Direction (designer
  panel)` object and `CreatureTemplate` per HANDOFF-VISUAL.md; mechanics stay
  isolated beneath each creature's `VisualRoot`.
