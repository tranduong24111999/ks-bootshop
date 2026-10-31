const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const { chromium } = require('playwright')
const { engine, context, renderSection, read, root } = require('./helios-homepage.cjs')
engine.registerFilter('stylesheet_tag', url => '<link rel="stylesheet" href="' + url + '">')
engine.registerTag('paginate', {
  parse (token, tokens) { this.templates = []; const stream = this.liquid.parser.parseStream(tokens).on('tag:endpaginate', () => stream.stop()).on('template', template => this.templates.push(template)); stream.start() },
  * render (context, emitter) { yield this.liquid.renderer.renderTemplates(this.templates, context, emitter) }
})
async function main () {
  const source = JSON.parse(read('docs/helios-journal-source.json'))
  const rendered = new Map()
  assert.equal(source.listings.filter(x => x.category === 'world-of-helios').reduce((sum, x) => sum + x.cards.length, 0), 53)
  for (const listing of source.listings) {
    const view = 'journal-' + listing.category + '-' + listing.page
    const config = JSON.parse(read('templates/index.' + view + '.json')).sections.journal
    const html = await renderSection(view, config, { articles: {} })
    assert.equal((html.match(/<article class="helios-journal__banner"/g) || []).length, listing.cards.length)
    assert.equal((html.match(/class="helios-journal__banner helios-journal__film"/g) || []).length, Math.floor(listing.cards.length / 3))
    assert(!html.includes('href=""'))
    for (const card of listing.cards) assert(html.includes('?view=journal-story-' + source.article_ids[card.url]))
    rendered.set(view, html)
  }
  for (const id of Object.values(source.article_ids)) {
    const html = await renderSection('story-' + id, { type: 'helios-journal-story', settings: { story_id: id } })
    assert(html.includes('<h1>'))
    assert(!html.includes('<script') && !html.includes('<style'))
    rendered.set('journal-story-' + id, html)
  }
  const native = await renderSection('native', { type: 'helios-journal', settings: { category: 'world-of-helios', source_page: 1 } }, { blogs: { 'world-of-helios': { articles: [{ title: 'Existing store article', url: '/blogs/world-of-helios/existing', excerpt_or_content: 'Existing content' }] } } })
  assert(native.includes('/blogs/world-of-helios/existing'))
  assert(!native.includes('?view=journal-story-'))
  assert.equal(await engine.renderFile('helios-journal-url', { ...context, category: 'nhan', blogs: { nhan: { url: '/en/blogs/nhan' } } }), '/en/blogs/nhan?view=journal-nhan-1')
  const headerConfig = Object.values(JSON.parse(read('sections/header-group.json')).sections).find(x => x.type === 'helios-header')
  const header = await renderSection('journal-header', headerConfig)
  assert(header.includes('href="/?view=journal-world-of-helios-1">WORLD OF HELIOS'))
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/assets/')) {
      const file = path.join(root, req.url.split('?')[0]); if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return }
      res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.png') ? 'image/png' : 'image/jpeg'); res.end(fs.readFileSync(file)); return
    }
    const view = new URL(req.url, 'http://local').searchParams.get('view') || 'journal-world-of-helios-1'
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end('<!doctype html><html lang="vi"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/vendor-bootstrap.min.css"><link rel="stylesheet" href="/assets/helios.css"></head><body class="helios-theme page-type-journal"><div id="header-group">' + header + '</div><main>' + rendered.get(view) + '</main></body></html>')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    const errors = []; page.on('pageerror', error => errors.push(error.message))
    // External video/image requests are not needed to verify local layout and playback controls.
    await page.route('https://**', route => route.abort())
    await page.addInitScript(() => {
      HTMLMediaElement.prototype.play = function () { this.dataset.testPlaying = 'true'; return Promise.resolve() }
      HTMLMediaElement.prototype.pause = function () { this.dataset.testPlaying = 'false' }
    })
    const origin = 'http://127.0.0.1:' + server.address().port
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 950 }); await page.goto(origin + '/?view=journal-world-of-helios-1')
      assert.equal(await page.locator('.helios-journal__header nav a').count(), 7)
      assert.equal(await page.locator('article.helios-journal__banner').count(), 10)
      assert.equal(await page.locator('.helios-journal__film').count(), 3)
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
      await page.waitForFunction(() => document.querySelector('.helios-journal__image img').naturalWidth > 0)
      const film = page.locator('.helios-journal__film').first()
      await film.scrollIntoViewIfNeeded()
      await page.waitForFunction(() => document.querySelector('.helios-journal__film > video').dataset.testPlaying === 'true')
      await film.locator('[data-journal-watch]').click()
      await page.locator('dialog[open]').waitFor()
      assert.equal(await film.locator('video').getAttribute('data-test-playing'), 'false')
      await page.keyboard.press('Escape')
      assert.equal(await page.locator('dialog').evaluate(el => el.open), false)
      await page.locator('.helios-journal__pagination a[href*="world-of-helios-2"]').click()
      await page.waitForURL('**/?view=journal-world-of-helios-2')
      assert.equal(await page.locator('[aria-current="page"]').last().textContent(), '2')
      await page.locator('.helios-journal__read').first().click(); await page.waitForURL('**/?view=journal-story-*')
      assert(await page.locator('.helios-journal-story h1').isVisible())
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
      await page.goto(origin + '/?view=journal-world-of-helios-1')
      await page.locator('.helios-journal__header nav a[href*="journal-nhan-1"]').click(); await page.waitForURL('**/?view=journal-nhan-1')
      assert.equal(await page.locator('article.helios-journal__banner').count(), 8)
    }
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto(origin + '/?view=journal-world-of-helios-1')
    await page.locator('.helios-journal__film').first().scrollIntoViewIfNeeded(); await page.waitForTimeout(150)
    assert.notEqual(await page.locator('.helios-journal__film > video').first().getAttribute('data-test-playing'), 'true')
    assert.deepEqual(errors, [])
    console.log('PASS: 12 listing views, all 53 World stories / 74 distinct internal articles, seven categories, native-blog fallback, pagination, local banner decoding, video observer/dialog/reduced motion, 390/1440px no overflow, zero runtime errors')
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)) }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
