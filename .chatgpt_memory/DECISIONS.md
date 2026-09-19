# DECISIONS

- Revision 4 keeps the v3 editorial design and GSAP architecture but replaces the hero interaction.
- Hero concept: one dominant glass core begins centered and large, then continuously shrinks and moves toward the upper-right side as scroll progresses.
- Pin the outer `.hero__frame`; animate only inner elements. This follows ScrollTrigger guidance not to transform the pinned element itself.
- Use one continuous scrubbed timeline rather than discrete scene cuts.
- After the core docks, reveal a secondary text block on the left so the composition visibly rebalances around the now-small side object.
- Keep the existing Selected Work pinned transitions, capability rows, repository explorer, and reduced-motion fallback.
