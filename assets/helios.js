/* HELIOS progressive enhancements. Commerce APIs remain owned by KS BootShop. */
class HeliosCarousel extends HTMLElement {
  connectedCallback () {
    this.controller?.abort()
    this.controller = new AbortController()
    const { signal } = this.controller
    this.slides = Array.from(this.querySelectorAll('[data-helios-slide]'))
    this.index = 0
    this.interval = Number(this.dataset.autoplay) * 1000 || 0
    this.paused = false
    this.focused = false
    this.editorPaused = false
    this.motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const controls = this.querySelector('[data-helios-controls]')
    if (controls && this.slides.length > 1) controls.hidden = false
    this.querySelector('[data-helios-prev]')?.addEventListener('click', () => this.show(this.index - 1), { signal })
    this.querySelector('[data-helios-next]')?.addEventListener('click', () => this.show(this.index + 1), { signal })
    this.querySelector('[data-helios-toggle]')?.addEventListener('click', () => {
      this.paused = !this.paused
      this.updateAutoplay()
    }, { signal })
    // Pointer interaction must not leave autoplay suspended on the resume button.
    this.addEventListener('pointerdown', () => { this.focused = false; this.updateAutoplay() }, { signal })
    this.addEventListener('focusin', event => {
      this.focused = event.target.matches(':focus-visible')
      this.updateAutoplay()
    }, { signal })
    this.addEventListener('focusout', event => {
      this.focused = this.contains(event.relatedTarget) && event.relatedTarget.matches(':focus-visible')
      this.updateAutoplay()
    }, { signal })
    document.addEventListener('visibilitychange', () => this.updateAutoplay(), { signal })
    this.motion.addEventListener('change', () => this.updateAutoplay(), { signal })
    document.addEventListener('shopify:block:select', event => {
      const index = this.slides.findIndex(slide => slide === event.target || slide.contains(event.target))
      if (index >= 0) { this.editorPaused = true; this.show(index) }
    }, { signal })
    document.addEventListener('shopify:block:deselect', () => { this.editorPaused = false; this.updateAutoplay() }, { signal })
    this.updateAutoplay()
  }

  show (index, automatic = false) {
    if (!this.slides.length) return
    this.index = (index + this.slides.length) % this.slides.length
    this.slides.forEach((slide, position) => { slide.hidden = position !== this.index })
    const status = this.querySelector('[data-helios-status]')
    if (status) {
      status.setAttribute('aria-live', automatic ? 'off' : 'polite')
      status.textContent = `${this.index + 1} / ${this.slides.length}`
    }
    this.updateAutoplay()
  }

  updateAutoplay () {
    window.clearInterval(this.timer)
    const eligible = this.interval > 0 && this.slides.length > 1 && !this.motion.matches
    const toggle = this.querySelector('[data-helios-toggle]')
    if (toggle) {
      toggle.hidden = !eligible
      toggle.textContent = this.paused ? 'Tiếp tục' : 'Tạm dừng'
      toggle.setAttribute('aria-label', this.paused ? 'Tiếp tục tự động chuyển banner' : 'Tạm dừng tự động chuyển banner')
    }
    if (eligible && !this.paused && !this.focused && !this.editorPaused && !document.hidden) {
      const nextImage = this.slides[(this.index + 1) % this.slides.length].querySelector('img')
      if (nextImage) nextImage.loading = 'eager'
      this.timer = window.setInterval(() => this.show(this.index + 1, true), this.interval)
    }
  }

  disconnectedCallback () {
    window.clearInterval(this.timer)
    this.controller?.abort()
  }
}
if (!customElements.get('helios-carousel')) customElements.define('helios-carousel', HeliosCarousel)

// Delegation also supports header sections replaced by the Shopify theme editor.
document.addEventListener('click', event => {
  const menu = document.querySelector('[data-helios-menu]')
  if (!menu?.open) return
  if (event.target.closest('[data-helios-menu-close]')) {
    menu.open = false
    menu.querySelector('summary').focus()
  } else if (!menu.contains(event.target)) {
    menu.open = false
  }
})
document.addEventListener('keydown', event => {
  const menu = document.querySelector('[data-helios-menu]')
  if (event.key === 'Escape' && menu?.open) {
    menu.open = false
    menu.querySelector('summary').focus()
  }
})
