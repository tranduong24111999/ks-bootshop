# Homepage jewelry films

The three homepage slides use actual filmed jewelry footage, with camera movement and changing focus. There is no animated still-image zoom. The visual treatment uses warm highlights, dark gradients, restrained serif headlines and slow dissolves inspired by luxury jewelry editorials.

## Sources and license

Downloaded 2026-11-03. Each source page explicitly lists the Mixkit Stock Video Free License (commercial use): https://mixkit.co/license/#videoFree

| Asset prefix | Source |
| --- | --- |
| `helios-film-rings` | https://mixkit.co/free-stock-video/engagement-jewelry-5218/ |
| `helios-film-diamond` | https://mixkit.co/free-stock-video/ring-with-a-diamond-in-the-corner-of-a-table-5222/ |
| `helios-film-case` | https://mixkit.co/free-stock-video/case-with-engagement-or-promise-rings-5225/ |

These are stock editorial visuals, not Cartier footage or representations of specific HELIOS products. Slide links still use their configured collection, falling back to all products.

## Delivery

Six self-hosted H.264 MP4 files: 10 seconds, 24 fps, silent, fast-start, 1280×606 desktop / 640×800 mobile. Portrait crops are composed separately for each shot. Each file is approximately 0.3–0.6 MB. Posters are extracted frames from the same films and appear while loading, when motion is reduced or playback is unavailable.

Only the current slide loads and plays. Hidden slides, a hidden document and a carousel outside the viewport pause playback. The pause control stops both film playback and slide rotation. Reduced motion disables automatic playback. Without JavaScript, the first film has native playback controls. The theme editor offers a film selector on each slide.

## Verification

`npm run test:helios` checks 320, 375, 390, 768 and 1440 px with Chromium. For all three films at every width it checks advancing playback time and decoded frame counts, selected source dimensions, muted inline playback and inactive-video suspension. It also checks pause, carousel navigation, reduced motion, accessibility, horizontal overflow and browser errors.

Shopify skill validation passes for the four changed theme files; Shopify Theme Check has zero errors (one existing orphaned-snippet warning). JavaScript lint passes. These are local LiquidJS/Chromium checks, not a production Shopify deployment or physical-device Safari test.
