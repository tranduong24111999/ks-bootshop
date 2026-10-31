const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const { chromium } = require('playwright')
const { engine, context, renderSection, read, root } = require('./helios-homepage.cjs')
engine.registerFilter('stylesheet_tag', url => '<link rel="stylesheet" href="' + url + '">')
const productTemplate = JSON.parse(read('templates/product.json'))
const config = Object.values(productTemplate.sections).find(section => section.type === 'apps' && section.settings.helios_product_reviews)
// Shopify renders app blocks on its servers. Replace that single tag only in the local harness.
async function renderApps (product, widget, editor = true) {
  const source = read('sections/apps.liquid').replace(/{% schema %}[\s\S]*?{% endschema %}/, '').replace('{% render block %}', '{{ block.fixture_markup }}')
  const scope = { ...context, product, request: { page_type: 'product', design_mode: editor }, section: { id: 'review-test', settings: config.settings, blocks: [{ fixture_markup: widget }] } }
  engine.options.globals = scope
  return engine.parseAndRender(source, scope)
}
function widget (id, count = 2) {
  return '<div id="judgeme_product_reviews" class="jdgm-widget jdgm-review-widget" data-id="' + id + '"><div class="jdgm-rev-widg" data-number-of-reviews="' + count + '" data-average-rating="3.50"><h2 class="jdgm-rev-widg__title">Customer Reviews</h2><button class="jdgm-write-rev-link">Write a review</button><div class="jdgm-histogram__bar"><div class="jdgm-histogram__bar-content" style="width:50%"></div></div><select class="jdgm-sort-dropdown" aria-label="Sort reviews"><option>Recent</option><option>Rating</option></select>' + (count ? '<div class="jdgm-rev"><div class="jdgm-rev__body">Local test fixture — never uploaded</div></div>' : '') + '</div></div>'
}
async function main () {
  assert.equal(config.type, 'apps', 'Use standard Shopify app section')
  assert.equal(config.settings.helios_product_reviews, true)
  assert.equal(Object.values(config.blocks).filter(x => x.type.includes('/review_widget/')).length, 1)
  const reviewBlocks = Object.values(productTemplate.sections).filter(section => !section.disabled).flatMap(section => Object.values(section.blocks || {})).filter(block => block.type.includes('/judge-me-reviews/blocks/review_widget/'))
  assert.equal(reviewBlocks.length, 1, 'Only one active full Review Widget across the whole template')
  assert.equal(reviewBlocks[0].settings.review_data, 'real_data')
  assert.equal(reviewBlocks[0].settings.show_shop_reviews, false)
  assert.equal(productTemplate.sections['1710322973d29fae05'].disabled, true, 'Keep legacy empty section disabled')
  assert(!read('sections/apps.liquid').includes('capture reviews_app'))
  assert(!read('sections/apps.liquid').includes('metafields.judgeme.widget'), 'Do not render a second manual widget alongside the app block')
  const settings = JSON.parse(read('config/settings_data.json')).current
  const embed = Object.values(settings.blocks).find(block => block.type.includes('/judgeme_core/'))
  assert.equal(embed.disabled, false, 'Repository snapshot has embed enabled; live theme still needs checking')
  const a = { id: '111', handle: 'product-a', title: 'Local product A' }
  const b = { id: '222', handle: 'product-b', title: 'Local product B' }
  const htmlA = await renderApps(a, widget('111'))
  const htmlB = await renderApps(b, widget('222'))
  assert(htmlA.includes('data-product-handle="product-a"') && !htmlA.includes('data-id="222"'))
  assert(htmlB.includes('data-product-handle="product-b"') && !htmlB.includes('data-id="111"'))
  const publicHtml = await renderApps(a, widget('111'), false)
  assert(!publicHtml.includes('helios-review-diagnostics.js') && !publicHtml.includes('<helios-review-diagnostics'))
  const legacyEmpty = await renderSection('legacy', { type: 'helios-product-reviews', settings: {} }, { product: { id: 123, metafields: {} } })
  assert(legacyEmpty.includes('Chưa có đánh giá') && !legacyEmpty.includes('5.00'))
  const pages = { '/a': htmlA, '/b': htmlB, '/hidden': await renderApps(a, widget('111', 0)), '/missing': await renderApps(a, '<!-- app not rendered -->') }
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/assets/')) {
      const file = path.join(root, req.url); if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return }
      res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : 'text/css'); res.end(fs.readFileSync(file)); return
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end('<!doctype html><html lang="vi"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/vendor-bootstrap.min.css"><link rel="stylesheet" href="/assets/product.css"><link rel="stylesheet" href="/assets/helios.css"></head><body class="helios-theme page-type-product">' + (pages[req.url] || publicHtml) + '</body></html>')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ headless: true }); const page = await browser.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message))
    const base = 'http://127.0.0.1:' + server.address().port
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 950 }); await page.goto(base + '/a')
      assert.equal(await page.locator('.jdgm-review-widget').count(), 1)
      assert(await page.locator('.jdgm-rev__body').isVisible(), 'Existing CSS must not hide rendered review rows')
      assert.equal(await page.locator('.jdgm-histogram__bar-content').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(242, 242, 242)')
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
      assert((await page.locator('[data-review-status]').textContent()).includes('Widget gắn đúng Shopify Product ID 111'))
      await page.locator('.jdgm-sort-dropdown').selectOption({ index: 1 })
      await page.goto(base + '/b'); assert.equal(await page.locator('.jdgm-review-widget').getAttribute('data-id'), '222')
      assert((await page.locator('[data-review-status]').textContent()).includes('Product ID 222'))
    }
    await page.goto(base + '/a')
    await page.locator('.jdgm-review-widget').evaluate(el => { el.dataset.id = '999' })
    await page.waitForFunction(() => document.querySelector('[data-review-status]').textContent.includes('SAI PRODUCT ID'))
    assert.equal(await page.locator('.jdgm-review-widget').getAttribute('data-id'), '999', 'Diagnostics must never rewrite app IDs')
    await page.locator('.helios-review-widget-mount').evaluate(el => el.append(el.firstElementChild.cloneNode(true)))
    await page.waitForFunction(() => document.querySelector('[data-review-status]').textContent.includes('Có 2 Review Widget'))
    await page.goto(base + '/hidden')
    assert.equal(await page.locator('.jdgm-rev').count(), 0, 'Do not expose hidden/unreturned data')
    assert((await page.locator('[data-review-status]').textContent()).includes('Published/Hidden'))
    await page.goto(base + '/missing')
    assert((await page.locator('[data-review-status]').textContent()).includes('Chưa tìm thấy Review Widget'))
    await page.locator('.helios-review-widget-mount').evaluate((el, html) => { el.innerHTML = html }, widget('111'))
    await page.waitForFunction(() => document.querySelector('[data-review-status]').textContent.includes('Widget gắn đúng Shopify Product ID 111'))
    await page.goto(base + '/public'); assert.equal(await page.locator('helios-review-diagnostics').count(), 0)
    assert.deepEqual(errors, [])
    console.log('PASS: native app section, preserved app/embed IDs, product A/B binding, no duplicate manual widget, black styling and visible review rows at 390/1440px, missing/delayed/mismatched/duplicate widget diagnostics, hidden rows remain absent, diagnostics editor-only, zero runtime errors. Live Judge.me and Shopify not emulated.')
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)) }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
