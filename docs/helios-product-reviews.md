# HELIOS product reviews

The product template already contained the real Judge.me review-widget app block and a preview badge. This update preserves both app IDs/settings and product binding. The full widget now lives in `helios-product-reviews`, before recommendations, with scoped black/white styling matching the reference screenshot. The theme does not manufacture ratings, histogram counts, reviewer identities, photos, or purchase verification.

Native Judge.me remains responsible for rating totals, histogram filtering, customer photo/video gallery and lightbox, sorting/pagination, review submission, upload handling, moderation, verification and spam prevention. Media/gallery availability depends on the app configuration/plan and the actual reviews present. Those app capabilities are not replaced by nonfunctional theme controls.

Rendering prefers the configured app blocks. If no app blocks render, it can display the current product's actual `product.metafields.judgeme.widget`. If neither exists, a truthful empty state is shown; setup guidance appears only in the theme editor. There is no copy of another product's/source store's review dataset in production theme files.

## Data migration is separate

Theme access/GitHub cannot import app-owned review records. The environment has no Judge.me Admin/API connection and Shopify Theme Access has returned 401. To transfer real review records from the source, obtain a Judge.me export CSV through the source app account, preserving product handles, original dates, author/rating/body, media URLs and source provenance. Map it to existing destination product handles before importing through the destination Judge.me dashboard. Do not assume source numeric product IDs equal destination IDs, and do not label imports verified purchases unless supported by actual order evidence and the app's verification rules. No reviews or products have been imported/deleted by this update.

`npm run test:helios-reviews` checks app block IDs/order, empty state, preservation of a product-bound widget and variable rating/count values, responsive styling and visible controls. Fixtures are local test data only. Tests do not emulate Judge.me network submission, sorting services, moderation or media uploads; these require the authorized live app.

The user's correction is also applied: the COLLAB menu now resolves to World of Helios (`helios-journal-url`) instead of the separate one-story Collab reference. Old reference templates are retained at their direct URLs.
