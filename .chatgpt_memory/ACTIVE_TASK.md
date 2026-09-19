# ACTIVE_TASK

task_status: active
revision: 5

## Goal
Remove the fragile external animation dependency and rebuild the scroll motion with native browser APIs so the hero definitely performs the requested continuous transformation: one large central object slowly shrinks and moves to the side as the user scrolls.

## Root cause found
- Current animation depends on external GSAP/ScrollTrigger from jsDelivr.
- If those scripts fail or are blocked/late, the hero remains static and later work cards can stay hidden.
- Current setup also branches out entirely when reduced-motion is enabled.

## Acceptance
- [~] Remove external GSAP/ScrollTrigger script dependencies.
- [ ] Use CSS sticky + native requestAnimationFrame scroll progress for the hero.
- [ ] Hero core continuously moves from center to upper-right and scales down.
- [ ] Dock copy fades in continuously as the core docks.
- [ ] Selected Work uses the same native scroll engine and never leaves hidden content if JS fails.
- [ ] Preserve live GitHub repo explorer and root Memory Manager site.
- [ ] Verify inline JavaScript syntax and Pages deployment.

## Next action
Patch portfolio to native scroll engine and verify.
