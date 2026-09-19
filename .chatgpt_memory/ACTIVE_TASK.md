# ACTIVE_TASK

task_status: completed
revision: 6

## Goal
Fix the "nothing is visible" failure and make the hero's main object unmistakably visible.

## Root cause found
- Revision 5 contained a literal backslash-n sequence inside the inline JavaScript variable declarations.
- That produced a JavaScript SyntaxError and stopped the motion code from executing.
- The previous abstract glass core was also too visually subtle for the user's intended "there is a thing" interaction.

## Fix
- Replaced the abstract core with a large, high-contrast product/app window in the center of the hero.
- The object contains a visible title, metrics, chart, frame, toolbar, and badge.
- Kept the native sticky + requestAnimationFrame scroll engine.
- Repaired the inline JavaScript newline syntax issue.

## Verification
- Final main commit: `47609530ec1bfa73854c792abfa43877f7b1ebf9`.
- Final blob: `2cb3ea5595863717e2c239fed617246db9c03c7b`.
- Inline JavaScript V8 syntax: PASS.
- No external animation dependency.
- Hero product window exists.
- Native requestAnimationFrame motion exists.
- GitHub Pages run `35460825049`: completed/success.

## Next action
None.
