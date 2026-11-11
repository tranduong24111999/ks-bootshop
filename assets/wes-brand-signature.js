if (!customElements.get('wes-brand-marquee')) {
  class WesBrandMarquee extends HTMLElement {
    connectedCallback () {
      this.controller?.abort()
      this.observer?.disconnect()
      this.controller = new AbortController()
      const button = this.querySelector('button')
      button?.addEventListener('click', () => {
        const paused = this.classList.toggle('is-paused')
        button.setAttribute('aria-pressed', String(paused))
      }, { signal: this.controller.signal })
      const update = () => {
        this.querySelectorAll('.wes-brand-signature__track').forEach(track => {
          track.style.animationPlayState = document.hidden || !this.visible ? 'paused' : ''
        })
      }
      this.visible = !('IntersectionObserver' in window)
      if ('IntersectionObserver' in window) {
        this.observer = new IntersectionObserver(entries => {
          this.visible = entries.some(entry => entry.isIntersecting)
          update()
        })
        this.observer.observe(this)
      }
      document.addEventListener('visibilitychange', update, { signal: this.controller.signal })
      update()
    }
    disconnectedCallback () {
      this.controller?.abort()
      this.observer?.disconnect()
    }
  }
  customElements.define('wes-brand-marquee', WesBrandMarquee)
}
