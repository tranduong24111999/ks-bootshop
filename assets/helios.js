/* HELIOS progressive enhancements. Commerce APIs remain owned by KS BootShop. */
class HeliosCarousel extends HTMLElement {
  connectedCallback () {
    this.controller?.abort()
    this.controller = new AbortController()
    const { signal } = this.controller
    this.slides = Array.from(this.querySelectorAll('[data-helios-slide]'))
    this.slides.forEach((slide, index) => {
      slide.classList.toggle('is-active', index === 0)
      slide.inert = index !== 0
    })
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
    this.querySelectorAll('[data-helios-dot]').forEach(dot => {
      dot.addEventListener('click', () => this.show(Number(dot.dataset.heliosDot)), { signal })
    })
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
    const previous = this.slides[this.index]
    this.transition?.cancel()
    this.exitTransition?.cancel()
    this.index = (index + this.slides.length) % this.slides.length
    const current = this.slides[this.index]
    const animated = !this.motion.matches && current !== previous
    this.slides.forEach((slide, position) => {
      slide.hidden = position !== this.index && !(animated && slide === previous)
      slide.inert = position !== this.index
      slide.classList.toggle('is-active', position === this.index)
      slide.setAttribute('aria-hidden', String(position !== this.index))
      slide.style.zIndex = position === this.index ? '2' : '1'
    })
    if (animated) {
      if (this.classList.contains('helios-hero')) {
        // Keep the outgoing image fully visible underneath: the blend never passes through black.
        this.transition = current.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 1400,
          easing: 'cubic-bezier(.4,0,.2,1)'
        })
      } else {
        const timing = { duration: 450, easing: 'cubic-bezier(.25,.46,.45,.94)' }
        this.transition = current.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], timing)
        this.exitTransition = previous.animate([{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-8px)' }], timing)
      }
      this.transition.finished.then(() => { if (previous !== this.slides[this.index]) previous.hidden = true }).catch(() => {})
    }
    this.querySelectorAll('[data-helios-dot]').forEach(dot => dot.setAttribute('aria-current', String(Number(dot.dataset.heliosDot) === this.index)))
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
      toggle.textContent = this.paused ? '▷' : 'Ⅱ'
      const label = this.classList.contains('helios-announcement') ? 'thông báo' : 'banner'
      toggle.setAttribute('aria-label', `${this.paused ? 'Tiếp tục' : 'Tạm dừng'} tự động chuyển ${label}`)
    }
    if (eligible && !this.paused && !this.focused && !this.editorPaused && !document.hidden) {
      const nextImage = this.slides[(this.index + 1) % this.slides.length].querySelector('img')
      if (nextImage) nextImage.loading = 'eager'
      this.timer = window.setInterval(() => this.show(this.index + 1, true), this.interval)
    }
  }

  disconnectedCallback () {
    window.clearInterval(this.timer)
    this.transition?.cancel()
    this.exitTransition?.cancel()
    this.controller?.abort()
  }
}
if (!customElements.get('helios-carousel')) customElements.define('helios-carousel', HeliosCarousel)

// Delegation also supports header sections replaced by the Shopify theme editor.
document.addEventListener('click', event => {
  document.querySelectorAll('[data-helios-disclosure][open]').forEach(menu => {
    if (event.target.closest('[data-helios-menu-close]')) {
      menu.open = false
      menu.querySelector('summary').focus()
    } else if (!menu.contains(event.target)) menu.open = false
  })
})
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return
  document.querySelectorAll('[data-helios-disclosure][open]').forEach(menu => {
    menu.open = false
    menu.querySelector('summary').focus()
  })
})

const hoverMedia = window.matchMedia('(min-width: 768px) and (hover: hover)')
const revealObserver = 'IntersectionObserver' in window
  ? new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('is-revealed'); revealObserver.unobserve(entry.target) }
  }), { threshold: 0.08 })
  : null

function initHelios (root = document) {
  root.querySelectorAll('[data-helios-disclosure]').forEach(menu => {
    if (menu.dataset.heliosBound) return
    menu.dataset.heliosBound = 'true'
    let closeTimer
    menu.addEventListener('pointerenter', () => {
      window.clearTimeout(closeTimer)
      if (hoverMedia.matches) menu.open = true
    })
    menu.addEventListener('pointerleave', () => {
      if (hoverMedia.matches) closeTimer = window.setTimeout(() => { menu.open = false }, 120)
    })
    menu.addEventListener('toggle', () => {
      if (menu.matches('[data-helios-menu]')) document.body.classList.toggle('helios-menu-open', menu.open)
    })
    menu.querySelectorAll('.helios-mega__group').forEach(group => { group.open = window.innerWidth >= 768 })
  })
  root.querySelectorAll('[data-helios-reveal]').forEach(element => {
    if (revealObserver) revealObserver.observe(element)
    else element.classList.add('is-revealed')
  })
}
initHelios()
if (revealObserver) document.body.classList.add('helios-motion')
document.addEventListener('shopify:section:load', event => initHelios(event.target))
const header = document.querySelector('.helios-header')
if (header && 'ResizeObserver' in window) {
  new ResizeObserver(() => document.body.style.setProperty('--helios-header-height', `${header.getBoundingClientRect().height}px`)).observe(header)
}
window.addEventListener('scroll', () => document.body.classList.toggle('has-helios-scrolled', window.scrollY > 40), { passive: true })

class HeliosTabs extends HTMLElement {
  connectedCallback () {
    this.controller?.abort()
    this.controller = new AbortController()
    const { signal } = this.controller
    const tabs = [...this.querySelectorAll('[data-helios-tab]')]
    const panels = [...this.querySelectorAll('[data-helios-panel]')]
    if (!tabs.length) return
    this.classList.add('is-enhanced')
    this.querySelector('[data-helios-tab-list]').setAttribute('role', 'tablist')
    const select = index => {
      tabs.forEach((tab, i) => { tab.setAttribute('role', 'tab'); tab.setAttribute('aria-selected', String(i === index)); tab.tabIndex = i === index ? 0 : -1 })
      panels.forEach((panel, i) => { panel.setAttribute('role', 'tabpanel'); panel.hidden = i !== index })
    }
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', event => { event.preventDefault(); select(index) }, { signal })
      tab.addEventListener('keydown', event => {
        let next
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
        if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length
        if (event.key === 'Home') next = 0
        if (event.key === 'End') next = tabs.length - 1
        if (next !== undefined) { event.preventDefault(); select(next); tabs[next].focus() }
      }, { signal })
    })
    select(0)
  }

  disconnectedCallback () { this.controller?.abort() }
}
if (!customElements.get('helios-tabs')) customElements.define('helios-tabs', HeliosTabs)
