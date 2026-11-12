(() => {
  if (customElements.get('wes-deferred-section')) return
  const resources = new Map()
  let manifestPromise
  const resource = (url, type) => {
    if (resources.has(url)) return resources.get(url)
    const existing = type === 'style'
      ? [...document.querySelectorAll('link[rel="stylesheet"]')].find(node => node.href === url)
      : [...document.scripts].find(node => node.src === url)
    if (existing) return Promise.resolve()
    const promise = new Promise((resolve, reject) => {
      const node = document.createElement(type === 'style' ? 'link' : 'script')
      if (type === 'style') { node.rel = 'stylesheet'; node.href = url }
      else { node.type = type === 'module' ? 'module' : 'text/javascript'; node.src = url }
      const timer = setTimeout(() => { node.remove(); resources.delete(url); reject(new Error('Resource timeout')) }, 10000)
      node.onload = () => { clearTimeout(timer); resolve() }
      node.onerror = () => { clearTimeout(timer); node.remove(); resources.delete(url); reject(new Error('Resource unavailable')) }
      document.head.append(node)
    })
    resources.set(url, promise)
    return promise
  }
  const hydrateReviews = async root => {
    const widget = root.querySelector('.jdgm-review-widget[data-entry-point]')
    if (!widget) return
    const base = window.jdgm?.CDN_BASE_URL
    if (!base) throw new Error('Review loader unavailable')
    const baseURL = new URL(base, location.href)
    const entry = new URL(widget.dataset.entryPoint, baseURL)
    if (entry.origin !== baseURL.origin || entry.protocol !== 'https:') throw new Error('Invalid review resource')
    if (!manifestPromise) manifestPromise = fetch(new URL('manifest.json?v=' + Date.now(), baseURL)).then(response => {
      if (!response.ok) throw new Error('Manifest unavailable')
      return response.json()
    }).catch(error => { manifestPromise = null; throw error })
    try {
      const manifest = await manifestPromise
      const visited = new Set()
      const styles = new Set()
      const collect = key => {
        if (visited.has(key)) return
        visited.add(key)
        const item = manifest[key]
        item?.css?.forEach(path => {
          const url = new URL(path, baseURL)
          if (url.origin === baseURL.origin) styles.add(url.href)
        })
        item?.imports?.forEach(collect)
      }
      collect(widget.dataset.entryKey)
      await Promise.all([...styles].map(url => resource(url, 'style')))
    } catch (_) {}
    await resource(entry.href, 'module')
  }
  class WesDeferredSection extends HTMLElement {
    connectedCallback () {
      if (this.dataset.loaded === 'true') return
      this.setAttribute('aria-busy', 'true')
      this.fallback = this.querySelector('noscript[data-deferred-fallback]')?.textContent || ''
      this.controller?.abort()
      this.controller = new AbortController()
      this.observer?.disconnect()
      if ('IntersectionObserver' in window) {
        this.observer = new IntersectionObserver(entries => {
          if (entries.some(entry => entry.isIntersecting)) { this.observer.disconnect(); this.load() }
        }, { rootMargin: '250px 0px' })
        this.observer.observe(this)
      } else this.load()
      document.addEventListener('click', event => {
        if (this.dataset.kind !== 'reviews') return
        const link = event.target.closest?.('a[href*="#judgeme"], .jdgm-prev-badge, .jdgm-preview-badge, .jdgm-write-rev-link')
        if (link) this.load()
      }, { signal: this.controller.signal, capture: true })
    }
    async load () {
      if (!this.isConnected || this.loading || this.dataset.loaded === 'true') return
      this.loading = true
      this.setAttribute('aria-busy', 'true')
      let html = this.fallback
      if (!html.trim()) {
        const timer = setTimeout(() => this.controller.abort(), 8000)
        try {
          const url = new URL(this.dataset.endpoint || location.href, location.origin)
          if (url.origin !== location.origin) throw new Error('Invalid section')
          if (!this.dataset.endpoint) url.searchParams.set('section_id', this.dataset.sectionId)
          const response = await fetch(url.href, { signal: this.controller.signal })
          if (!response.ok) throw new Error('Section unavailable')
          html = await response.text()
          if (html.includes('<wes-deferred-section')) throw new Error('Section not rendered')
        } catch (_) { html = this.fallback } finally { clearTimeout(timer) }
      }
      if (!this.isConnected) return
      try {
        const doc = new DOMParser().parseFromString(html || this.fallback, 'text/html')
        const source = doc.getElementById('shopify-section-' + this.dataset.sectionId) || doc.body
        const scripts = [...source.querySelectorAll('script')].filter(script => !['application/ld+json', 'application/json'].includes(script.type))
        scripts.forEach(script => script.remove())
        this.replaceChildren(...source.childNodes)
        window.initHelios?.(this)
        for (const script of scripts) {
          if (script.src) await resource(new URL(script.getAttribute('src'), location.href).href, script.type === 'module' ? 'module' : 'script')
          else if (script.classList.contains('jdgm-review-widget-data')) {
            const data = document.createElement('script')
            data.textContent = script.textContent
            document.head.append(data)
            data.remove()
          }
        }
        if (this.dataset.kind === 'reviews') await hydrateReviews(this)
        this.dataset.loaded = 'true'
        this.dispatchEvent(new CustomEvent('wes.section.loaded', { bubbles: true, detail: { sectionId: this.dataset.sectionId } }))
      } catch (_) {
        this.classList.add('wes-deferred-fallback')
        this.querySelectorAll('.jdgm-legacy-widget-content').forEach(node => { node.style.display = '' })
        this.dataset.loaded = 'true'
      } finally {
        this.loading = false
        this.removeAttribute('aria-busy')
      }
    }
    disconnectedCallback () {
      this.observer?.disconnect()
      this.controller?.abort()
    }
  }
  customElements.define('wes-deferred-section', WesDeferredSection)
})()
