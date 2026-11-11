/* Warm same-origin catalog documents without intercepting normal navigation. */
(() => {
  if (window.Shopify?.designMode) return
  const connection = navigator.connection
  if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '')) return
  const warmed = new Set()
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
    if (document.hidden || warmed.size >= 6 || background && automatic >= 2) return
    const url = destination(anchor)
    if (!url || warmed.has(url)) return
    warmed.add(url)
    if (background) automatic++
    if (nativePrefetch) {
      const rule = document.createElement('script')
      rule.type = 'speculationrules'
      rule.textContent = JSON.stringify({ prefetch: [{ source: 'list', urls: [url], eagerness: 'immediate' }] })
      document.head.append(rule)
    } else {
      const link = document.createElement('link')
      link.rel = 'prefetch'
      link.as = 'document'
      link.href = url
      document.head.append(link)
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
  document.addEventListener('pointerdown', event => {
    if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) warm(event.target.closest('a[href]'))
  }, { passive: true })
  const prepareVisible = () => {
    if (window.matchMedia('(pointer: coarse)').matches || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        warm(entry.target, true)
        observer.unobserve(entry.target)
        if (automatic >= 2 || warmed.size >= 6) { observer.disconnect(); break }
      }
    }, { threshold: 0.25 })
    document.querySelectorAll('.helios-product-card__media, .helios-collection-tile, .product-card a[href]').forEach(anchor => observer.observe(anchor))
    window.addEventListener('pagehide', () => observer.disconnect(), { once: true })
  }
  const idle = () => {
    if ('requestIdleCallback' in window) requestIdleCallback(prepareVisible, { timeout: 2000 })
    else setTimeout(prepareVisible, 500)
  }
  if (document.readyState === 'complete') idle()
  else window.addEventListener('load', idle, { once: true })
})()

