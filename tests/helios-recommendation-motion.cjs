/* Local media fixtures only. No Shopify products, videos or reviews are created/imported. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const { execFileSync } = require('node:child_process')
const { Liquid } = require('liquidjs')
const { chromium } = require('playwright')
const root = path.resolve(__dirname, '..')
const engine = new Liquid({ root: path.join(root, 'snippets'), extname: '.liquid' })
engine.registerFilter('asset_url', name => '/assets/' + name)
engine.registerFilter('image_url', image => image.src || image)
engine.registerFilter('image_tag', (src, ...options) => { const p = Object.fromEntries(options); return '<img src="' + src + '" alt="Local media fixture" width="400" height="400" class="' + (p.class || '') + '">' })
engine.registerFilter('money_with_currency', () => 'Local price fixture')
engine.registerFilter('t', key => key === 'helios.product_motion_pause' ? 'Pause product media' : 'Resume product media')
const base = { id: 1, url: '/products/local-fixture', title: 'Local media fixture', available: true, featured_image: { src: '/assets/helios-category-1.webp' }, images: [{ src: '/assets/helios-category-1.webp' }, { src: '/assets/helios-category-2.webp' }], media: [], metafields: { reviews: {} }, tags: [], price: 100 }
const videoPath = '/tmp/helios-card-motion-fixture.mp4'
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=128x128:rate=10', '-t', '2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', videoPath])
async function main () {
  const nativeVideo = { media_type: 'video', sources: [{ format: 'mp4', width: 1080, url: '/unused-large.mp4' }, { format: 'mp4', width: 480, url: '/motion.mp4' }] }
  const fixtures = {
    '/photos': { ...base }, '/single': { ...base, images: [base.images[0]] },
    '/video': { ...base, media: [nativeVideo] },
    '/failed': { ...base, media: [{ ...nativeVideo, sources: [{ format: 'mp4', width: 480, url: '/missing.mp4' }] }] }
  }
  const cards = {}
  for (const [url, product] of Object.entries(fixtures)) cards[url] = await engine.renderFile('helios-product-card', { product, animate_media: true })
  assert(cards['/video'].includes('data-src="/motion.mp4"') && !cards['/video'].includes('/unused-large.mp4'))
  const home = await engine.renderFile('helios-product-card', { product: base })
  assert(!home.includes('<helios-product-media') && !home.includes('data-card-motion-toggle'))
  const server = http.createServer((req, res) => {
    if (req.url === '/motion.mp4') { res.setHeader('Content-Type', 'video/mp4'); res.end(fs.readFileSync(videoPath)); return }
    if (req.url.startsWith('/assets/')) {
      const file = path.join(root, req.url); if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return }
      res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'image/webp'); res.end(fs.readFileSync(file)); return
    }
    if (req.url.endsWith('.mp4')) { res.writeHead(404); res.end(); return }
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/helios.css"><link rel="stylesheet" href="/assets/helios-product.css"><script src="/assets/helios-product.js" defer></script></head><body class="helios-theme page-type-product">' + (req.url === '/video' ? '<div style="height:1200px"></div>' : '') + '<div class="helios-related" style="padding:20px;width:min(100%,450px);box-sizing:border-box">' + (cards[req.url] || cards['/photos']) + '</div><div style="height:1500px"></div></body></html>')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ headless: true }); const page = await browser.newPage(); const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const origin = 'http://127.0.0.1:' + server.address().port
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 950 }); await page.goto(origin + '/photos')
      await page.waitForFunction(() => document.querySelector('helios-product-media').visible)
      await page.locator('.helios-product-card__second').evaluate(el => el.decode())
      await page.waitForFunction(() => document.querySelector('helios-product-media').classList.contains('is-motion-second'), { timeout: 7500 })
      await page.waitForTimeout(1200)
      assert.equal(await page.locator('.helios-product-card__second').evaluate(el => Number(getComputedStyle(el).opacity)), 1)
      await page.locator('[data-card-motion-toggle]').click()
      assert.equal(await page.locator('helios-product-media').evaluate(el => el.paused), true)
      assert.equal(await page.locator('[data-card-motion-toggle]').getAttribute('aria-label'), 'Resume product media')
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    }
    await page.goto(origin + '/single'); assert(await page.locator('[data-card-motion-toggle]').isHidden())
    await page.goto(origin + '/video')
    assert.equal(await page.locator('source').getAttribute('src'), null, 'Do not fetch offscreen video')
    await page.locator('helios-product-media').scrollIntoViewIfNeeded()
    await page.waitForFunction(() => document.querySelector('video').currentTime > 0.15 && !document.querySelector('video').paused)
    assert.equal(await page.locator('video').evaluate(el => el.muted && el.playsInline), true)
    await page.locator('[data-card-motion-toggle]').click(); assert(await page.locator('video').evaluate(el => el.paused))
    await page.locator('[data-card-motion-toggle]').click(); await page.waitForFunction(() => !document.querySelector('video').paused)
    await page.evaluate(() => scrollTo(0, 0)); await page.waitForFunction(() => document.querySelector('video').paused)
    await page.locator('helios-product-media').scrollIntoViewIfNeeded(); await page.waitForFunction(() => !document.querySelector('video').paused)
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForFunction(() => document.querySelector('video').paused)
    assert(await page.locator('[data-card-motion-toggle]').isHidden())
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto(origin + '/failed'); await page.waitForFunction(() => document.querySelector('helios-product-media').videoFailed)
    await page.waitForFunction(() => document.querySelector('helios-product-media').classList.contains('is-motion-second'), { timeout: 7500 })
    await page.locator('helios-product-media').evaluate(el => { window.removedMotion = el; el.remove() })
    assert(await page.evaluate(() => removedMotion.controller.signal.aborted && removedMotion.video.paused))
    assert.deepEqual(errors, [])
    console.log('PASS: 390/1440px automatic two-image blend, pause/resume, actual muted MP4 playback, offscreen lazy load/pause, reduced motion, failed-video image fallback, disconnected cleanup, homepage cards unchanged, zero runtime errors')
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)) }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
