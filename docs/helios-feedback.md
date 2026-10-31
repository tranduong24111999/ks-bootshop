# HELIOS Feedback

The previous FEEDBACK header link fell back to a page search when no Shopify page existed. A generic page only rendered `page.content`, so importing products never populated Feedback.

The theme now includes a dedicated community-photo section, four columns on desktop and two on mobile, with product links revealed on hover/focus (always visible on touch). Its shipped fallback contains the 16 actual photo cards from the first page of https://helios.vn/pages/feedback, retrieved 2026-10-31. Source URLs, captions, social profiles, product handles, and local artwork filenames are recorded in `helios-feedback-source.json`. These are reference community images, not fabricated testimonials, ratings, reviews, or verified purchases in the destination store. A source link remains visible below the default gallery. Further source pagination is not fabricated.

Header/footer links use the native Feedback page with `?view=feedback` when it exists; otherwise `/?view=feedback` renders the alternate index template. `page.feedback.json` and `index.feedback.json` use the same section. The legacy default page template also renders the section for handle `feedback`, so existing direct page URLs work without an Admin mutation. No Shopify pages or products were created or deleted.

Merchants can replace the reference gallery in the theme editor by adding community-photo blocks with image, real caption, source profile URL, and an existing Shopify product. When blocks exist, the shipped default gallery is replaced. Custom block names and page content remain Shopify-translatable merchant content; interface labels are provided in vi/en/ko/ja.

Product hover links resolve `all_products[handle]` against the destination store. Missing products use the local Shopify search route rather than a nonexistent product URL. Existing merchant-selected products use their actual Shopify URLs. The 16 default cards reference 10 product entries, below Shopify's 20 unique `all_products` lookups per page limit.

Validation: `npm run test:helios-feedback` checks default/custom rendering, route resolution, source asset presence and browser image decoding, actual-product routes, 390/1440px column counts, hover and horizontal overflow. These are local theme tests; Shopify GitHub integration logs are needed to confirm store-side synchronization.
