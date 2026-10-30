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

const routes = {
  root_url: '/', all_products_collection_url: '/collections/all',
  collections_url: '/collections', search_url: '/search',
  cart_url: '/cart', account_url: '/account'
}
const context = {
  routes, collections: { all: { products_count: 0, products: [] } },
  shop: { customer_accounts_enabled: true, enabled_payment_types: [], policies: [] },
  cart: { item_count: 0 }, request: { design_mode: false }, form: {},
  settings: JSON.parse(read('config/settings_data.json')).current
}
// Shopify exposes these globals inside isolated {% render %} snippet scopes.
engine.options.globals = context
async function renderSection (id, config, extra = {}) {
  let source = read('sections/' + config.type + '.liquid')
  const schema = JSON.parse(source.match(/{% schema %}([\s\S]*?){% endschema %}/)[1])
  source = source.replace(/{% schema %}[\s\S]*?{% endschema %}/, '')
  // Shopify owns customer form generation and submission; test its inner fields locally.
  source = source.replace(/{% form 'customer'[^%]*%}/g, '<form action="/contact" method="post">')
    .replace(/{% endform %}/g, '</form>')
  const defaults = fields => Object.fromEntries((fields || []).filter(s => s.default !== undefined).map(s => [s.id, s.default]))
  const blocks = (config.block_order || []).map(key => {
    const block = config.blocks[key]
    const definition = schema.blocks.find(b => b.type === block.type)
    return { id: key, type: block.type, settings: { ...defaults(definition.settings), ...block.settings } }
  })
  return engine.parseAndRender(source, { ...context, ...extra, section: { id, settings: { ...defaults(schema.settings), ...config.settings }, blocks } })
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
    for (const id of group.order) contents += await renderSection(id, group.sections[id])
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
  const html = '<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HELIOS component validation</title>' +
    '<link rel="stylesheet" href="/assets/vendor-bootstrap.min.css"><link rel="stylesheet" href="/assets/base.css"><link rel="stylesheet" href="/assets/helios.css">' +
    '<script src="/assets/vendor-bootstrap.bundle.min.js" defer></script><script src="/assets/helios.js" defer></script></head><body class="helios-theme">' + markup +
    '<div class="offcanvas offcanvas-end" id="offcanvas-cart" tabindex="-1" aria-label="Giỏ hàng"><div class="offcanvas-body">Giỏ hàng<button data-bs-dismiss="offcanvas">Đóng</button></div></div></body></html>'
  fs.writeFileSync(path.join(artifacts, 'rendered.html'), html)
  const mime = { '.css': 'text/css', '.js': 'application/javascript', '.webp': 'image/webp', '.jpg': 'image/jpeg' }
  const server = http.createServer((req, res) => {
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
    browser = await chromium.launch({ headless: true })
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
      assert(await page.locator('.helios-cart svg path').count() > 0, 'Cart icon must be visible')
      assert.equal((await page.locator('.cart-count-badge').textContent()).trim(), '0')
      const heroSource = await page.locator('[data-helios-slide]:not([hidden]) img').evaluate(img => img.currentSrc)
      assert(heroSource.includes(width < 750 ? 'mobile' : 'desktop'), 'Incorrect hero source at ' + width)
      await page.locator('[data-helios-next]').click()
      assert.equal(await page.locator('[data-helios-status]').textContent(), '2 / 2')
      await page.locator('[data-helios-next]').click()
      assert.equal(await page.locator('[data-helios-status]').textContent(), '1 / 2')
      await page.locator('[data-helios-prev]').click()
      assert.equal(await page.locator('[data-helios-status]').textContent(), '2 / 2')
      const summary = page.locator('[data-helios-menu] > summary')
      await summary.focus(); await page.keyboard.press('Enter')
      assert(await page.locator('[data-helios-menu]').evaluate(el => el.open))
      await page.keyboard.press('Escape')
      assert.equal(await page.locator('[data-helios-menu]').evaluate(el => el.open), false)
      assert(await summary.evaluate(el => el === document.activeElement))
      await page.locator('.helios-cart').click()
      await page.locator('#offcanvas-cart.show').waitFor()
      await page.locator('[data-bs-dismiss="offcanvas"]').click()
      await page.locator('#offcanvas-cart').waitFor({ state: 'hidden' })
      const invalidLinks = await page.locator('a').evaluateAll(links => links.map(a => a.getAttribute('href')).filter(href => !href || href === '#' || (!href.startsWith('/') && !href.startsWith('mailto:') && !href.startsWith('tel:'))))
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
      await page.locator('[data-helios-next]').click()
      await page.screenshot({ path: path.join(artifacts, 'homepage-' + width + '.png'), fullPage: true })
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
      assert.deepEqual(axe.violations.map(v => ({ id: v.id, elements: v.nodes.map(n => n.target) })), [], 'Accessibility violations at ' + width)
      console.log('PASS: ' + width + 'px — responsive assets, no overflow, carousel, menu keyboard, cart drawer, routes, newsletter fields, axe WCAG AA')
    }
    await page.setViewportSize({ width: 390, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    assert.equal(await page.locator('.helios-collection-tile img').first().evaluate(el => getComputedStyle(el).transitionDuration), '1e-05s')
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
main().catch(error => { console.error(error); process.exitCode = 1 })
