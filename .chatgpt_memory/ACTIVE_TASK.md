# ACTIVE_TASK

task_status: completed
revision: 5

## Goal
Remove the fragile external animation dependency and rebuild the scroll motion with native browser APIs so the hero reliably performs the requested continuous transformation: one large central object slowly shrinks and moves to the side as the user scrolls.

## Root cause fixed
- Removed external GSAP/ScrollTrigger dependency from jsDelivr.
- Animation no longer depends on third-party script loading.
- Progressive fallback keeps work content visible if the motion engine does not initialize.

## Acceptance
- [x] No external GSAP/ScrollTrigger scripts remain.
- [x] Native requestAnimationFrame + CSS sticky drives the hero.
- [x] Hero core continuously moves from center to upper-right and scales to ~34% desktop / ~30% mobile.
- [x] Dock copy fades in continuously as the core docks.
- [x] Selected Work uses the same native scroll progress engine.
- [x] Live GitHub repo explorer and root Memory Manager site preserved.
- [x] Inline JavaScript syntax passes.
- [x] Both GitHub Pages workflows completed successfully.

## Evidence
- Main commit: `549ee43763fc81e5cc1099c27db1f710b3ea4e98`.
- Portfolio blob: `1874b8e0231c316fb7a90edd4bf5e81dec4a862a`.
- V8 inline JavaScript syntax: PASS.
- Workflow 35460512804: completed/success.
- Workflow 35460512490: completed/success.

## Next action
None.
