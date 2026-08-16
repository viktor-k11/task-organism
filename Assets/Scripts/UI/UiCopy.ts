/**
 * Every user-facing word in the experience, in one file.
 *
 * This is the designer's file. Edit any string here and press Preview —
 * nothing in it is logic. Written from the designer's 2026-08-16 brief; the tone
 * rules from CLAUDE.md apply: creatures are small carriers of obligation,
 * completion is release and gratitude, never punishment. The words kill /
 * die / destroy / "can't ignore" / "forces you" must never appear here.
 */

/**
 * The three onboarding headlines run as one sentence across the flow:
 *   1. WHAT ARE YOU CARRYING TODAY?   (the welcome)
 *   2. WHAT'S ON YOUR MIND?           (while adding tasks)
 *   3. YOUR TASKS HAVE ARRIVED        (the review, just before they live)
 */
export const INTRO = {
    title: "System message",
    headline: "WHAT ARE YOU CARRYING TODAY?",
    body:
        "Things to do can feel bigger when they're left alone.\n" +
        "Here, every task becomes a small creature to care for.\n\n" +
        "Give it a little attention.\nCarry it with you.\n" +
        "And when the work is done, let it go.\n\n" +
        "Nothing here is chasing you.\nSome things just want to be noticed.",
    todoistButton: "Connect Todoist",
    todoistCaption: "Bring in the things already on your mind.",
    manualButton: "Enter the task",
    manualCaption: "Give one thing a shape.",
    todoistComingSoon: "Todoist sync arrives in a later build — let's start here.",
};

export const MANUAL_WINDOW = {
    title: "System message",
    headline: "WHAT'S ON YOUR MIND?",
    body:
        "Add the things that need a little attention.\n" +
        "They don't have to be big. They just have to be yours.",
    typeButton: "Type my tasks",
    typeCaption: "Write them down one by one.",
    voiceButton: "Tell me instead",
    voiceCaption: "Leave a voice note. We'll turn it into your list.",
    footer: "You can always add another one later.",
};

export const TYPING_WINDOW = {
    title: "ADD TODAY'S TASKS",
    headline: "WHAT'S ON YOUR MIND?",
    body: "The keyboard is open — type a task and press Enter.\nEach line becomes its own creature.",
    addAnother: "Add another",
    removeLast: "✕  Remove last",
    primary: "Bring them to life",
};

export const VOICE_WINDOW = {
    title: "System message",
    headline: "WHAT'S ON YOUR MIND?",
    body: "Say whatever you need to get done today.\nMessy is fine. We'll sort it out.",
    startButton: "Start voice note",
    listening: "I'm listening…",
    finishButton: "Turn this into my list",
    /** Shown when the speech service never answers — see VoiceInput's watchdog. */
    noAnswer: "I couldn't hear anything. Voice needs a connection — try typing instead.",
};

export const REVIEW_WINDOW = {
    title: "System message",
    headline: "YOUR TASKS HAVE ARRIVED",
    heardHeadline: "HERE'S WHAT I HEARD",
    footer: "Anything missing?",
    confirmButton: "Looks right",
    editButton: "Edit the list",
    primary: "Bring them to life",
};

export const HUD = {
    headline: "What are you carrying today?",
    subheadline: "Take care of one thing at a time.",
    /** Constant header for the notification block — it stays put while the
     *  line underneath cycles through REMINDER_MESSAGES. */
    reminderTitle: "REMINDER",
    chaserHeadline: "You've got company.",
    chaserBody: "Your most urgent task may stay close until you take care of it.",
    attendingPrefix: "Giving attention to: ",
};

/**
 * Everything the REMINDER block can say, one line at a time. The "REMINDER"
 * header above it never changes; this list is what cycles underneath, so the
 * creature notes and the reinforcing messages share one rotation. Add, remove
 * or reorder freely — order here is the order they appear in.
 */
export const REMINDER_MESSAGES: string[] = [
    "The penguin is not judging you.",
    "It doesn't all need your attention at once.",
    "One thing is enough to begin.",
    "Your rabbit believes in you.",
    "Small progress still counts.",
    "You can do this gently.",
    "The owl says: one thing first.",
    "Someone somewhere is also avoiding an email.",
    "Starting counts.",
    "You're allowed to take the scenic route.",
    "Done is a kind place to leave a task.",
    "A task can be important without being scary.",
    "You don't need to hurry to be moving.",
    "Look at you, tending to things.",
];

export const SELECTION_PANEL = {
    /** Sits in the panel's blue title bar, like every other window. */
    title: "TASK",
    headline: "Give it some time",
    attendButton: "Give this one attention",
    doneButton: "Mark as done",
    laterButton: "Not yet",
    holdHint: "or hold to take care of it",
    holdProgressPrefix: "Caring…  ",
};

export const COMPLETION = {
    title: "System message",
    headline: "You took care of it.",
    body: "It doesn't need to follow you anymore.",
    button: "Let it go",
};

/** One appears (at a time) as the creature leaves. */
export const RELEASE_TOASTS: string[] = [
    "That's one less thing to carry.",
    "Off it goes.",
    "Nicely cared for.",
    "You gave this one what it needed.",
    "All taken care of.",
];

/**
 * The last creature has been let go. This card replaces the ordinary
 * completion card on the final release, and its button opens TODAY.TXT.
 */
export const DAY_COMPLETE = {
    title: "System message",
    headline: "THAT'S EVERYTHING.",
    body:
        "Nothing is waiting for you here anymore.\n" +
        "The habitat is quiet — which is exactly how it should look\n" +
        "at the end of a day you took care of.\n\n" +
        "Is that all for today?",
    button: "Yes, that's my day",
    addMoreButton: "Add another task",
};

/**
 * The optional 1-minute closing ritual, offered from TODAY.TXT.
 *
 * Three 20-second stages, each a title plus two calm lines, then a closing
 * card. The timer counts the whole minute down; the stage text changes at
 * 40s and 20s remaining. Nothing here asks the user to achieve anything.
 */
export const RITUAL = {
    title: "A MOMENT",
    offerButton: "Take a minute",
    offerCaption: "An optional 1-minute breathing pause.",
    skipButton: "Not today",
    stages: [
        {
            atSecondsRemaining: 60,
            headline: "Nothing needs your attention right now.",
            body: "Let your shoulders drop.\nTake a slow breath in, then out.",
        },
        {
            atSecondsRemaining: 40,
            headline: "You can leave today here.",
            body: "Notice the space around you.\nBreathe slowly. There's nowhere else to be for a moment.",
        },
        {
            atSecondsRemaining: 20,
            headline: "Let the rest go with them.",
            body: "One last easy breath.\nTomorrow can wait until tomorrow.",
        },
    ],
    endHeadline: "That's enough for today.",
    endBody: "See you tomorrow.",
    endButton: "Close",
};

/** Title bar left empty on purpose — the headline below already says
 *  what the window is, and the filename read as clutter. */
export const TODAY_TXT = {
    title: "",
    headline: "Look at everything you cared for today.",
    emptyBody: "Nothing released yet — and that's fine.\nThe creatures are happy to wait with you.",
    carriedSuffix: " things are no longer yours to carry.",
    carriedSuffixOne: " thing is no longer yours to carry.",
    enough: "That's enough for today.",
    closeButton: "Close the day",
    ritualButton: "Take a minute",
    footer: "There will be other things tomorrow. You can meet them then.",
    noteTitle: "A NOTE ABOUT TODAY",
};

/**
 * Template fallbacks for the end-of-day note, used until the AI evaluator is
 * wired to a live model. Buckets are picked from simple keyword patterns in
 * the completed task texts. The AI version must follow the same tone: someone
 * quietly noticing what happened — never "OMG you crushed it".
 */
export const NOTE_TEMPLATES = {
    creative:
        "You spent a lot of today shaping something that didn't exist this morning.\n" +
        "That kind of work is hard to see while you're inside it — but it moved.\n" +
        "You can leave the rest here for tomorrow.",
    people:
        "Today seems to have been mostly about other people — replying, helping, organizing.\n" +
        "The people waiting on you aren't waiting anymore.\n" +
        "That seems like enough for one day.",
    practical:
        "Most of today was made of small practical things — messages, errands, loose ends.\n" +
        "None of them looked huge on their own, but each one was asking for your attention, and you gave it.\n" +
        "Your evening gets to be a little quieter now.",
    lowPressureClosers: [
        "You can leave the rest here for tomorrow.",
        "That seems like enough for one day.",
        "The remaining ones can wait.",
        "Go do something that isn't on a list.",
    ],
};
