# WES FREED homepage motion banners

The homepage's three hero slides now use Korean-inspired minimalist silver, pearl and gold artwork. These are AI-generated campaign illustrations, not photographs or recordings of the store's actual inventory. Stock-video sourcing was unavailable because the environment blocked the stock provider. No third-party stock license or product provenance is claimed.

Each illustration was generated specifically for this theme and exported as an 8-second, silent H.264 loop with a subtle, seamless camera push/pull. These are animated still-artwork loops, not live-action jewelry footage. Landscape 1600 × 758 media uses the existing 19:9 desktop banner and centered 4:5 mobile crop. JPEG first-frame posters keep the page usable before playback, without JavaScript, after playback errors, with reduced motion, and when data saving is enabled.

Assets: `assets/wes-hero-{silver,pearls,gold}.{mp4,jpg}`. The existing three block IDs in `templates/index.json` are retained; their artwork choices and accessible titles are updated. Collection destinations remain unchanged. Existing legacy artwork and merchant image-picker overrides are preserved.

The carousel only downloads a clip when it first becomes active and visible. It pauses hidden slides, offscreen media, background tabs, keyboard-focused controls, and paused carousels. Videos remain muted and play inline. The existing pause/resume button controls both slide rotation and media playback.

Validation:

```sh
node tests/wes-hero-motion.cjs
# If using the cloud machine's installed Chromium:
WES_CHROMIUM_PATH=/usr/bin/chromium node tests/wes-hero-motion.cjs
npx eslint assets/helios.js
shopify theme check --no-input --output json
```

The browser check covers 320, 390, 768 and 1440 px, playback, loading only the active clip, slide changes, pause/resume, offscreen pause, reduced motion, static no-JavaScript fallback and browser errors. Screenshots go to `/tmp/wes-hero-motion`.
