const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const { chromium } = require('playwright')
const { engine, renderSection, read, root } = require('./helios-homepage.cjs')
engine.registerFilter('stylesheet_tag', url => '<link rel="stylesheet" href="' + url + '">')
async function main () {
  const template = JSON.parse(read('templates/product.json'))
  const section = template.sections['1710322973d29fae05']
  assert.equal(section.type, 'helios-product-reviews')
  assert.equal(section.blocks.judge_me_reviews_review_widget_XNFVCT.type, 'shopify://apps/judge-me-reviews/blocks/review_widget/61ccd3b1-a9f2-4160-9fe9-4fec8413e5d8')
  assert(template.order.indexOf('1710322973d29fae05') < template.order.indexOf('8b8acb35-e69e-4471-a6cb-d0a09485fb41'))
  const empty = await renderSection('empty-reviews', { type: section.type, settings: {} }, { product: { id: 123, title: 'Local fixture', metafields: {} } })
  assert(empty.includes('Chưa có đánh giá'))
  assert(!empty.includes('jdgm-rev__body') && !empty.includes('5.00'))
  // Local HTML fixture checks preservation/style, not Judge.me's remote submission or moderation.
  const widget = '<div class="jdgm-rev-widg" data-number-of-reviews="2" data-average-rating="3.50"><div class="jdgm-rev-widg__header"><h2 class="jdgm-rev-widg__title">Customer Reviews</h2><div class="jdgm-rev-widg__summary">3.50 / 5 — 2 reviews</div><div class="jdgm-histogram"><div class="jdgm-histogram__bar"><div class="jdgm-histogram__bar-content" style="width:50%"></div></div></div><button class="jdgm-write-rev-link">Write a review</button></div><div class="jdgm-gallery">Customer photos &amp; videos</div><div class="jdgm-sort-dropdown-wrapper"><select class="jdgm-sort-dropdown" aria-label="Sort reviews"><option>Most Recent</option><option>Highest Rating</option></select></div><div class="jdgm-rev"><div class="jdgm-rev__rating">★★★★☆</div><span class="jdgm-rev__author">Local test fixture</span><div class="jdgm-rev__body">Local fixture content — not a production review</div></div></div>'
  const output = await renderSection('actual-widget', { type: section.type, settings: {} }, { product: { id: 123, title: 'Local fixture', metafields: { judgeme: { widget } } } })
  assert(output.includes(widget), 'Do not rewrite app-owned review data or totals')
  assert(output.includes('data-id="123"'))
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/assets/')) {
      const file = path.join(root, req.url); res.setHeader('Content-Type', 'text/css'); res.end(fs.readFileSync(file)); return
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/vendor-bootstrap.min.css"><link rel="stylesheet" href="/assets/helios.css"></head><body class="helios-theme page-type-product">' + output + '</body></html>')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ headless: true }); const page = await browser.newPage()
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 950 }); await page.goto('http://127.0.0.1:' + server.address().port)
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
      assert.equal(await page.locator('.jdgm-widget').count(), 1)
      assert.equal(await page.locator('.jdgm-rev-widg').getAttribute('data-average-rating'), '3.50')
      assert.equal(await page.locator('.jdgm-histogram__bar-content').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(242, 242, 242)')
      await page.locator('.jdgm-sort-dropdown').selectOption({ index: 1 })
      await page.locator('.jdgm-write-rev-link').click()
      assert(await page.locator('.jdgm-rev__body').isVisible())
    }
    console.log('PASS: Judge.me app block/ordering preserved, no fabricated empty-state reviews, real product widget markup/totals preserved, one widget, controls and white histogram, 390/1440px no overflow. Remote Judge.me behavior not emulated.')
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)) }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
