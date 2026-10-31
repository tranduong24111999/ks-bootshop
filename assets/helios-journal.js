class HeliosJournal extends HTMLElement {
  connectedCallback () {
    this.controller?.abort()
    this.controller = new AbortController()
    const { signal } = this.controller
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const dialog = this.querySelector('dialog')
    const player = dialog.querySelector('video')
    const videos = this.querySelectorAll('.helios-journal__film > video')
    const sync = video => {
      if (video.dataset.visible === 'true' && !reduced.matches && !document.hidden && !dialog.open) video.play().catch(() => {})
      else video.pause()
    }
    this.observer?.disconnect()
    this.observer = new IntersectionObserver(entries => entries.forEach(entry => { entry.target.dataset.visible = String(entry.isIntersecting); sync(entry.target) }), { threshold: 0.25 })
    videos.forEach(video => this.observer.observe(video))
    reduced.addEventListener('change', () => videos.forEach(sync), { signal })
    document.addEventListener('visibilitychange', () => videos.forEach(sync), { signal })
    this.querySelectorAll('[data-journal-watch]').forEach(link => link.addEventListener('click', event => {
      event.preventDefault()
      player.src = link.href
      dialog.showModal()
      videos.forEach(sync)
      player.play().catch(() => {})
    }, { signal }))
    this.querySelector('[data-journal-close]').addEventListener('click', () => dialog.close(), { signal })
    dialog.addEventListener('close', () => { player.pause(); player.removeAttribute('src'); player.load(); videos.forEach(sync) }, { signal })
  }

  disconnectedCallback () {
    this.controller?.abort()
    this.observer?.disconnect()
    this.querySelectorAll('video').forEach(video => video.pause())
  }
}
if (!customElements.get('helios-journal')) customElements.define('helios-journal', HeliosJournal)
