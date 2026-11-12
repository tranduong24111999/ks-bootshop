(() => {
  if (window.Shopify?.designMode || window.opener) return
  const entryKey = '__wesHomeReturn'
  const pendingKey = 'wes-home-navigation'
  const returnKey = 'wes-home-return'
  const home = new URL(window.Shopify?.routes?.root || '/', location.origin)
  const path = url => url.pathname.replace(/\/+$/, '') || '/'
  const pageKey = url => url.pathname.replace(/\/collections\/[^/]+(?=\/products\/)/, '') + url.search
  const isHome = url => url.origin === home.origin && path(url) === path(home) && !url.search
  const writeEntry = value => {
    const state = history.state && typeof history.state === 'object' ? history.state : {}
    history.replaceState({ ...state, [entryKey]: value }, '', location.href)
  }
  const top = () => {
    const style = document.documentElement.style
    const previous = style.scrollBehavior
    style.scrollBehavior = 'auto'
    scrollTo({ top: 0, left: 0, behavior: 'auto' })
    requestAnimationFrame(() => {
      scrollTo({ top: 0, left: 0, behavior: 'auto' })
      style.scrollBehavior = previous
    })
  }
  try {
    const pending = JSON.parse(sessionStorage.getItem(pendingKey) || 'null')
    sessionStorage.removeItem(pendingKey)
    const current = new URL(location.href)
    if (isHome(current)) writeEntry({ home: home.pathname, depth: 0 })
    else if (pending && performance.getEntriesByType('navigation')[0]?.type === 'navigate') {
      const referrer = new URL(document.referrer)
      referrer.hash = ''
      if (pending.to === pageKey(current) && pending.from === referrer.href && history.length > pending.depth && history.length <= pending.length + 1 && Date.now() - pending.time >= 0 && Date.now() - pending.time < 30000 && pending.depth > 0 && pending.depth <= 5 && pending.home === home.pathname) {
        writeEntry({ home: pending.home, depth: pending.depth })
      }
    }
  } catch (_) {}
  const restored = () => {
    try {
      const flag = JSON.parse(sessionStorage.getItem(returnKey) || 'null')
      if (flag && flag.home === home.pathname && isHome(new URL(location.href)) && Date.now() - flag.time < 10000) {
        sessionStorage.removeItem(returnKey)
        top()
      }
    } catch (_) {}
  }
  window.addEventListener('pageshow', restored)
  window.addEventListener('popstate', restored)
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
    if (!anchor || anchor.hasAttribute('download') || anchor.target && anchor.target !== '_self' || anchor.hasAttribute('data-bs-toggle') || anchor.hasAttribute('onclick') || anchor.getAttribute('role') === 'button') return
    let url
    try { url = new URL(anchor.href, location.href) } catch (_) { return }
    if (!isHome(url) || url.hash) return
    if (isHome(new URL(location.href))) { event.preventDefault(); top(); return }
    const entry = history.state?.[entryKey]
    if (!entry || entry.home !== home.pathname || !Number.isInteger(entry.depth) || entry.depth < 1 || entry.depth > 5 || history.length <= entry.depth) return
    try { sessionStorage.setItem(returnKey, JSON.stringify({ home: home.pathname, time: Date.now() })) } catch (_) { return }
    event.preventDefault()
    history.go(-entry.depth)
  })
  window.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
    if (!anchor || anchor.hasAttribute('download') || anchor.target && anchor.target !== '_self' || anchor.hasAttribute('data-bs-toggle') || anchor.hasAttribute('onclick') || anchor.getAttribute('role') === 'button') return
    const entry = history.state?.[entryKey]
    if (!entry || entry.home !== home.pathname || !Number.isInteger(entry.depth) || entry.depth < 0 || entry.depth >= 5) return
    let url
    try { url = new URL(anchor.href, location.href) } catch (_) { return }
    if (url.origin !== location.origin || !/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:collections|products|pages|blogs|search)(?:\/|$)/i.test(url.pathname) || url.pathname === location.pathname && url.search === location.search) return
    const from = new URL(location.href)
    from.hash = ''
    try { sessionStorage.setItem(pendingKey, JSON.stringify({ to: pageKey(url), from: from.href, home: entry.home, depth: entry.depth + 1, length: history.length, time: Date.now() })) } catch (_) {}
  })
})();

/* Warm same-origin catalog documents without intercepting normal navigation. */
(() => {
  if (window.Shopify?.designMode) return
  const connection = navigator.connection
  if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '')) return
  const warmed = new Set()
  const warmedImages = new Set()
  const hints = new Set()
  const controllers = new Set()
  const automaticKinds = new Set()
  const prepareResource = (value, as) => {
    let url
    try { url = new URL(value.replace(/&amp;/g, '&'), location.href) } catch (_) { return }
    if (url.origin !== location.origin || !url.pathname.startsWith('/cdn/shop/') || hints.has(url.href) || hints.size >= 16) return
    if ([...document.querySelectorAll('script[src],link[href]')].some(element => (element.src || element.href) === url.href)) return
    hints.add(url.href)
    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = as
    link.href = url.href
    link.fetchPriority = 'low'
    document.head.append(link)
  }
  const prepareDocument = async url => {
    const controller = new AbortController()
    controllers.add(controller)
    const timer = setTimeout(() => controller.abort(), 3500)
    try {
      const response = await fetch(url, { credentials: 'same-origin', cache: 'default', priority: 'low', signal: controller.signal })
      if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return
      const html = await response.text()
      if (document.hidden) return
      const assets = html.matchAll(/(?:src|href)=["']([^"']*\/cdn\/shop\/t\/\d+\/(?:assets|compiled_assets)\/[^"'<>]+\.(?:css|js)(?:\?[^"']*)?)["']/g)
      for (const match of assets) prepareResource(match[1], match[1].includes('.js') ? 'script' : 'style')
      const main = html.match(/<main\b[^>]*id=["']main["'][^>]*>([\s\S]*?)<\/main>/i)?.[1]
      const images = main?.match(/<img\b[^>]*>/gi) || []
      const image = images.find(tag => /fetchpriority=["']high["']/.test(tag)) || images[0]
      const source = image?.match(/\bsrc=["']([^"']+)["']/)?.[1]
      if (source) prepareResource(source, 'image')
    } catch (_) {} finally { clearTimeout(timer); controllers.delete(controller) }
  }
  window.addEventListener('pagehide', () => {
    controllers.forEach(controller => controller.abort())
    controllers.clear()
  })
  const warmImage = anchor => {
    const card = anchor?.closest('.product-card, .helios-product-card')
    const image = card?.querySelector('img')
    if (!image || warmedImages.size >= 2) return
    let url
    try { url = new URL(image.currentSrc || image.src, location.href) } catch (_) { return }
    if (url.origin !== location.origin || !url.pathname.startsWith('/cdn/shop/files/')) return
    if (url.searchParams.has('width')) url.searchParams.set('width', '800')
    if (url.searchParams.has('height')) {
      const width = Number(new URL(image.currentSrc || image.src, location.href).searchParams.get('width'))
      const height = Number(url.searchParams.get('height'))
      if (width > 0 && height > 0) url.searchParams.set('height', String(Math.round(height * 800 / width)))
    }
    if (warmedImages.has(url.href)) return
    warmedImages.add(url.href)
    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'image'
    link.href = url.href
    link.fetchPriority = 'low'
    document.head.append(link)
  }
  const documentPrefetch = document.createElement('link').relList.supports('prefetch')
  const nativePrefetch = typeof HTMLScriptElement.supports === 'function' && HTMLScriptElement.supports('speculationrules')
  const current = new URL(location.href)
  let automatic = 0
  const destination = anchor => {
    if (!anchor || anchor.hasAttribute('download') || anchor.target && anchor.target !== '_self' || anchor.relList.contains('nofollow')) return null
    let url
    try { url = new URL(anchor.href, location.href) } catch (_) { return null }
    if (url.origin !== current.origin || url.search || url.hash || url.pathname === current.pathname) return null
    if (!/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:collections\/[^/]+(?:\/products\/[^/]+)?|products\/[^/]+)\/?$/i.test(url.pathname)) return null
    return url.href
  }
  const warm = (anchor, background = false) => {
    if (document.hidden) return
    if (!background && destination(anchor)) warmImage(anchor)
    if (warmed.size >= 6 || background && automatic >= 2) return
    const url = destination(anchor)
    if (!url || warmed.has(url)) return
    const kind = /\/products\//.test(new URL(url).pathname) ? 'product' : 'collection'
    if (background && automaticKinds.has(kind)) return
    warmed.add(url)
    if (background) { automatic++; automaticKinds.add(kind) }
    if (nativePrefetch) {
      const rule = document.createElement('script')
      rule.type = 'speculationrules'
      rule.textContent = JSON.stringify({ prefetch: [{ source: 'list', urls: [url], eagerness: 'immediate' }] })
      document.head.append(rule)
    } else if (documentPrefetch) {
      const link = document.createElement('link')
      link.rel = 'prefetch'
      link.as = 'document'
      link.href = url
      document.head.append(link)
    } else {
      void prepareDocument(url)
    }
  }
  let hoverTimer
  document.addEventListener('pointerover', event => {
    if (event.pointerType === 'touch') return
    const anchor = event.target.closest('a[href]')
    if (!anchor || anchor.contains(event.relatedTarget)) return
    clearTimeout(hoverTimer)
    hoverTimer = setTimeout(() => warm(anchor), 65)
  }, { passive: true })
  document.addEventListener('pointerout', event => {
    const anchor = event.target.closest('a[href]')
    if (anchor && !anchor.contains(event.relatedTarget)) clearTimeout(hoverTimer)
  }, { passive: true })
  document.addEventListener('focusin', event => warm(event.target.closest('a[href]')))
  let touchIntent
  document.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch') {
      touchIntent = { anchor: event.target.closest('a[href]'), x: event.clientX, y: event.clientY, id: event.pointerId }
      return
    }
    if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) warm(event.target.closest('a[href]'))
  }, { passive: true })
  document.addEventListener('pointermove', event => {
    if (touchIntent && (Math.abs(event.clientX - touchIntent.x) > 8 || Math.abs(event.clientY - touchIntent.y) > 8)) touchIntent = null
  }, { passive: true })
  document.addEventListener('pointerup', event => {
    if (touchIntent?.id === event.pointerId) warm(touchIntent.anchor)
    touchIntent = null
  }, { passive: true })
  document.addEventListener('pointercancel', () => { touchIntent = null }, { passive: true })
  const prepareVisible = () => {
    if (!('IntersectionObserver' in window)) return
    const timers = new Map()
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        clearTimeout(timers.get(entry.target))
        timers.delete(entry.target)
        if (!entry.isIntersecting) continue
        timers.set(entry.target, setTimeout(() => {
          timers.delete(entry.target)
          warm(entry.target, true)
          observer.unobserve(entry.target)
          if (automatic >= 2 || warmed.size >= 6) observer.disconnect()
        }, 350))
      }
    }, { threshold: 0.5 })
    document.querySelectorAll('.helios-hero__slide.is-active a[href], .helios-product-card__media, .helios-collection-tile, .product-card a[href], .helios-header__links a[href]').forEach(anchor => observer.observe(anchor))
    window.addEventListener('pagehide', () => {
      observer.disconnect()
      timers.forEach(timer => clearTimeout(timer))
      timers.clear()
    }, { once: true })
  }

  const idle = () => {
    let begun = false
    let timer
    const begin = () => {
      if (begun) return
      begun = true
      clearTimeout(timer)
      if ('requestIdleCallback' in window) requestIdleCallback(prepareVisible, { timeout: 1200 })
      else setTimeout(prepareVisible, 150)
    }
    const image = document.querySelector('#main img[fetchpriority="high"]')
    if (image && !image.complete) {
      image.addEventListener('load', begin, { once: true })
      image.addEventListener('error', begin, { once: true })
      timer = setTimeout(begin, 1500)
    } else begin()
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', idle, { once: true })
  else idle()
})()

