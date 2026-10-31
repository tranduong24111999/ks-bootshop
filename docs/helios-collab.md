# HELIOS Collab

The original COLLAB menu opens https://helios.vn/blogs/collab, not the partnership page. The old theme resolved a missing partnership page to a search for `collab`, yielding an empty result screen.

The new section reproduces the source journal layout: black category bar, full-width editorial banner, dimming image hover, title/excerpt/read-more overlay, and responsive layout. If `blogs.collab` (or the blog selected in the section) has articles, its real Shopify articles, images, URLs, and pagination are used. No blog/article records are created in Admin.

When no store articles exist, it shows the actual first-page source story, “KHI LOGO BỨC TƯỜNG ĐƯỢC ĐÚC TỪ BẠC…”. The banner and three body images are stored locally. Read more opens the source story in the theme's `index.collab-story.json` alternate view, with a source attribution link and return navigation. The body is extracted from the published article with scripts, styles, event handlers, and the source's nonfunctional table-of-contents widget excluded. This is reference content, not an invented merchant announcement. Source URLs/date are recorded in `helios-collab-source.json`.

Routes: native `blogs.collab.url?view=collab` when available; explicitly chosen page `?view=collab` otherwise; `/?view=collab` as the theme-only fallback. Corresponding blog/page/index JSON templates exist. Native store article links are preserved. Footer links labeled Collab also use this resolver; other partnership links remain separate. Alternate index views get a normal, non-overlapping header.

UI labels and the fallback title/excerpt are supplied in vi/en/ko/ja. The full original article remains Vietnamese source content. Native Shopify article translations remain owned by Translate & Adapt; theme locale files do not translate blog records.

`npm run test:helios-collab` covers native/fallback routes, header links, native article preservation, read-more/return navigation, decoded source images, and 390/1440px overflow. Tests use local blog fixtures without mutating Shopify. GitHub integration logs are needed to confirm Shopify saved the update.

## Menu correction

The user subsequently clarified that the COLLAB menu itself should open World of Helios. `helios-collab-url` now delegates to `helios-journal-url` for `world-of-helios`. The standalone Collab reference views remain available without replacing existing data.
