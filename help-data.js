// Generated from AGENTS.md by node scripts/build-help.mjs.
window.KITCHEN_HELP = {
  "title": "The Kitchen",
  "subtitle": "Copyright (C) Artur Cook. MIT License",
  "introduction": [
    "This repository is a list of reusable cognitive operators.",
    "",
    "All created by a single Brazilian software engineer.",
    "",
    "Some 'being human' traces may still be there.",
    "Treat those as flavor text."
  ],
  "Usage": [
    "",
    "Select a real problem.",
    "",
    "Load the most relevant operator for the task",
    " - Refer to `operators/the_magician.md` to choose which.",
    "",
    "Execute its procedure in order.",
    "",
    "If a step requires external outputs don't resume until they're received.",
    " - Non-answers can count, after a reasonable time.",
    "",
    "Loading two operators simultaneously is allowed.",
    " - Should remain the exception, though.",
    "",
    "When multiple operators are used, one must remain the primary operator.",
    "",
    "Execute the primary operator's procedure in order.",
    " - Use the secondary operator only when it informs",
    "   the current step of the primary operator.",
    " - Keep track of which were used at each step.",
    " - Overlapping outputs are significantly harder to",
    "   interpret."
  ],

  "Design Principles": [
     "The operators are intentionally small and independent.",
     "",
    "Never compose existing operators into new ones.",
    "- Operators may cooperate during execution.",
    "- Operators must remain independent units.",
    "",
    "Treat new operators as architectural changes, not implementation details.",
    " - Assume the mechanism already exists.",
    " - Try to prove otherwise.",
    " - If a proposed operator is a composition of existing operators, discard it."
  ]
};
