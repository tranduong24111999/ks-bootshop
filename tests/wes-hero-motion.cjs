/* Local generated-banner playback checks. No Shopify writes or external requests. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const { chromium } = require('playwright')
const { engine, renderSection, read, root } = require('./helios-homepage.cjs')
async function main () {
  const config = JSON.parse(read('templates/index.json')).sections.helios_hero
  const hero = await renderSection('motion-test', config)
  const header = await renderSection('header', { type: 'helios-header', settings: {} })
  const fonts = await engine.renderFile('helios-fonts')
  const html = '<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/vendor-bootstrap.min.css"><link rel="stylesheet" href="/assets/helios.css"><script src="/assets/helios.js" defer></script>' + fonts + '</head><body class="helios-theme page-type-index"><div id="header-group" class="sticky-top">' + header + '</div>' + hero + '<div style="height:1800px"></div></body></html>'
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname
    if (pathname.startsWith('/assets/')) {
      const file = path.resolve(root, '.' + pathname)
      if (!file.startsWith(path.join(root, 'assets') + path.sep) || !fs.existsSync(file)) { res.writeHead(404); return res.end() }
      res.setHeader('Content-Type', { '.css': 'text/css', '.js': 'application/javascript', '.mp4': 'video/mp4', '.jpg': 'image/jpeg' }[path.extname(file)] || 'application/octet-stream')
      return res.end(fs.readFileSync(file))
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const browser = await chromium.launch({ ...(process.env.WES_CHROMIUM_PATH ? { executablePath: process.env.WES_CHROMIUM_PATH } : {}) })
  const origin = 'http://127.0.0.1:' + server.address().port
  const artifacts = '/tmp/wes-hero-motion'
  fs.mkdirSync(artifacts, { recursive: true })
  try {
    const page = await browser.newPage()
    const errors = []; const videosRequested = new Set()
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', req => { if (req.url().endsWith('.mp4')) videosRequested.add(req.url()) })
    for (const width of [320, 390, 768, 1440]) {
      videosRequested.clear()
      await page.setViewportSize({ width, height: 1000 })
      await page.goto(origin)
      const carousel = page.locator('.helios-hero')
      const videos = page.locator('[data-hero-video]')
      assert.equal(await videos.count(), 3)
      await page.waitForFunction(() => document.querySelector('[data-hero-video]').currentTime > 0.1)
      assert.equal(videosRequested.size, 1, 'Only the active clip should download')
      assert(await videos.first().evaluate(v => v.muted && !v.paused && v.videoWidth === 1600 && v.classList.contains('is-ready')))
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow at ' + width)
      const toggle = carousel.locator('[data-helios-toggle]')
      await toggle.click()
      assert(await videos.first().evaluate(v => v.paused), 'Pause button must pause video')
      await toggle.click()
      await page.waitForFunction(() => !document.querySelector('[data-hero-video]').paused)
      for (const index of [1, 2]) {
        await carousel.locator('[data-helios-dot="' + index + '"]').click()
        await page.waitForFunction(i => document.querySelectorAll('[data-hero-video]')[i].currentTime > 0.1, index)
        assert(await videos.nth(index - 1).evaluate(v => v.paused), 'Inactive video must stop')
      }
      await carousel.evaluate(el => el.transition?.finished)
      await page.screenshot({ path: path.join(artifacts, 'gold-' + width + '.png') })
      await page.evaluate(() => scrollTo(0, 1600))
      await page.waitForFunction(() => [...document.querySelectorAll('[data-hero-video]')].every(v => v.paused))
      await page.evaluate(() => scrollTo(0, 0))
      await carousel.locator('[data-helios-dot="0"]').click()
      await page.waitForFunction(() => !document.querySelector('[data-hero-video]').paused)
      await carousel.evaluate(el => el.transition?.finished)
      await page.screenshot({ path: path.join(artifacts, 'silver-' + width + '.png') })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.waitForFunction(() => document.querySelector('[data-hero-video]').paused)
      assert(await videos.first().evaluate(v => v.paused), 'Reduced motion must pause video')
      assert.equal(await videos.first().isVisible(), false)
      assert(await carousel.locator('picture img').first().evaluate(i => i.complete && i.naturalWidth > 0))
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      console.log('PASS ' + width + 'px: playback, lazy video loading, slide changes, pause/resume, scroll pause, reduced motion, no overflow')
    }
    const noJs = await browser.newContext({ javaScriptEnabled: false })
    const fallback = await noJs.newPage(); await fallback.goto(origin)
    assert(await fallback.locator('picture img').first().evaluate(i => i.complete && i.naturalWidth > 0))
    assert.equal(await fallback.locator('video source[src]').count(), 0)
    await noJs.close()
    assert.deepEqual(errors, [])
    console.log('PASS static no-JavaScript fallback and zero runtime errors. Artifacts: ' + artifacts)
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)) }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
