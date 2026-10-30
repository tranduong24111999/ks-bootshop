# HELIOS storefront languages

The theme ships `vi.json`, `en.default.json`, `ko.json`, and `ja.json`. Existing KS BootShop interface keys have translations in all four files. HELIOS interface keys cover navigation, search, product controls, recommendations, gallery, newsletter, footer, announcements, and the shipped product FAQ defaults.

The header uses Shopify's native localization POST form. It always displays the language button and all four native language names. Only languages Shopify exposes in `localization.available_languages` are enabled; unavailable languages are labeled and disabled. It reads Shopify’s `endonym_name` field, with native labels as a fallback. Desktop has a black dropdown; mobile has the same control inside the menu. Native form submission works without JavaScript. Shopify handles the language URL and current-page redirect.

`helios-text` translates recognized shipped Vietnamese defaults while leaving merchant-authored and Shopify-translated settings intact. It does not translate product records or alter catalog data. Rich-text fallbacks preserve the existing Shopify content.

## Store configuration still required

1. Settings → Languages: add Vietnamese, English, Korean, and Japanese as needed and publish them. Choose the store's primary language deliberately; changing it is not part of this code update.
2. In Markets, enable the relevant languages for the storefront market/domain.
3. Use Shopify Translate & Adapt for product titles/descriptions, collection names, navigation menus, pages/policies, custom section settings, SEO content, and app content where supported. Theme locale files do not translate this merchant data or checkout/app interfaces.
4. Test each language from a real product URL: the selected language, translated product data, cart, and checkout must be checked in the authorized store.

The current environment's Theme Access credential returns 401, and Theme Access alone is not authorization to manage store languages. No Admin language/market settings were changed by this update.

## Validation

`npm run test:helios-languages` checks locale key/interpolation parity, translation rendering in all four languages, published-language filtering, current selection, and native localization form markup. Homepage/product browser suites cover responsive layout and shopping regressions with local endpoint mocks; they do not claim to execute Shopify's server-side language switch or checkout.
