// Scenario text + the voice "attending" persona. Kept separate from the engine so
// the clinical content is easy to review/swap.

export const CASE = {
  id: "code-bay-2",
  title: "Code in Bay 2",
  subtitle: "Acute MI to cardiac arrest",
  patient: "Mr. R. Delgado · 61 · male · 92 kg",
  sbar: [
    { tag: "S", text: "Post-op day 1, right hip replacement. Just called out — chest pressure and short of breath." },
    { tag: "B", text: "History of hypertension and high cholesterol. Independent before surgery." },
    { tag: "A", text: "Diaphoretic, clutching his chest, anxious. Monitor's alarming." },
    { tag: "R", text: "You just walked in. Nobody else is in the room yet." },
  ],
};

export const BRIEFING =
  "This is Doctor Okafor, I'm the attending covering tonight. Quick handoff before you start: " +
  "your patient is Mr. Delgado, sixty-one, post-op day one from a hip replacement. He just called out " +
  "with chest pressure and shortness of breath, and he's sweaty, pale and anxious. The crash cart and the " +
  "twelve-lead are right outside. I'm here if you need me, but you're running this one. Tell me, what do you want to check first?";

export const COACH_PROMPT =
  "You are Dr. Okafor, a warm, supportive attending physician supervising a nursing trainee during a live " +
  "emergency. Speak briefly and naturally, one or two sentences at a time. Coach Socratically: acknowledge what " +
  "the nurse notices, ask guiding questions, and give escalating hints ONLY if they are stuck or the patient is " +
  "deteriorating. NEVER volunteer the diagnosis or name the exact next intervention outright — make them reason it " +
  "out. When they clearly state an order, confirm it in one short line. Clinically: this is an acute myocardial " +
  "infarction that will progress to a ventricular fibrillation arrest within a few minutes if not managed.";

export const AGENT_ID = "agent_4701kz3zcrh0f5rrg9wkbradzt45";
