const assert = require('node:assert/strict')
const { engine, context, renderSection, read, root } = require('./helios-homepage.cjs')
const locales = Object.fromEntries(['vi', 'en', 'ko', 'ja'].map(code => [code, JSON.parse(read('locales/' + (code === 'en' ? 'en.default' : code) + '.json'))]))
function flatten (object, prefix = '', output = {}) {
  for (const [key, value] of Object.entries(object)) {
    if (typeof value === 'object') flatten(value, prefix + key + '.', output)
    else output[prefix + key] = value
  }
  return output
}
const base = flatten(locales.en)
for (const [code, locale] of Object.entries(locales)) {
  const values = flatten(locale)
  assert.deepEqual(Object.keys(values).sort(), Object.keys(base).sort(), code + ': locale keys')
  for (const key of Object.keys(base)) {
    const placeholders = value => (value.match(/{{.*?}}/g) || []).sort()
    assert(values[key].trim(), code + ': nonempty ' + key)
    assert.deepEqual(placeholders(values[key]), placeholders(base[key]), code + ': interpolation ' + key)
  }
}
async function main () {
  const available_languages = [{ iso_code: 'vi', endonym: 'Tiếng Việt' }, { iso_code: 'en', endonym: 'English' }, { iso_code: 'ko', endonym: '한국어' }, { iso_code: 'ja', endonym: '日本語' }]
  for (const language of available_languages) {
    const scope = { ...context, request: { locale: { iso_code: language.iso_code } }, localization: { language, available_languages } }
    engine.options.globals = scope
    const header = JSON.parse(read('sections/header-group.json')).sections.helios_header
    // The configured section key may vary; keep this test aligned with the real group.
    const config = header || Object.values(JSON.parse(read('sections/header-group.json')).sections).find(section => section.type === 'helios-header')
    const html = await renderSection('language-test', config, scope)
    for (const code of ['vi', 'en', 'ko', 'ja']) assert(html.includes('name="language_code" value="' + code + '"'))
    assert(html.includes('aria-current="true"'))
    assert(html.includes(locales[language.iso_code].helios.stores))
    assert(html.includes('action="/localization" method="post"'))
    const text = await engine.renderFile('helios-text', { value: 'CÓ THỂ BẠN SẼ THÍCH' })
    assert.equal(text, locales[language.iso_code].helios.related)
  }
  const scope = { ...context, localization: { language: available_languages[0], available_languages: [available_languages[0]] } }
  engine.options.globals = scope
  const single = await engine.renderFile('helios-language', scope)
  assert(!single.includes('name="language_code"'), 'Do not offer unpublished languages')
  const fs = require('node:fs')
  const path = require('node:path')
  const http = require('node:http')
  const { chromium } = require('playwright')
  const headerConfig = Object.values(JSON.parse(read('sections/header-group.json')).sections).find(section => section.type === 'helios-header')
  const browserScope = { ...context, request: { locale: { iso_code: 'vi' } }, localization: { language: available_languages[0], available_languages } }
  const headerHtml = await renderSection('language-browser', headerConfig, browserScope)
  const posts = []
  const server = http.createServer((req, res) => {
    if (req.url === '/localization' && req.method === 'POST') {
      let data = ''; req.on('data', chunk => { data += chunk }); req.on('end', () => { posts.push(data); res.end('Local localization form test') }); return
    }
    if (req.url.startsWith('/assets/')) {
      const file = path.join(root, req.url.split('?')[0])
      if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return }
      res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream')
      res.end(fs.readFileSync(file)); return
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end('<!doctype html><html lang="vi"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/vendor-bootstrap.min.css"><link rel="stylesheet" href="/assets/helios.css"><script src="/assets/helios.js" defer></script></head><body class="helios-theme page-type-index"><div id="header-group">' + headerHtml + '</div></body></html>')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 950 })
      await page.goto('http://127.0.0.1:' + server.address().port)
      const selector = width < 768 ? '.helios-mobile-language .helios-language' : '.helios-header__actions .helios-language'
      if (width < 768) await page.locator('[data-helios-menu] > summary').click()
      await page.locator(selector + ' > summary').click()
      assert.equal(await page.locator(selector + ' button').count(), 4)
      const optionsBounds = await page.locator(selector + ' .helios-language__options').boundingBox()
      assert(optionsBounds.x >= 0 && optionsBounds.x + optionsBounds.width <= width + 1)
      await Promise.all([page.waitForURL('**/localization'), page.locator(selector + ' button[value="ja"]').click()])
      assert.equal(new URLSearchParams(posts.at(-1)).get('language_code'), 'ja')
    }
    console.log('PASS: 390/1440px language dropdown, four options, no overflow, Japanese selection posts native language_code')
  } finally {
    await browser?.close()
    await new Promise(resolve => server.close(resolve))
  }
  console.log('PASS: vi/en/ko/ja key and interpolation parity, translated header/text, Shopify localization POST, current selection, unpublished languages hidden')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
