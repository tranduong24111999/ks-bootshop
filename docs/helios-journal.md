# World of Helios journal

The reference is https://helios.vn/en/blogs/world-of-helios, which is distinct from `/blogs/collab`. This update keeps Collab and adds the World of Helios editorial journal, linked from DISCOVER, the mobile menu, and the Collab category navigation.

## Source coverage

The snapshot includes all six reference World of Helios listing pages (53 articles), and the first listing page of Ring, Necklace, Bracelet, Silver, Stone and Glasses. In total there are 12 listing views and 74 distinct source articles with internal read-more views. The source URLs, retrieval date, category/card records, article IDs, local banner filenames and unavailable-image exclusions are recorded in `helios-journal-source.json`. Further pagination in other categories is not fabricated.

The journal has seven working category tabs, a sticky category bar, tall full-width banner stack, title/excerpt overlays, and the source craft film inserted after every three cards. World of Helios has six real pagination destinations. Source scripts, styles, iframes and forms are excluded from article bodies; imported Liquid delimiters are encoded as text. Source attribution links remain in articles.

The first ten World banners and craft poster are local theme assets. Other editorial images and the craft video use the original HELIOS CDN. Article images were probed through actual reduced-size source thumbnails to supply proportional width/height attributes and reduce layout shift; images unavailable at retrieval were excluded, rather than replaced with invented photos. Article body copy retains the language actually served by the reference, which includes some Vietnamese even under `/en`. It is not a set of new blog records created in Shopify Admin.

## Shopify integration

Native Shopify blogs/articles are preferred when present. The journal section resolves the selected/current category blog and paginates real articles. Source cards also resolve matching native articles before using the reference read-more views. No imported products, pages, articles or merchant data are removed or created in Admin.

The theme-only fallback uses `/[locale]/?view=journal-CATEGORY-PAGE`; corresponding alternate index/blog templates exist. Article fallbacks use `?view=journal-story-ID`. `routes.root_url` preserves the Shopify locale root. Layout classes keep alternate index views from inheriting the overlapping homepage header. UI tabs/video controls have vi/en/ko/ja locale keys; native merchant translations still belong in Translate & Adapt.

The craft video plays muted only when in view, pauses outside the viewport or a hidden tab, and respects reduced motion. Watch story opens an accessible native dialog with controls and Escape/close support. Without JavaScript, the link opens the source MP4.

## Validation

`npm run test:helios-journal` renders every listing and all 74 article views; checks source counts, category/article/pagination routes and native-blog preference; then tests 390/1440px layout, local first-banner decoding, category/pagination/read-more navigation, observer/dialog behavior, reduced motion and runtime errors. Video playback is mocked in browser tests, and external CDN requests are blocked there; actual streaming is not claimed as tested. Shopify integration logs are still required to confirm store synchronization.
