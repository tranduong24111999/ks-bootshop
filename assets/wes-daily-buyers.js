class WesDailyBuyers extends HTMLElement {
  connectedCallback () {
    this.controller = new AbortController()
    this.busy = false
    this.check()
    this.timer = setInterval(() => { this.check(); this.refresh() }, 60000)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) { this.check(); this.refresh() }
    }, { signal: this.controller.signal })
  }
  check () {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    const age = Date.now() - Date.parse(this.dataset.updatedAt)
    const count = Number(this.dataset.count)
    this.hidden = !(Number.isSafeInteger(count) && count > 0 && this.dataset.date === today && Number.isFinite(age) && age >= -60000 && age <= 900000)
  }
  async refresh () {
    if (this.busy || document.hidden || !this.dataset.sectionId) return
    this.busy = true
    try {
      const url = new URL(this.dataset.productUrl, location.origin)
      url.searchParams.set('sections', this.dataset.sectionId)
      const response = await fetch(url, { credentials: 'same-origin', signal: this.controller.signal })
      if (!response.ok) return
      const sections = await response.json()
      const html = sections[this.dataset.sectionId]
      if (typeof html !== 'string') return
      const doc = new DOMParser().parseFromString(html, 'text/html')
      const fresh = [...doc.querySelectorAll('wes-daily-buyers')].find(el => el.dataset.productId === this.dataset.productId)
      if (!fresh) return
      this.dataset.date = fresh.dataset.date
      this.dataset.count = fresh.dataset.count
      this.dataset.updatedAt = fresh.dataset.updatedAt
      this.replaceChildren(...fresh.childNodes)
      this.check()
    } catch (error) {
      if (error.name !== 'AbortError') this.check()
    } finally { this.busy = false }
  }
  disconnectedCallback () { clearInterval(this.timer); this.controller.abort() }
}
if (!customElements.get('wes-daily-buyers')) customElements.define('wes-daily-buyers', WesDailyBuyers)
