/* Real theme components + local Shopify endpoint mocks. No requests mutate a Shopify store. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const { chromium } = require('playwright')
const { AxeBuilder } = require('@axe-core/playwright')
const { engine, renderSection, context, read, root } = require('./helios-homepage.cjs')
const artifacts = process.env.HELIOS_PRODUCT_ARTIFACTS || '/tmp/helios-product-tests'
fs.mkdirSync(artifacts, { recursive: true })
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const money = cents => (Number(cents) / 100).toLocaleString('vi-VN') + ' VND'
engine.registerFilter('json', value => JSON.stringify(value))
engine.registerFilter('money', money)
engine.registerFilter('money_without_trailing_zeros', money)
engine.registerFilter('payment_terms', () => '')
engine.registerFilter('video_tag', media => '<video controls preload="none" poster="' + escape(media.preview_image.src) + '"><source src="' + escape(media.sources?.find(s => s.format === 'mp4')?.url || '') + '" type="video/mp4"></video>')
const imageFiles = new Map()
const cache = process.env.HELIOS_PRODUCT_IMAGE_CACHE || '/workspace/helios-shopping-images'
if (fs.existsSync(path.join(cache, 'manifest.json'))) {
  for (const row of JSON.parse(fs.readFileSync(path.join(cache, 'manifest.json')))) imageFiles.set(row.url.split('?')[0], path.join(cache, row.file))
}
function imageUrl (url) {
  if (!url) return ''
  if (url.startsWith('//')) url = 'https:' + url
  if (!imageFiles.has(url.split('?')[0])) return url
  return '/test-image/' + encodeURIComponent(url.split('?')[0])
}
const original = JSON.parse(read('tests/fixtures/helios-product-reference.json')).product
const product = structuredClone(original)
product.images = original.images.map(src => ({ src: imageUrl(src), width: 1000, height: 1000, aspect_ratio: 1, alt: product.title }))
product.featured_image = product.images[0]
product.media = original.media.map((media, i) => ({ ...media, src: imageUrl(media.src), position: i + 1, alt: product.title, preview_image: { ...media.preview_image, src: imageUrl(media.preview_image.src), alt: product.title } }))
product.selected_or_first_available_variant = product.variants.find(variant => variant.available) || product.variants[0]
product.options_with_values = original.options.map((option, i) => ({ ...option, selected_value: product.selected_or_first_available_variant.options[i] }))
product.has_only_default_variant = product.variants.length === 1 && product.variants[0].title === 'Default Title'
product.collections = []
product.description = '' // The test does not invent/import a merchant description.
product.metafields = { descriptors: {}, reviews: {} }
const related = JSON.parse(read('tests/fixtures/helios-reference-products.json')).products.map(item => {
  item.images.forEach((src, i) => {
    const file = '/workspace/helios-reference-images/' + item.id + '-' + i + '.jpg'
    if (fs.existsSync(file)) imageFiles.set(src.split('?')[0], file)
  })
  return { ...item, images: item.images.map(src => ({ src: imageUrl(src) })), featured_image: { src: imageUrl(item.featured_image) }, metafields: { reviews: {} } }
})
const routes = { ...context.routes, cart_add_url: '/cart/add', cart_change_url: '/cart/change', cart_update_url: '/cart/update', product_recommendations_url: '/recommendations/products', predictive_search_url: '/search/suggest' }
Object.assign(context, { product, routes, request: { page_type: 'product', design_mode: false }, collections: { all: { products: related, products_count: related.length } } })
const waitFor = async (predicate, message) => { const deadline = Date.now() + 6000; while (Date.now() < deadline) { if (await predicate()) return; await new Promise(resolve => setTimeout(resolve, 50)) } throw new Error(message) }
async function main () {
  const template = JSON.parse(read('templates/product.json'))
  const mainSection = Object.entries(template.sections).find(([, section]) => section.type === 'product-main')
  const recSection = Object.entries(template.sections).find(([, section]) => section.type === 'helios-product-recommendations')
  const editorial = Object.entries(template.sections).find(([, section]) => section.type === 'helios-product-editorial')
  const mainMarkup = await renderSection(mainSection[0], mainSection[1], { product })
  const fallback = await renderSection(recSection[0], recSection[1], { product })
  assert(fallback.includes('data-product-id="' + related.find(p => p.id !== product.id).id + '"'))
  assert(!fallback.includes('<li class="helios-related__item" data-product-id="' + product.id + '"'))
  const emptyApi = await renderSection(recSection[0], recSection[1], { product, recommendations: { performed: true, products_count: 0, products: [] } })
  assert(emptyApi.includes('helios-related__item'), 'Empty recommendation API must retain actual catalog products')
  const noOthers = await renderSection(recSection[0], recSection[1], { product, collections: { all: { products: [product], products_count: 1 } } })
  assert(!noOthers.includes('CÓ THỂ BẠN SẼ THÍCH'), 'No other products must not render an empty heading')
  const picks = related.filter(p => p.id !== product.id).slice(0, 3)
  const personalized = await renderSection(recSection[0], recSection[1], { product, recommendations: { performed: true, products_count: picks.length, products: picks } })
  const editorialMarkup = await renderSection(editorial[0], editorial[1], { product })
  const footer = await renderSection('product-footer', { type: 'helios-footer', settings: {} }, { product })
  assert(!footer.includes('helios-newsletter'), 'Product page must not contain the homepage newsletter')
  const headerConfig = JSON.parse(read('sections/header-group.json')); const headerId = headerConfig.order[0]
  const header = await renderSection(headerId, headerConfig.sections[headerId], { product })
  const fonts = await engine.renderFile('helios-fonts')
  let quantity = 0
  let selectedId = product.selected_or_first_available_variant.id
  let addMode = 'ok'
  let changeMode = 'ok'
  let recommendationMode = 'empty'
  const requests = { adds: [], changes: [], checkout: [], recommendations: 0 }
  function cart () {
    return '<cart-container><div class="offcanvas-header"><h2 id="cart-label">Giỏ hàng</h2><button data-bs-dismiss="offcanvas" aria-label="Đóng giỏ hàng">×</button></div><div class="offcanvas-body"><div class="alert" role="alert" hidden><span data-alert-msg></span></div>' + (quantity ? '<p>' + escape(product.title) + '</p><label>Số lượng trong giỏ<input type="number" min="0" name="updates[]" data-line-item-key="line-' + selectedId + '" value="' + quantity + '"></label><button class="btn-line-item-remove" data-line-item-key="line-' + selectedId + '">Xóa khỏi giỏ</button><form action="/cart" method="post"><button name="checkout" value="1">Thanh toán</button></form>' : '<p>Giỏ hàng trống</p>') + '</div></cart-container>'
  }
  function sections () { return { 'cart-count-badge': '<span class="cart-count-badge">' + quantity + '</span>', 'offcanvas-cart': '<div id="offcanvas-cart">' + cart() + '</div>' } }
  const globals = { moneyFormat: '{{amount_no_decimals_with_comma_separator}} VND', routes }
  const theme = { locales: { product: { add_to_cart: 'Thêm vào giỏ hàng', buy_it_now: 'Mua ngay', sold_out: 'Hết hàng', unavailable: 'Không có mẫu này', save: 'Tiết kiệm', sale_price: 'Giá giảm' }, times: {}, accessibility: {} } }
  const html = '<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HELIOS product component test</title>' + fonts + ['vendor-bootstrap.min.css', 'vendor-swiper.bundle.min.css', 'base.css', 'product.css', 'cart.css', 'helios.css', 'helios-product.css'].map(name => '<link rel="stylesheet" href="/assets/' + name + '">').join('') + '<script>window.Shopify=' + JSON.stringify(globals) + ';window.theme=' + JSON.stringify(theme) + '</script>' + ['vendor-bootstrap.bundle.min.js', 'vendor-swiper.bundle.min.js', 'base.js', 'cart.js', 'product.js', 'helios.js', 'helios-product.js'].map(name => '<script src="/assets/' + name + '" defer></script>').join('') + '</head><body class="helios-theme page-type-product"><div id="header-group" class="sticky-top">' + header + '</div><main id="main">' + mainMarkup + fallback + editorialMarkup + '</main>' + footer + '<div id="offcanvas-cart" class="offcanvas offcanvas-end" tabindex="-1" aria-labelledby="cart-label">' + cart() + '</div><div id="offcanvas-search" class="offcanvas offcanvas-top" tabindex="-1" aria-label="Tìm kiếm"><div class="offcanvas-body"><form action="/search" role="search"><input name="q" aria-label="Tìm kiếm"><button>Tìm</button></form></div></div></body></html>'
  fs.writeFileSync(path.join(artifacts, 'product.html'), html)
  const mime = { '.css': 'text/css', '.js': 'application/javascript', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.ttf': 'font/ttf' }
  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname
    if (pathname.startsWith('/assets/') && !pathname.includes('..')) { const file = path.join(root, pathname); if (fs.existsSync(file)) { res.setHeader('Content-Type', mime[path.extname(file)]); return res.end(fs.readFileSync(file)) } res.writeHead(404); return res.end() }
    if (pathname.startsWith('/test-image/')) { const file = imageFiles.get(decodeURIComponent(pathname.slice('/test-image/'.length))); if (file) { res.setHeader('Content-Type', 'image/jpeg'); return res.end(fs.readFileSync(file)) } res.writeHead(404); return res.end() }
    if (pathname === '/recommendations/products') { requests.recommendations++; res.setHeader('Content-Type', 'text/html'); if (recommendationMode === 'error') { res.writeHead(500); return res.end('unavailable') } return res.end(recommendationMode === 'personalized' ? personalized : emptyApi) }
    let body = ''; for await (const chunk of req) body += chunk
    if (pathname === '/cart/add.js') {
      if (addMode === 'network') return req.destroy()
      res.setHeader('Content-Type', 'application/json')
      if (addMode === 'stock') { res.writeHead(422); return res.end(JSON.stringify({ description: 'Số lượng vượt tồn kho' })) }
      selectedId = Number(body.match(/name="id"\r\n\r\n(\d+)/)?.[1]); quantity = Number(body.match(/name="quantity"\r\n\r\n(\d+)/)?.[1] || 1)
      requests.adds.push({ id: selectedId, quantity }); return res.end(JSON.stringify({ id: selectedId, sections: sections() }))
    }
    if (pathname === '/cart/change.js') { if (changeMode === 'network') return req.destroy(); const data = JSON.parse(body); quantity = data.quantity; requests.changes.push(data); res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ sections: sections() })) }
    if (pathname === '/cart' && req.method === 'POST') { requests.checkout.push(body); res.writeHead(302, { Location: '/checkout' }); return res.end() }
    if (pathname.startsWith('/cart/')) { requests.checkout.push(pathname); res.setHeader('Content-Type', 'text/html'); return res.end('<title>Mock checkout permalink</title>') }
    res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(pathname === '/checkout' ? '<title>Mock checkout</title>' : html)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = 'http://127.0.0.1:' + server.address().port
  let browser, currentPage
  const errorLogs = []
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } } : {}) })
    const browserContext = await browser.newContext()
    const page = await browserContext.newPage(); currentPage = page
    await page.route('**/*.mp4*', route => route.abort())
    await page.route('**/cart/add.js', route => addMode === 'stall' ? undefined : addMode === 'network' ? route.abort('failed') : route.continue())
    await page.route('**/cart/change.js', route => changeMode === 'network' ? route.abort('failed') : route.continue())
    const errors = errorLogs; page.on('pageerror', error => errors.push(error.message))
    for (const width of [390, 1440]) {
      quantity = 0; addMode = 'ok'; changeMode = 'ok'; recommendationMode = 'empty'
      await page.setViewportSize({ width, height: 950 }); await page.goto(origin + product.url)
      await page.evaluate(() => document.fonts.ready)
      await page.locator('.swiper-slide-active img').first().evaluate(img => img.decode())
      if (!(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))) {
        console.log(await page.evaluate(() => [...document.querySelectorAll('.product-main .container,.product-contents,.product-contents>.row,.product-contents>.row>div,product-media-gallery,.swiper-main-wrapper,.swiper-main,.swiper-thumbs,.helios-related')].map(el => ({ class: el.className, x: el.getBoundingClientRect().x, width: el.getBoundingClientRect().width, scroll: el.scrollWidth, overflow: getComputedStyle(el).overflow }))))
        console.log(await page.evaluate(() => [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 2).slice(0, 12).map(el => ({ tag: el.tagName, class: el.className, width: el.getBoundingClientRect().width, right: el.getBoundingClientRect().right }))))
        await page.screenshot({ path: path.join(artifacts, 'overflow-' + width + '.png'), fullPage: true })
        throw new Error('Product page horizontal overflow at ' + width)
      }
      assert(await page.locator('.helios-related__item').count() > 0, 'Recommendations fallback must be visible before API results')
      assert.equal(await page.locator('product-media-gallery').evaluate(el => el.thumbs.params.direction), width >= 1024 ? 'vertical' : 'horizontal')
      await page.locator('[data-gallery-zoom]').click(); await page.locator('.helios-gallery-dialog[open]').waitFor(); await page.keyboard.press('Escape'); assert.equal(await page.locator('.helios-gallery-dialog').evaluate(el => el.open), false)
      await page.locator('.swiper-main .swiper-button-next').click(); await page.waitForTimeout(400)
      assert.equal(await page.locator('product-media-gallery').evaluate(el => el.main.activeIndex), 1)
      await page.locator('.swiper-main .swiper-button-next').click(); await page.waitForTimeout(400)
      assert.equal(await page.locator('[data-gallery-zoom]').isDisabled(), true, 'Video slide must disable image zoom')
      await page.locator('.swiper-main .swiper-button-prev').click(); await page.waitForTimeout(400)
      await page.evaluate(() => dispatchEvent(new CustomEvent('kt.product.variant.change', { detail: null })))
      const radios = page.locator('product-form .product-options input[type="radio"]')
      const choose = async index => { const id = await radios.nth(index).getAttribute('id'); await page.locator('label[for="' + id + '"]').click() }
      await choose(1)
      assert.equal(await page.locator('product-form [name="id"]').inputValue(), String(product.variants[1].id))
      assert.equal(new URL(page.url()).searchParams.get('variant'), String(product.variants[1].id))
      assert((await page.locator('.product-price-final').textContent()).includes(money(product.variants[1].price)))
      await page.locator('[data-quantity-change="1"]').click(); assert.equal(await page.locator('product-form [name="quantity"]').inputValue(), '2')
      await page.locator('.btn-atc').click(); await page.locator('#offcanvas-cart.show').waitFor(); await waitFor(() => quantity === 2, 'Cart add not received')
      assert.deepEqual(requests.adds.at(-1), { id: product.variants[1].id, quantity: 2 }); assert.equal((await page.locator('.cart-count-badge').textContent()).trim(), '2')
      changeMode = 'network'; await page.locator('[name="updates[]"]').fill('3'); await page.locator('[name="updates[]"]').dispatchEvent('change'); await page.locator('cart-container .alert:not([hidden])').waitFor(); assert.equal(await page.locator('cart-container').evaluate(el => el.classList.contains('loading')), false)
      changeMode = 'ok'; await page.locator('[name="updates[]"]').fill('1'); await page.locator('[name="updates[]"]').dispatchEvent('change'); await waitFor(() => quantity === 1, 'Cart change not received')
      await page.locator('.btn-line-item-remove').click(); await waitFor(() => quantity === 0, 'Cart remove not received'); await page.getByText('Giỏ hàng trống', { exact: true }).waitFor()
      await page.locator('#offcanvas-cart [data-bs-dismiss]').click(); await page.locator('#offcanvas-cart').waitFor({ state: 'hidden' })
      addMode = 'stock'; await page.locator('.btn-atc').click(); await page.locator('product-form .product-form-error').filter({ hasText: 'Số lượng vượt tồn kho' }).waitFor(); assert.equal(await page.locator('.btn-atc').isEnabled(), true)
      await page.locator('#offcanvas-cart [data-bs-dismiss]').click(); await page.locator('#offcanvas-cart').waitFor({ state: 'hidden' })
      addMode = 'network'; await page.locator('.btn-atc').click(); await page.locator('product-form .product-form-error').filter({ hasText: 'Không thể kết nối' }).waitFor(); assert.equal(await page.locator('.btn-atc').getAttribute('aria-busy'), 'false')
      addMode = 'ok'; await page.locator('product-form [name="quantity"]').fill('0'); const before = requests.adds.length; await page.locator('.btn-atc').click(); assert.equal(requests.adds.length, before)
      await page.locator('product-form [name="quantity"]').fill('1')
      await page.locator('product-form').evaluate(el => { el.variants[1].available = false }); await choose(0); await choose(1); assert.equal(await page.locator('.btn-atc').isDisabled(), true); assert.equal(await page.locator('.btn-buy').isDisabled(), true)
      const oldValue = await radios.nth(0).inputValue(); await radios.nth(0).evaluate(el => { el.value = 'invalid-combination' }); await choose(0); assert.equal(await page.locator('product-form [name="id"]').inputValue(), '')
      await radios.nth(0).evaluate((el, value) => { el.value = value }, oldValue); await page.locator('product-form').evaluate(el => { el.variants[1].available = true }); await choose(1)
      await page.locator('.product-block-collapse button').first().click(); await page.locator('.product-block-collapse .collapse.show').first().waitFor()
      await page.locator('.helios-product-faq__item > summary').first().click(); assert.equal(await page.locator('.helios-product-faq__item').first().evaluate(el => el.open), true)
      await page.locator('.helios-related').scrollIntoViewIfNeeded(); await waitFor(() => requests.recommendations > 0, 'Recommendation API not requested'); assert(await page.locator('.helios-related__item').count() > 0)
      await page.locator('.product-form-error').evaluate(el => { el.hidden = true }); await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(700)
      await page.screenshot({ path: path.join(artifacts, 'product-' + width + '.png'), fullPage: true })
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze(); assert.deepEqual(axe.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })), [], 'Product accessibility at ' + width)
      console.log('PASS: ' + width + 'px — real variant selection, price, quantity, zoom/gallery, cart add/change/remove, 422/network recovery, unavailable options, accordion/FAQ, fallback recommendations')
    }
    addMode = 'stall'; await page.clock.install(); await page.goto(origin + product.url)
    await page.locator('.btn-atc').click(); assert.equal(await page.locator('.btn-atc').isDisabled(), true)
    await page.clock.fastForward(10100)
    await page.locator('product-form .product-form-error').filter({ hasText: 'Không thể kết nối' }).waitFor()
    assert.equal(await page.locator('.btn-atc').isEnabled(), true, 'A stalled cart API must time out and release the submit button')
    addMode = 'ok'
    console.log('PASS: stalled cart request aborts after ten seconds and releases the button')
    recommendationMode = 'personalized'; await page.reload(); await page.locator('.helios-related').scrollIntoViewIfNeeded(); await waitFor(async () => await page.locator('helios-recommendations').getAttribute('data-personalized') === 'true', 'Personalized recommendations not applied'); assert.equal(await page.locator('.helios-related__item').count(), 3)
    recommendationMode = 'error'; await page.reload(); await page.locator('.helios-related').scrollIntoViewIfNeeded(); assert(await page.locator('.helios-related__item').count() > 0)
    await page.locator('.btn-buy').click(); await page.waitForURL('**/cart/*:*'); assert(page.url().endsWith('/cart/' + product.selected_or_first_available_variant.id + ':1'))
    await page.goto(origin + product.url)
    await page.locator('.btn-atc').click(); await page.locator('#offcanvas-cart.show').waitFor()
    await page.locator('#offcanvas-cart button[name="checkout"]').click(); await page.waitForURL('**/checkout')
    assert(requests.checkout.some(body => body.includes('checkout=1')), 'Checkout form must submit the Shopify checkout field')
    const noJs = await browser.newContext({ javaScriptEnabled: false })
    const fallbackPage = await noJs.newPage(); await fallbackPage.goto(origin + product.url)
    const nativeSelect = fallbackPage.locator('noscript select[name="id"]')
    await nativeSelect.selectOption(String(product.variants[1].id))
    const nativePayload = await nativeSelect.evaluate(el => Object.fromEntries(new FormData(el.form)))
    assert.equal(nativePayload.id, String(product.variants[1].id), 'No-JavaScript selection must submit the chosen variant')
    assert.equal(await fallbackPage.locator('[data-variant-id]').isDisabled(), true)
    assert.deepEqual(errors, [], 'Shopping page runtime errors')
    console.log('PASS: personalized API replacement, empty/error fallback, buy-now permalink, checkout form route, no-JavaScript SKU selection, zero runtime errors. Checkout/payment itself was not executed.')
  } catch (error) {
    console.log('RUNTIME', errorLogs, 'REQUESTS', requests)
    if (currentPage) {
      console.log(await currentPage.locator('cart-container').evaluate(el => ({ constructor: el.constructor.name, class: el.className, html: el.innerHTML.slice(0, 1600) })).catch(() => null))
      await currentPage.screenshot({ path: path.join(artifacts, 'failure.png'), fullPage: true }).catch(() => {})
    }
    throw error
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)) }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
