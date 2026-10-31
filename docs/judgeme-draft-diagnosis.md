# Judge.me draft integration fix

## Observed configuration

Read-only GitHub inspection found Shopify's latest synchronization at `3f1ad7ba10844e391274a75ae558d6d0974de616`. This draft is based on that commit, preserving subsequent merchant edits instead of overwriting them with the older local template.

- Judge.me core app embed is enabled (`disabled: false`) in `config/settings_data.json`. This file is unchanged by the fix.
- Two active full Review Widgets exist in the latest product template: `judge_me_reviews_review_widget_77dHUP` in product-main and `judge_me_reviews_review_widget_cE4MAR` in an Apps section.
- Both full widgets select `review_data: sample_data`, not the product's real review feed.
- The legacy HELIOS product-reviews section is already disabled and empty.
- No theme CSS selector found in the repository hides `.jdgm-rev` or its body. The existing CSS affects presentation; app-owned runtime styles and moderation still require live inspection.
- No product ID or handle is hardcoded into the native app block. The fallback in the legacy section binds to the current Liquid product.

## Draft changes

1. Keep exactly one active full widget, retaining the existing Apps-section widget ID and its max-width, product-only scope and empty-state settings. Select `review_data: real_data`.
2. Replace the full widget embedded in product-main with the native preview badge. Keep its position in the block order.
3. Put the full widget before product recommendations, in the standard Shopify Apps section, with optional HELIOS styling enabled. Other Apps sections retain their generic markup.
4. Keep the disabled legacy section disabled. Its compatibility renderer no longer captures app output or treats comment-only output as a populated app.
5. Add read-only diagnostics only when `request.design_mode` is true. These show current Shopify Product ID/Handle, actual widget IDs/count, app-reported count and rendered-row count, missing/delayed widget state, duplicates and mismatches. Diagnostics never rewrite IDs, reinitialize Judge.me, fetch hidden reviews, change moderation or inject review data.
6. Keep the black HELIOS presentation. No fabricated ratings, authors or reviews are added.

## Verification and limits

- Local browser tests at 390/1440px: product A/B binding; one native widget; visible rendered review body; white histogram; missing/delayed/mismatched/duplicate widget diagnosis; diagnostics absent from customer pages; no runtime errors.
- Tests use local app-markup fixtures, not a live Judge.me service. They check integration boundaries and do not assert that the live app returned a particular customer's reviews.
- Theme Check: 0 errors. Existing warnings remain for the remote journal video and an orphaned snippet.
- Existing merchant edits to media, buy controls, text, FAQ, extra Apps sections and app embed remain intact.
- Shopify theme API currently returns 401 Invalid API key/access token. Public product access redirects to the password page. Therefore no current product's live widget-to-app mapping, API response or Published/Hidden count can be independently confirmed, and the draft cannot be uploaded/tested through Shopify from this environment yet.

## Shopify draft-only acceptance steps

1. Upload the provided theme ZIP as a new unpublished theme (or connect the separate fix branch to a new draft). Do not merge into the live-connected branch or publish.
2. In that draft's App embeds, verify Judge.me Reviews Core remains enabled.
3. Open a specific product in the draft theme editor. The Apps section should contain one Review Widget with real review data; product-main should only have the preview badge.
4. Expand the diagnostics panel. Compare its Shopify Product ID and Handle with the exact product in Judge.me Product management. Source-store product IDs must not be assumed to equal destination IDs.
5. In Judge.me, check Product Reviews versus Store Reviews, Published versus Hidden/pending, and the actual product mapping. A shop-wide total of 696 does not establish published reviews for this product. Do not publish demo/sample records to make an empty widget appear populated.
6. Check browser Network/Console for failed Judge.me requests or blocked scripts. Confirm returned reviews belong to this product. Check another product to rule out a shared/mismatched widget ID; test desktop/mobile, sorting, pagination and media using the actual app.

No Shopify theme publication, app moderation change or review import is performed by this fix.
