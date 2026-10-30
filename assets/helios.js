/* HELIOS progressive enhancements. No autoplay or commerce API overrides. */
class HeliosCarousel extends HTMLElement {
  connectedCallback () {
    this.controller?.abort()
    this.controller = new AbortController()
    const { signal } = this.controller
    this.slides = Array.from(this.querySelectorAll('[data-helios-slide]'))
    this.index = 0
    const controls = this.querySelector('[data-helios-controls]')
    if (controls && this.slides.length > 1) controls.hidden = false
    this.querySelector('[data-helios-prev]')?.addEventListener('click', () => this.show(this.index - 1), { signal })
    this.querySelector('[data-helios-next]')?.addEventListener('click', () => this.show(this.index + 1), { signal })
    document.addEventListener('shopify:block:select', event => {
      const index = this.slides.findIndex(slide => slide === event.target || slide.contains(event.target))
      if (index >= 0) this.show(index)
    }, { signal })
  }

  show (index) {
    this.index = (index + this.slides.length) % this.slides.length
    this.slides.forEach((slide, position) => { slide.hidden = position !== this.index })
    const status = this.querySelector('[data-helios-status]')
    if (status) status.textContent = `${this.index + 1} / ${this.slides.length}`
  }

  disconnectedCallback () {
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
