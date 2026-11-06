class WesBrandMarquee extends HTMLElement {
  connectedCallback () {
    this.controller?.abort()
    this.controller = new AbortController()
    const button = this.querySelector('button')
    button?.addEventListener('click', () => {
      const paused = this.classList.toggle('is-paused')
      button.setAttribute('aria-pressed', String(paused))
    }, { signal: this.controller.signal })
  }
  disconnectedCallback () { this.controller?.abort() }
}
if (!customElements.get('wes-brand-marquee')) customElements.define('wes-brand-marquee', WesBrandMarquee)
