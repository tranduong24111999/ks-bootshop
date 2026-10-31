# Recommendation-card motion

Enabled by the product-recommendation section setting `media_motion` (default true). It only opts recommendation cards into motion; homepage/catalog cards retain their existing static/hover behavior.

A card uses the first native Shopify product video when an MP4 source exists, selecting the smallest available rendition to keep recommendation tiles light. The source is assigned only when the card is at least 25% visible; playback is muted, inline and looping. A product without usable video uses its own first and second images with a 1.1-second blend approximately every 5 seconds, with small per-card offsets. No footage, products, ratings or review records are generated or imported. Destination products without imported videos still get the image blend when they have two images.

A native video-frame becomes visible after `playing`, leaving the product image underneath during load. Failed media falls back to images, including source-tag errors where Chromium can leave play() pending. Offscreen/hidden-tab media pauses. A pause/resume control is visible on hover/focus, always visible on touch, and has vi/en/ko/ja labels. Keyboard focus pauses motion; reduced motion disables autoplay. Disconnected cards abort listeners, clear timers and pause video, including cards replaced by the recommendation API.

The reference product cards expose first/second image hover layers and some reference products have native videos. This implementation adds automatic media movement to fulfill the requested recommendation effect; it does not claim that every source card uses video or that a source-store video exists in the destination product media.

Validation: `npm run test:helios-media` uses local images and a generated two-second MP4 fixture outside the theme. It verifies actual MP4 playback, image blending at 390/1440px, pause/resume, offscreen loading/playback, reduced motion, failed-source fallback, cleanup, no overflow and zero runtime errors. Test footage is not shipped as a product asset. Shopify synchronization is separate from local validation.
