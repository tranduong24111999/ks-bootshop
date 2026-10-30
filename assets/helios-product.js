/* Product-only enhancements. The server-rendered catalog remains usable without this script. */
class HeliosRecommendations extends HTMLElement {
  connectedCallback () {
    this.controller?.abort()
    this.controller = new AbortController()
    const { signal } = this.controller
    const list = this.querySelector('[data-recommendation-items]')
    const move = direction => list.scrollBy({ left: direction * list.clientWidth * 0.8, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
    this.querySelector('[data-related-prev]')?.addEventListener('click', () => move(-1), { signal })
    this.querySelector('[data-related-next]')?.addEventListener('click', () => move(1), { signal })
    if ('IntersectionObserver' in window) {
      this.observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) { this.observer.disconnect(); this.load() }
      }, { rootMargin: '300px' })
      this.observer.observe(this)
    } else this.load()
  }

  async load () {
    if (!this.dataset.url || this.dataset.personalized === 'true') return
    const timer = window.setTimeout(() => this.controller.abort(), 8000)
    try {
      const response = await fetch(this.dataset.url, { signal: this.controller.signal })
      if (!response.ok) return
      const html = new DOMParser().parseFromString(await response.text(), 'text/html')
      const replacement = html.querySelector('helios-recommendations[data-personalized="true"] [data-recommendation-items]')
      if (!replacement) return
      const items = [...replacement.children].filter(item => item.dataset.productId && item.dataset.productId !== this.dataset.productId)
      if (!items.length || !this.isConnected) return
      this.querySelector('[data-recommendation-items]').replaceChildren(...items)
      this.dataset.personalized = 'true'
      // These cards may be injected after the site's initial reveal observer.
      this.querySelectorAll('[data-helios-reveal]').forEach(card => card.classList.add('is-revealed'))
    } catch {
      // A cold/failed recommendation API must never erase the real catalog fallback.
    } finally { window.clearTimeout(timer) }
  }

  disconnectedCallback () { this.observer?.disconnect(); this.controller?.abort() }
}
if (!customElements.get('helios-recommendations')) customElements.define('helios-recommendations', HeliosRecommendations)

class HeliosBrandFilm extends HTMLElement {
  connectedCallback () {
    this.video = this.querySelector('video')
    if (!this.video || !('IntersectionObserver' in window)) return
    this.motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    this.observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting) && !this.motion.matches) this.video.play().catch(() => {})
      else this.video.pause()
    }, { threshold: 0.2 })
    this.observer.observe(this)
  }

  disconnectedCallback () { this.observer?.disconnect(); this.video?.pause() }
}
if (!customElements.get('helios-brand-film')) customElements.define('helios-brand-film', HeliosBrandFilm)
