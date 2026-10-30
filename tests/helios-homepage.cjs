/* Local Liquid/component tests. These do not emulate Shopify checkout or Admin. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const { Liquid } = require('liquidjs')
const { chromium } = require('playwright')
const { AxeBuilder } = require('@axe-core/playwright')

const root = path.resolve(__dirname, '..')
const artifacts = process.env.HELIOS_TEST_ARTIFACTS || '/tmp/helios-test-artifacts'
fs.mkdirSync(artifacts, { recursive: true })
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const engine = new Liquid({ root: path.join(root, 'snippets'), extname: '.liquid' })
engine.registerFilter('asset_url', name => '/assets/' + name)
engine.registerFilter('url_encode', value => encodeURIComponent(value))
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
engine.registerFilter('preload_tag', (url, ...args) => '<link rel="preload" href="' + url + '" ' + args.map(([k, v]) => k + '="' + escapeHtml(v) + '"').join(' ') + '>')
engine.registerFilter('handleize', value => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-'))
engine.registerFilter('t', value => value === 'general.accessibility.social_media_links' ? 'Mạng xã hội' : value)
engine.registerFilter('image_url', image => image?.src || image || '')
engine.registerFilter('image_tag', (url, ...args) => {
  const attributes = Object.fromEntries(args)
  delete attributes.widths
  return '<img src="' + escapeHtml(url) + '" width="1000" height="1000" ' + Object.entries(attributes).map(([k, v]) => k + '="' + escapeHtml(v) + '"').join(' ') + '>'
})
engine.registerFilter('money_with_currency', value => (Number(value) / 100).toLocaleString('vi-VN') + ' VND')

const routes = {
  root_url: '/', all_products_collection_url: '/collections/all',
  collections_url: '/collections', search_url: '/search',
  cart_url: '/cart', account_url: '/account'
}
const context = {
  routes, collections: { all: { products_count: 0, products: [] } },
  shop: { customer_accounts_enabled: true, enabled_payment_types: [], policies: [] },
  cart: { item_count: 0 }, request: { design_mode: false }, form: {}, pages: {}, blogs: {},
  settings: JSON.parse(read('config/settings_data.json')).current
}
// Shopify exposes these globals inside isolated {% render %} snippet scopes.
engine.options.globals = context
async function renderSection (id, config, extra = {}) {
  let source = read('sections/' + config.type + '.liquid')
  const schema = JSON.parse(source.match(/{% schema %}([\s\S]*?){% endschema %}/)[1])
  source = source.replace(/{% schema %}[\s\S]*?{% endschema %}/, '')
  // Shopify owns customer form generation and submission; test its inner fields locally.
  source = source.replace(/{% form '(customer|localization|product)'[^%]*%}/g, (match, type) => type === 'product'
    ? '<form action="/cart/add" method="post" id="ProductForm-' + extra.product.id + '" data-productid="' + extra.product.id + '" data-variants="' + escapeHtml(JSON.stringify(extra.product.variants)) + '">'
    : '<form action="/contact" method="post">')
    .replace(/{% endform %}/g, '</form>')
  const defaults = fields => Object.fromEntries((fields || []).filter(s => s.default !== undefined).map(s => [s.id, s.default]))
  const blocks = (config.block_order || []).filter(key => !config.blocks[key].disabled && !config.blocks[key].type.startsWith('shopify://')).map(key => {
    const block = config.blocks[key]
    const definition = schema.blocks.find(b => b.type === block.type)
    return { id: key, type: block.type, settings: { ...defaults(definition?.settings), ...block.settings } }
  })
  const scope = { ...context, ...extra, section: { id, settings: { ...defaults(schema.settings), ...config.settings }, blocks } }
  engine.options.globals = scope
  return engine.parseAndRender(source, scope)
}

async function main () {
  for (const directory of ['config', 'locales', 'sections', 'templates']) {
    for (const file of fs.readdirSync(path.join(root, directory))) {
      if (file.endsWith('.json')) JSON.parse(read(directory + '/' + file))
    }
  }
  require('postcss').parse(read('assets/helios.css'))
  const template = JSON.parse(read('templates/index.json'))
  const header = JSON.parse(read('sections/header-group.json'))
  const footer = JSON.parse(read('sections/footer-group.json'))
  let markup = ''
  for (const [group, isHeader] of [[header, true], [template, false], [footer, false]]) {
    let contents = ''
    for (const id of group.order) { if (!group.sections[id].disabled) contents += await renderSection(id, group.sections[id]) }
    markup += isHeader ? '<div id="header-group" class="sticky-top">' + contents + '</div><main id="main">' : contents
    if (group === template) markup += '</main>'
  }
  // Empty live catalogs must not produce demo cards or pretend products exist.
  assert(!markup.includes('product-card'), 'Empty catalog must not render products')
  const emptyEditor = await renderSection('empty', { type: 'helios-products', settings: {} }, { request: { design_mode: true } })
  assert(emptyEditor.includes('Theme không tạo sản phẩm mẫu'))
  const collectionMarkup = await renderSection('selected', {
    type: 'helios-collections', settings: {}, blocks: { tile: { type: 'collection', settings: { title: 'Danh mục đã chọn', collection: { url: '/collections/existing-collection', title: 'Danh mục đã chọn' } } } }, block_order: ['tile']
  })
  assert(collectionMarkup.includes('href="/collections/existing-collection"'), 'Selected collection must take priority over search fallback')
  assert(!collectionMarkup.includes('href="/search?'), 'Selected collection must not use fallback search')
  if (process.env.HELIOS_REFERENCE_CATALOG === '1') {
    const captured = JSON.parse(read('tests/fixtures/helios-reference-products.json'))
    const products = captured.products.map(product => ({
      ...product,
      images: product.images.map((src, i) => ({ src: process.env.HELIOS_REFERENCE_IMAGE_CACHE ? '/reference-assets/' + product.id + '-' + i + '.jpg' : src })),
      featured_image: { src: process.env.HELIOS_REFERENCE_IMAGE_CACHE ? '/reference-assets/' + product.id + '-0.jpg' : product.featured_image },
      metafields: { reviews: {} }
    }))
    const productSection = await renderSection('reference-products', { type: 'helios-products', settings: { limit: 8 } }, { collections: { all: { products_count: products.length, products, url: '/collections/all' } } })
    markup = markup.replace('</main>', productSection + '</main>')
    // Put the catalog back between hero and categories, just like the reference.
    markup = markup.replace(productSection, '').replace('<section class="helios-collections', productSection + '<section class="helios-collections')
  }
  const productTemplate = JSON.parse(read('templates/product.json'))
  const productSettings = Object.values(productTemplate.sections).find(section => section.type === 'product-main')
  const tabBlocks = Object.entries(productSettings.blocks).map(([id, block]) => ({ id, ...block }))
  const tabFixture = await engine.renderFile('helios-product-tabs', { blocks: tabBlocks, section_id: 'component-test', style: 'tabs', product: { description: '' } })
  markup += '<div hidden id="tab-test-fixture">' + tabFixture + '</div>'
  const fonts = await engine.renderFile('helios-fonts')
  const html = '<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HELIOS component validation</title>' +
    fonts + '<link rel="stylesheet" href="/assets/vendor-bootstrap.min.css"><link rel="stylesheet" href="/assets/base.css"><link rel="stylesheet" href="/assets/helios.css">' +
    '<script src="/assets/vendor-bootstrap.bundle.min.js" defer></script><script src="/assets/helios.js" defer></script></head><body class="helios-theme page-type-index">' + markup +
    '<div class="offcanvas offcanvas-end" id="offcanvas-cart" tabindex="-1" aria-label="Giỏ hàng"><div class="offcanvas-body">Giỏ hàng<button data-bs-dismiss="offcanvas">Đóng</button></div></div><div class="offcanvas offcanvas-top" id="offcanvas-search" tabindex="-1" aria-label="Tìm kiếm"><div class="offcanvas-body"><form action="/search" role="search"><input name="q" type="search" aria-label="Tìm kiếm chế tác"><button>Tìm kiếm</button></form><button data-bs-dismiss="offcanvas">Đóng tìm kiếm</button></div></div></body></html>'
  fs.writeFileSync(path.join(artifacts, 'rendered.html'), html)
  const mime = { '.css': 'text/css', '.js': 'application/javascript', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.ttf': 'font/ttf' }
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/reference-assets/') && process.env.HELIOS_REFERENCE_IMAGE_CACHE && !req.url.includes('..')) {
      const file = path.join(process.env.HELIOS_REFERENCE_IMAGE_CACHE, path.basename(req.url))
      if (fs.existsSync(file)) { res.setHeader('Content-Type', 'image/jpeg'); return res.end(fs.readFileSync(file)) }
      res.writeHead(404); return res.end()
    }
    if (req.url.startsWith('/assets/') && !req.url.includes('..')) {
      const file = path.join(root, req.url.split('?')[0])
      if (fs.existsSync(file)) { res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); return res.end(fs.readFileSync(file)) }
      res.writeHead(404); return res.end()
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.HELIOS_REFERENCE_CATALOG && !process.env.HELIOS_REFERENCE_IMAGE_CACHE && process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } } : {}) })
    const browserContext = await browser.newContext()
    const page = await browserContext.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const origin = 'http://127.0.0.1:' + server.address().port
    for (const width of [320, 375, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(origin)
      await page.locator('.helios-logo img').waitFor()
      await page.evaluate(() => document.fonts.ready)
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal overflow at ' + width)
      assert.equal(await page.locator('h1').count(), 1)
      assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(0, 0, 0)')
      assert(await page.evaluate(() => document.fonts.check('15px "Helios Futura"')), 'Reference body font must load')
      assert(await page.evaluate(() => document.fonts.check('15px "Helios Copperplate"')), 'Reference heading font must load')
      if (width >= 768) {
        const navigation = page.locator('.helios-header__inner')
        await page.mouse.move(0, 890)
        await page.waitForTimeout(350)
        assert.equal(await navigation.evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)', 'Header must be fully transparent without hover')
        await page.locator('.helios-logo').hover()
        await page.waitForTimeout(350)
        assert.equal(await navigation.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(0, 0, 0)', 'Header must turn black on hover')
        await page.mouse.move(0, 890)
        await page.waitForTimeout(350)
        assert.equal(await navigation.evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)', 'Header must return to transparent after pointer leaves')
      }
      const expectedHeroHeight = width < 768 ? width * 1.25 : width * 900 / 1900
      assert(Math.abs((await page.locator('.helios-hero').boundingBox()).height - expectedHeroHeight) < 2, 'Hero geometry must match the reference')
      if (width < 768) {
        const firstTile = await page.locator('.helios-collection-tile--1').boundingBox()
        const tallTile = await page.locator('.helios-collection-tile--3').boundingBox()
        assert(Math.abs(firstTile.height - width * 1.25) < 2, 'First mobile tiles must use reference 4:5 ratio')
        assert(Math.abs(tallTile.height - width * 1.5) < 2, 'Remaining mobile tiles must use reference 2:3 ratio')
      }
      const columns = await page.locator('.helios-collection-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)
      assert.equal(columns, width < 768 ? 1 : 2, 'Collection layout must match the reference')
      assert(await page.locator('.helios-cart svg path').count() > 0, 'Cart icon must be visible')
      assert.equal((await page.locator('.cart-count-badge').textContent()).trim(), '0')
      if (process.env.HELIOS_REFERENCE_CATALOG === '1') {
        assert.equal(await page.locator('.helios-product-card:visible').count(), width < 768 ? 4 : 8)
        const firstImage = page.locator('.helios-product-card__first').first()
        await firstImage.scrollIntoViewIfNeeded()
        await firstImage.evaluate(img => img.decode())
        if (width >= 768) {
          await page.locator('.helios-product-card__media').first().hover()
          await page.waitForTimeout(650)
          assert.equal(await page.locator('.helios-product-card__second').first().evaluate(el => getComputedStyle(el).opacity), '1')
          await page.screenshot({ path: path.join(artifacts, 'product-hover-' + width + '.png') })
        }
        await page.evaluate(() => scrollTo(0, 0))
      }
      const hero = page.locator('.helios-hero')
      await hero.locator('[data-helios-toggle]').click()
      const heroSource = await hero.locator('.is-active img').evaluate(img => img.currentSrc)
      assert(heroSource.includes(width < 768 ? 'mobile' : 'desktop'), 'Incorrect hero source at ' + width)
      await hero.locator('[data-helios-dot="1"]').click()
      assert.equal(await hero.locator('[data-helios-status]').textContent(), '2 / 3')
      await hero.locator('[data-helios-dot="2"]').click()
      assert.equal(await hero.locator('[data-helios-status]').textContent(), '3 / 3')
      await hero.locator('[data-helios-dot="0"]').click()
      assert.equal(await hero.locator('[data-helios-status]').textContent(), '1 / 3')
      await hero.locator('[data-helios-dot="2"]').click()
      assert.equal(await hero.locator('[data-helios-status]').textContent(), '3 / 3')
      const summary = page.locator('[data-helios-menu] > summary')
      if (width >= 768) {
        await page.waitForTimeout(1500)
        await summary.hover()
        await page.waitForTimeout(300)
        assert(await page.locator('[data-helios-menu]').evaluate(el => el.open), 'Desktop mega menu must open on hover')
        await page.screenshot({ path: path.join(artifacts, 'menu-' + width + '.png') })
        await page.mouse.move(0, 890)
        await page.waitForTimeout(200)
        assert.equal(await page.locator('[data-helios-menu]').evaluate(el => el.open), false)
      }
      await summary.focus(); await page.keyboard.press('Enter')
      assert(await page.locator('[data-helios-menu]').evaluate(el => el.open))
      await page.keyboard.press('Escape')
      assert.equal(await page.locator('[data-helios-menu]').evaluate(el => el.open), false)
      assert(await summary.evaluate(el => el === document.activeElement))
      await page.locator('.helios-cart').click()
      await page.locator('#offcanvas-cart.show').waitFor()
      await page.locator('#offcanvas-cart [data-bs-dismiss="offcanvas"]').click()
      await page.locator('#offcanvas-cart').waitFor({ state: 'hidden' })
      await page.locator('.helios-header__actions a[aria-label="Tìm kiếm"]').click()
      await page.locator('#offcanvas-search.show').waitFor()
      await page.locator('#offcanvas-search [data-bs-dismiss="offcanvas"]').click()
      await page.locator('#offcanvas-search').waitFor({ state: 'hidden' })
      const invalidLinks = await page.locator('a').evaluateAll(links => links.map(a => a.getAttribute('href')).filter(href => !href || href === '#' || (!(href.startsWith('#') && document.getElementById(href.slice(1))) && !href.startsWith('/') && !href.startsWith('mailto:') && !href.startsWith('tel:') && href !== 'http://online.gov.vn/Home/WebDetails/140048' && !/^https:\/\/(www\.)?(facebook\.com|youtube\.com|instagram\.com|tiktok\.com|pinterest\.com)\//.test(href))))
      assert.deepEqual(invalidLinks, [], 'Invalid internal links')
      const email = page.locator('input[type="email"]')
      assert.equal(await email.evaluate(el => el.checkValidity()), false)
      await email.fill('invalid')
      assert.equal(await email.evaluate(el => el.checkValidity()), false)
      await email.fill('review@example.com')
      assert.equal(await email.evaluate(el => el.checkValidity()), true)
      const payload = await email.evaluate(el => Object.fromEntries(new FormData(el.form)))
      assert.equal(payload['contact[email]'], 'review@example.com')
      assert.equal(payload['contact[tags]'], 'newsletter')
      await email.fill('')
      await email.blur()
      await hero.locator('[data-helios-dot="0"]').click()
      await hero.locator('[data-helios-toggle]').click()
      await page.locator('.helios-logo').focus()
      await page.evaluate(() => scrollTo(0, 0))
      await page.mouse.move(0, 890)
      await page.waitForTimeout(1500)
      await page.screenshot({ path: path.join(artifacts, 'homepage-' + width + '.png'), fullPage: true })
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
      assert.deepEqual(axe.violations.map(v => ({ id: v.id, elements: v.nodes.map(n => n.target) })), [], 'Accessibility violations at ' + width)
      console.log('PASS: ' + width + 'px — responsive assets, no overflow, carousel, menu keyboard, cart drawer, routes, newsletter fields, axe WCAG AA')
    }
    await page.locator('#tab-test-fixture').evaluate(el => { el.hidden = false })
    const tabFixture = page.locator('#tab-test-fixture')
    const tabs = tabFixture.getByRole('tab')
    await tabs.nth(1).click()
    assert.equal(await tabs.nth(1).getAttribute('aria-selected'), 'true')
    assert.equal(await tabFixture.getByRole('tabpanel').count(), 1)
    await page.keyboard.press('ArrowRight')
    assert.equal(await tabs.nth(2).getAttribute('aria-selected'), 'true')
    await page.keyboard.press('Home')
    assert.equal(await tabs.first().getAttribute('aria-selected'), 'true')
    await page.keyboard.press('End')
    assert.equal(await tabs.last().getAttribute('aria-selected'), 'true')
    await page.locator('#tab-test-fixture').evaluate(el => { el.hidden = true })
    console.log('PASS: configurable product tabs, mouse selection and keyboard arrows/Home/End')
    // Exercise the real timer deterministically, including suspension conditions.
    await page.clock.install()
    await page.goto(origin)
    await page.mouse.move(0, 0)
    const rotating = page.locator('.helios-hero')
    const activeIndex = () => rotating.evaluate(el => el.index)
    const announcements = page.locator('.helios-announcement')
    await page.clock.fastForward(4900)
    assert.equal(await announcements.evaluate(el => el.index), 0, 'Announcement must wait for five seconds')
    await page.clock.fastForward(200)
    assert.equal(await announcements.evaluate(el => el.index), 1, 'Announcement must rotate without clicking')
    await page.clock.fastForward(2000)
    assert.equal(await activeIndex(), 1, 'Banner must autoplay after seven seconds')
    const blend = await rotating.evaluate(el => {
      const animation = el.transition
      animation.pause()
      animation.currentTime = 700
      const incoming = el.slides[el.index]
      const outgoing = el.slides[(el.index + el.slides.length - 1) % el.slides.length]
      const result = { duration: animation.effect.getTiming().duration, opacity: Number(getComputedStyle(incoming).opacity), underneath: Number(getComputedStyle(outgoing).opacity), visible: !outgoing.hidden, transforms: animation.effect.getKeyframes().some(frame => frame.transform) }
      animation.finish()
      return result
    })
    assert.equal(blend.duration, 1400)
    assert(blend.opacity > 0 && blend.opacity < 1, 'Incoming image must be partially transparent mid-transition')
    assert.equal(blend.underneath, 1, 'Outgoing image must remain opaque underneath to avoid black flashes')
    assert.equal(blend.visible, true)
    assert.equal(blend.transforms, false, 'Hero must blend instead of sliding a whole image across the screen')
    console.log('PASS: five-second announcement autoplay and 1.4-second image blend with no black gap')
    await rotating.hover()
    await page.clock.fastForward(7100)
    assert.equal(await activeIndex(), 2, 'Banner must keep rotating while the pointer rests over it')
    await page.mouse.move(0, 0)
    await page.keyboard.press('Tab')
    await rotating.locator('[data-helios-dot="1"]').focus()
    await page.clock.fastForward(7100)
    assert.equal(await activeIndex(), 2, 'Keyboard focus must pause autoplay')
    await rotating.locator('[data-helios-toggle]').click()
    await page.locator('.helios-logo').focus()
    await page.mouse.move(0, 0)
    await page.clock.fastForward(7100)
    assert.equal(await activeIndex(), 2, 'Pause button must stop autoplay')
    await rotating.locator('[data-helios-toggle]').click()
    await page.clock.fastForward(7100)
    assert.equal(await activeIndex(), 0, 'Resume must restart autoplay with the pointer still on the button')
    await page.setViewportSize({ width: 390, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    assert.equal(await page.locator('.helios-collection-tile img').first().evaluate(el => getComputedStyle(el).transitionDuration), '1e-05s')
    const reducedIndex = await activeIndex()
    await page.clock.fastForward(10000)
    assert.equal(await activeIndex(), reducedIndex, 'Reduced motion must disable autoplay')
    assert.equal(await rotating.locator('[data-helios-toggle]').isVisible(), false)
    console.log('PASS: seven-second autoplay while hovered, keyboard focus pause, pointer pause/resume control, reduced-motion timer suppression')
    const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 900 } })
    const fallback = await noJs.newPage(); await fallback.goto(origin)
    await fallback.locator('[data-helios-menu] > summary').click()
    assert(await fallback.locator('[data-helios-menu]').evaluate(el => el.open))
    assert.equal(await fallback.locator('.helios-hero__controls').isVisible(), false)
    assert.equal(await fallback.locator('.helios-cart').getAttribute('href'), '/cart')
    assert.deepEqual(errors, [], 'Browser runtime errors')
    console.log('PASS: reduced motion, no-JavaScript menu/cart fallbacks, zero browser errors')
    console.log('Local component artifacts: ' + artifacts + '. Shopify product/checkout validation requires store authorization.')
  } finally {
    if (browser) await browser.close()
    await new Promise(resolve => server.close(resolve))
  }
}
module.exports = { engine, renderSection, context, read, root }
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1 })
