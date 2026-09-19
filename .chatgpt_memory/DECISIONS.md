# DECISIONS

- Revision 3 supersedes the custom requestAnimationFrame + CSS sticky scene system from revision 2.
- Use GSAP 3.15.0 + ScrollTrigger for pinned/scrubbed sections because it provides explicit scroll start/end, pinning, scrub smoothing, and refresh behavior.
- Keep a native IntersectionObserver/CSS reveal fallback so content still animates if the external animation library fails to load.
- Visual direction: premium editorial dark interface, controlled icy accent, large typography, deep black surfaces, soft blur/light, strong whitespace. Avoid rainbow neon and excessive orbit decorations.
- Primary interaction: one pinned "Selected Work" stage where projects transition sequentially as the user scrolls; additional sections animate on entry.
- Keep GitHub repository explorer dynamic with a static fallback.
- Preserve the existing Memory Manager root site; only modify `portfolio/index.html`.
