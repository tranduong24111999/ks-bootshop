const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const { chromium } = require('playwright')
const { engine, context, renderSection, read, root } = require('./helios-homepage.cjs')
engine.registerFilter('stylesheet_tag', url => '<link rel="stylesheet" href="' + url + '">')
// Local parser adapter only; production pagination is rendered by Shopify.
engine.registerTag('paginate', {
  parse (token, tokens) {
    this.templates = []
    const stream = this.liquid.parser.parseStream(tokens).on('tag:endpaginate', () => stream.stop()).on('template', template => this.templates.push(template)); stream.start()
  },
  * render (context, emitter) { yield this.liquid.renderer.renderTemplates(this.templates, context, emitter) }
})
async function main () {
  const config = JSON.parse(read('templates/index.collab.json')).sections.collab
  const listing = await renderSection('collab', config)
  assert(listing.includes('/?view=collab-story'))
  assert(listing.includes('/assets/helios-collab-interview.jpg'))
  assert(!listing.includes('href=""'))
  assert.equal(await engine.renderFile('helios-collab-url', context), '/?view=collab')
  assert.equal(await engine.renderFile('helios-collab-url', { ...context, blogs: { collab: { url: '/blogs/collab' } } }), '/blogs/collab?view=collab')
  const native = await renderSection('native-collab', config, { blogs: { collab: { articles: [{ title: 'Existing store article', url: '/blogs/collab/existing', excerpt_or_content: 'Existing article content', image: { src: '/assets/helios-collab-interview.jpg' } }] } } })
  assert(native.includes('/blogs/collab/existing'))
  assert(!native.includes('?view=collab-story'))
  const story = await renderSection('story', { type: 'helios-collab-story', settings: {} })
  assert(!story.includes('<script'))
  assert(story.includes('Bức Tường'))
  assert(story.includes('helios-collab-story-3.jpg'))
  const headerConfig = Object.values(JSON.parse(read('sections/header-group.json')).sections).find(x => x.type === 'helios-header')
  const header = await renderSection('collab-header', headerConfig)
  assert(header.includes('href="/?view=collab">COLLAB'))
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/assets/')) {
      const file = path.join(root, req.url.split('?')[0]); if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return }
      res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : 'image/jpeg'); res.end(fs.readFileSync(file)); return
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end('<!doctype html><html lang="vi"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/vendor-bootstrap.min.css"><link rel="stylesheet" href="/assets/helios.css"></head><body class="helios-theme page-type-collab"><div id="header-group">' + header + '</div><main>' + (req.url.includes('collab-story') ? story : listing) + '</main></body></html>')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    const origin = 'http://127.0.0.1:' + server.address().port
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 950 }); await page.goto(origin + '/?view=collab')
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) console.log(await page.evaluate(() => [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0,8).map(el => ({class:el.className,width:el.getBoundingClientRect().width,right:el.getBoundingClientRect().right}))))
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
      await page.waitForFunction(() => document.querySelector('.helios-collab__image img')?.naturalWidth > 0)
      await page.locator('.helios-collab__read').click()
      await page.waitForURL('**/?view=collab-story')
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) console.log(await page.evaluate(() => [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0,8).map(el => ({class:el.className,width:el.getBoundingClientRect().width,right:el.getBoundingClientRect().right}))))
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
      for (const image of await page.locator('.helios-collab-story__body img').all()) {
        await image.scrollIntoViewIfNeeded()
        await image.evaluate(el => el.decode())
      }
      await page.locator('.helios-collab-story > a').click(); await page.waitForURL('**/?view=collab')
    }
    console.log('PASS: header/native-blog/fallback routes, existing articles preserved, reference banner, local story navigation and three decoded article images, 390/1440px no overflow')
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)) }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
