const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const { chromium } = require('playwright')
const { engine, context, renderSection, read, root } = require('./helios-homepage.cjs')
async function main () {
  engine.registerFilter('stylesheet_tag', url => '<link rel="stylesheet" href="' + url + '">')
  const source = JSON.parse(read('docs/helios-feedback-source.json'))
  const config = JSON.parse(read('templates/index.feedback.json')).sections.feedback
  const body = await renderSection('feedback', config, { page: {}, all_products: {} })
  assert.equal((body.match(/class="helios-feedback__card"/g) || []).length, source.cards.length)
  assert(!body.includes('href=""'))
  const fallback = await engine.renderFile('helios-feedback-url', { ...context, pages: {} })
  assert.equal(fallback, '/?view=feedback')
  const real = await engine.renderFile('helios-feedback-url', { ...context, pages: { feedback: { url: '/pages/feedback' } } })
  assert.equal(real, '/pages/feedback?view=feedback')
  for (const record of source.cards) {
    assert(fs.existsSync(path.join(root, 'assets', record.asset)))
    assert(body.includes(record.name))
  }
  // A merchant-created block replaces defaults; a real catalog product uses its real URL.
  const custom = { ...config, blocks: { first: { type: 'image', settings: { image: { src: '/assets/helios-feedback-1.jpg' }, caption: 'Merchant photo', product: { title: 'Existing product', url: '/products/existing', featured_image: { src: '/assets/helios-feedback-1.jpg' } } } } }, block_order: ['first'] }
  const customHtml = await renderSection('custom-feedback', custom, { page: {} })
  assert(customHtml.includes('/products/existing'))
  assert(!customHtml.includes('Helios x'))
  const headerConfig = Object.values(JSON.parse(read('sections/header-group.json')).sections).find(x => x.type === 'helios-header')
  const header = await renderSection('feedback-header', headerConfig)
  assert(header.includes('href="/?view=feedback">FEEDBACK'))
  const html = '<!doctype html><html lang="vi"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/vendor-bootstrap.min.css"><link rel="stylesheet" href="/assets/helios.css"></head><body class="helios-theme page-type-feedback"><div id="header-group">' + header + '</div><main>' + body + '</main></body></html>'
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/assets/')) {
      const file = path.join(root, req.url.split('?')[0])
      if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return }
      res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.webp') ? 'image/webp' : 'image/jpeg')
      res.end(fs.readFileSync(file)); return
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 950 })
      await page.goto('http://127.0.0.1:' + server.address().port + '/?view=feedback')
      assert.equal(await page.locator('.helios-feedback__card').count(), 16)
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) console.log(await page.evaluate(() => [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0,10).map(el => ({tag:el.tagName,class:el.className,width:el.getBoundingClientRect().width,right:el.getBoundingClientRect().right}))))
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
      const columns = await page.locator('.helios-feedback__grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)
      assert.equal(columns, width < 768 ? 2 : 4)
      await page.locator('.helios-feedback__image img').first().scrollIntoViewIfNeeded()
      await page.waitForFunction(() => [...document.querySelectorAll('.helios-feedback__image img')].filter(el => el.getBoundingClientRect().top < innerHeight && el.getBoundingClientRect().bottom > 0).every(el => el.complete && el.naturalWidth > 0))
      if (width > 768) {
        await page.locator('.helios-feedback__visual').first().hover()
        await page.waitForTimeout(550)
        assert.equal(await page.locator('.helios-feedback__products').first().evaluate(el => getComputedStyle(el).visibility), 'visible')
      }
    }
    console.log('PASS: 16 real reference cards, working header fallback/page routes, existing-product links, merchant blocks, decoded images, 390/1440px grid and hover, no overflow')
  } finally {
    await browser?.close()
    await new Promise(resolve => server.close(resolve))
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
