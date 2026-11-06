(() => {
  const root = document.documentElement
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  let navigationTimer
  let fallbackTimer
  let entranceTimer
  const clear = () => {
    clearTimeout(navigationTimer)
    clearTimeout(fallbackTimer)
    clearTimeout(entranceTimer)
    clearTimeout(window.wesPageTransitionFailSafe)
    root.removeAttribute('data-wes-page-transition')
  }
  if (window.Shopify?.designMode || reduced.matches) { clear(); return }
  const ready = () => {
    const elapsed = performance.now() - (window.wesPageTransitionStarted || 0)
    entranceTimer = setTimeout(clear, Math.max(0, 160 - elapsed))
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, { once: true })
  else ready()
  window.addEventListener('pageshow', event => { if (event.persisted) clear() })
  window.addEventListener('pagehide', clear)
  window.addEventListener('popstate', clear)
  reduced.addEventListener('change', event => { if (event.matches) clear() })
  window.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || reduced.matches) return
    const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
    if (!anchor || anchor.hasAttribute('download') || anchor.target && anchor.target !== '_self' || anchor.hasAttribute('data-no-page-transition') || anchor.hasAttribute('data-bs-toggle') || anchor.hasAttribute('aria-controls') || anchor.getAttribute('role') === 'button' || anchor.hasAttribute('onclick')) return
    let url
    try { url = new URL(anchor.href, location.href) } catch (_) { return }
    if (!/^https?:$/.test(url.protocol) || url.origin !== location.origin) return
    if (url.pathname === location.pathname && url.search === location.search) return
    if (/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:cart|checkout|checkouts|account|apps|admin|payments|discount)(?:\/|$)/i.test(url.pathname)) return
    event.preventDefault()
    if (root.dataset.wesPageTransition === 'leaving') return
    clear()
    root.dataset.wesPageTransition = 'leaving'
    fallbackTimer = setTimeout(clear, 3500)
    navigationTimer = setTimeout(() => { window.location.assign(url.href) }, 120)
  })
})()
