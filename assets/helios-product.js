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
    if (!this.dataset.url || this.dataset.personalized === 'true' || this.dataset.manual === 'true') return
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

// Only recommendation cards opt in. Never start offscreen media or manufacture product footage.
if (!customElements.get('helios-product-media')) {
  class HeliosProductMedia extends HTMLElement {
    connectedCallback () {
      this.controller?.abort()
      this.controller = new AbortController()
      const { signal } = this.controller
      this.video = this.querySelector('[data-motion-video]')
      if (this.video) { this.video.muted = true; this.video.defaultMuted = true; this.video.playsInline = true }
      this.second = this.querySelector('.helios-product-card__second')
      this.button = this.closest('article')?.querySelector('[data-card-motion-toggle]')
      this.motion = window.matchMedia('(prefers-reduced-motion: reduce)')
      this.visible = false
      this.paused = false
      this.focused = false
      this.videoFailed = false
      if (!('IntersectionObserver' in window)) return
      this.observer?.disconnect()
      this.observer = new IntersectionObserver(entries => {
        this.visible = entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.25)
        this.update()
      }, { threshold: 0.25 })
      this.observer.observe(this)
      this.button?.addEventListener('click', () => { this.paused = !this.paused; this.update() }, { signal })
      this.motion.addEventListener('change', () => this.update(), { signal })
      document.addEventListener('visibilitychange', () => this.update(), { signal })
      const article = this.closest('article')
      article?.addEventListener('focusin', event => { this.focused = event.target.matches(':focus-visible'); this.update() }, { signal })
      article?.addEventListener('focusout', event => {
        this.focused = !!(event.relatedTarget && article.contains(event.relatedTarget) && event.relatedTarget.matches(':focus-visible'))
        this.update()
      }, { signal })
      this.video?.addEventListener('playing', () => { if (this.canPlay()) this.classList.add('is-video-ready') }, { signal })
      this.video?.addEventListener('error', () => this.failVideo(), { signal })
      this.update()
    }

    failVideo () {
      if (this.videoFailed) return
      this.videoFailed = true
      this.video?.pause()
      this.classList.remove('is-video-ready')
      this.update()
    }

    canPlay () { return this.isConnected && this.visible && !this.motion.matches && !this.paused && !this.focused && !document.hidden }

    update () {
      window.clearTimeout(this.timer)
      const available = !!((this.video && !this.videoFailed) || this.second)
      const enabled = available && !this.motion.matches
      this.classList.toggle('is-motion-enabled', enabled)
      if (this.button) {
        this.button.hidden = !enabled
        this.button.textContent = this.paused ? '▷' : 'Ⅱ'
        this.button.setAttribute('aria-label', this.paused ? this.button.dataset.resumeLabel : this.button.dataset.pauseLabel)
      }
      if (!this.canPlay()) {
        this.video?.pause()
        if (!enabled) this.classList.remove('is-video-ready', 'is-motion-second')
        return
      }
      if (this.video && !this.videoFailed) {
        // Assign a direct src only in view. Empty <source> nodes can emit a premature error before lazy initialization.
        if (this.video.dataset.motionSrc && !this.video.getAttribute('src')) { this.video.src = this.video.dataset.motionSrc; this.video.load() }
        this.video.play().then(() => {
          if (!this.canPlay()) this.video.pause()
        }).catch(error => {
          if (!this.isConnected || !this.canPlay() || this.videoFailed || error.name === 'AbortError') return
          this.failVideo()
        })
      } else if (this.second) {
        this.second.loading = 'eager'
        this.timer = window.setTimeout(() => {
          if (!this.canPlay()) return
          if (this.second.complete && this.second.naturalWidth > 0) this.classList.toggle('is-motion-second')
          this.update()
        }, 5000 + (Number(this.dataset.offset) || 0) % 4 * 300)
      }
    }

    disconnectedCallback () {
      window.clearTimeout(this.timer)
      this.video?.pause()
      this.observer?.disconnect()
      this.controller?.abort()
    }
  }
  customElements.define('helios-product-media', HeliosProductMedia)
}
