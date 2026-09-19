# ACTIVE_TASK

task_status: active
revision: 3

## Goal
Replace portfolio v2 because user reports the design is worse and the expected scroll animation is effectively absent. Rebuild with a cleaner premium visual system and reliable scroll-driven animation.

## Acceptance
- [~] Replace custom sticky/requestAnimationFrame choreography with GSAP ScrollTrigger pin/scrub timelines plus a no-library reveal fallback.
- [ ] Every major scroll layer must visibly enter/exit; selected projects must transition one-by-one in a pinned stage.
- [ ] Reduce visual noise: one controlled accent family, stronger whitespace, fewer decorative circles/cards.
- [ ] Preserve live GitHub public repository explorer and root Memory Manager site.
- [ ] Verify source, JavaScript syntax, external animation library URLs, and GitHub Pages deployment.

## Evidence / rationale
- User directly reported v2 looked worse and animations were absent.
- GSAP official ScrollTrigger docs support pin + scrub timelines for scroll-linked scenes.
- GSAP community guidance identifies position:sticky/custom transforms as a source of pin/measurement problems; v3 will use ScrollTrigger pinning instead.

## Next action
Replace `portfolio/index.html` on main, then verify runtime-critical structure and deployment.
