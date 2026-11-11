/*
  © 2024 KondaSoft
  https://www.kondasoft.com
*/

async function requestCart (url, options) {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 10000)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    const data = await response.json()
    return { response, data }
  } finally { window.clearTimeout(timer) }
}

class Cart extends HTMLElement {
  constructor () {
    super()

    this.querySelectorAll('[name="updates[]"]').forEach(input =>
      input.addEventListener('change', () =>
        this.change(input.dataset.lineItemKey, Number(input.value))
      )
    )

    this.querySelectorAll('.btn-line-item-remove').forEach(btn =>
      btn.addEventListener('click', () =>
        this.change(btn.dataset.lineItemKey, 0)
      )
    )

    this.showOffcanvasIfUrl()
    this.adjustCollapses()
  }

  async add (formData) {
    if (this.pending) return { ok: false, error: window.theme.locales.helios?.cart_add_error }
    this.pending = true
    this.setAttribute('aria-busy', 'true')
    const locked = [...this.querySelectorAll('.offcanvas-body, .offcanvas-footer')]
    locked.forEach(element => { element.inert = true })
    const progress = document.createElement('div')
    progress.className = 'wes-cart-progress'
    progress.setAttribute('role', 'status')
    const spinner = document.createElement('span')
    spinner.className = 'spinner-border spinner-border-sm'
    spinner.setAttribute('aria-hidden', 'true')
    const label = document.createElement('span')
    label.textContent = `${window.theme.locales.product.add_to_cart}…`
    progress.append(spinner, label)
    this.append(progress)
    document.querySelectorAll('.offcanvas').forEach(offcanvas => {
      const instance = window.bootstrap.Offcanvas.getOrCreateInstance(offcanvas)
      if (offcanvas.id === 'offcanvas-cart') instance.show()
      else instance.hide()
    })
    formData.set('sections', 'cart-count-badge,offcanvas-cart')
    formData.set('sections_url', window.location.pathname)
    try {
      const { response, data } = await requestCart(`${window.Shopify.routes.cart_add_url}.js`, {
        method: 'POST',
        body: formData
      })
      if (response.ok) {
        window.dispatchEvent(new CustomEvent('kt.cart.added', { detail: data }))
        if (!this.reloadCartElements(data.sections)) {
          window.location.href = window.Shopify.routes.cart_url
          return { ok: true }
        }
      } else this.showError(data.description)
      return { ok: response.ok, error: data.description }
    } catch (error) {
      this.showError(window.theme.locales.helios?.cart_network_error || window.theme.locales.helios?.cart_add_error)
      throw error
    } finally {
      this.pending = false
      this.removeAttribute('aria-busy')
      locked.forEach(element => { element.inert = false })
      progress.remove()
    }
  }

  async change (id, quantity) {
    this.classList.add('loading')
    try {
      const { response, data } = await requestCart(`${window.Shopify.routes.cart_change_url}.js`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          quantity,
          sections: ['cart-count-badge', 'offcanvas-cart'],
          sections_url: window.location.pathname
        })
      })

      if (response.ok) {
        window.dispatchEvent(new CustomEvent('kt.cart.changed', { detail: data }))
        if (!this.reloadCartElements(data.sections)) window.location.href = window.Shopify.routes.cart_url
      } else {
        this.showError(data.description)
      }
    } catch {
      this.showError((window.theme.locales.helios?.cart_update_error || 'Không thể cập nhật giỏ hàng. Vui lòng thử lại.'))
    } finally {
      this.classList.remove('loading')
    }
  }

  reloadCartElements (sections) {
    let updatedCart = false
    for (const [key, value] of Object.entries(sections || {})) {
      if (!value) continue
      const newDoc = new DOMParser().parseFromString(value, 'text/html')

      switch (key) {
      case 'cart-count-badge':
        document.querySelectorAll('.cart-count-badge').forEach(elem => {
          const newDoc = new DOMParser().parseFromString(value, 'text/html')
          const badge = newDoc.querySelector('.cart-count-badge')
          if (badge) elem.replaceWith(badge)
        })
        break
      case 'offcanvas-cart':
        if (newDoc.querySelector('cart-container')) {
          this.replaceWith(newDoc.querySelector('cart-container'))
          updatedCart = true
        }
        break
      }
    }

    window.dispatchEvent(new CustomEvent('kt.cart.reloaded'))
    return updatedCart
  }

  showError (message) {
    const alert = this.querySelector('.alert')

    if (alert) {
      alert.querySelector('[data-alert-msg]').textContent = message
      alert.removeAttribute('hidden')
    }
  }

  showOffcanvasIfUrl () {
    if (new URLSearchParams(window.location.search).has('cart')) {
      const offcanvas = document.querySelector('#offcanvas-cart')

      if (offcanvas) {
        window.bootstrap.Offcanvas.getOrCreateInstance(offcanvas).show()
      }
    }
  }

  adjustCollapses () {
    this.querySelectorAll('[data-bs-toggle="collapse"]').forEach(elem => {
      elem.addEventListener('click', () => {
        setTimeout(() => {
          const offcanvasBody = this.querySelector('.offcanvas-body')
          offcanvasBody.scroll({ top: offcanvasBody.scrollHeight, behavior: 'smooth' })
        }, 250)
      })
    })
  }
}
customElements.define('cart-container', Cart)

class CartNote extends HTMLElement {
  constructor () {
    super()

    this.input = this.querySelector('textarea')
    this.btn = this.querySelector('button')
    this.btn.addEventListener('click', this.onSubmit.bind(this))
  }

  async onSubmit () {
    this.btn.classList.add('loading')

    await fetch(`${window.Shopify.routes.cart_update_url}.js`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: this.input.value })
    })

    this.btn.innerHTML = `✓ <span class="visually-hidden">${this.btn.dataset.textNoteSaved}</span>`

    setTimeout(() => {
      this.btn.innerHTML = this.btn.dataset.textBtnSave
    }, 3000)

    this.btn.classList.remove('loading')
  }
}
customElements.define('cart-note', CartNote)

class WesCartPairings extends HTMLElement {
  connectedCallback () {
    this.controller?.abort()
    this.controller = new AbortController()
    const { signal } = this.controller
    this.addEventListener('change', event => {
      const select = event.target.closest('[data-pairing-variant]')
      if (!select) return
      const option = select.selectedOptions[0]
      const card = select.closest('.wes-cart-pairing')
      card.querySelector('[data-pairing-price]').textContent = option.dataset.price
      card.querySelector('[name="quantity"]').value = option.dataset.minimum
    }, { signal })
    this.addEventListener('submit', async event => {
      const form = event.target.closest('[data-pairing-form]')
      if (!form) return
      event.preventDefault()
      if (this.busy || !form.reportValidity()) return
      const cart = this.closest('cart-container')
      if (!cart) { form.submit(); return }
      this.busy = true
      this.setAttribute('aria-busy', 'true')
      this.querySelectorAll('button, select').forEach(control => { control.disabled = true })
      const data = new FormData(form)
      const variant = form.querySelector('[name="id"]')
      data.set('id', variant.value)
      try {
        await cart.add(data)
      } catch {
        cart.showError(this.dataset.error)
      } finally {
        this.busy = false
        this.removeAttribute('aria-busy')
        if (this.isConnected) this.querySelectorAll('button, select').forEach(control => { control.disabled = false })
      }
    }, { signal })
  }

  disconnectedCallback () {
    this.controller?.abort()
  }
}
customElements.define('wes-cart-pairings', WesCartPairings)


window.addEventListener('pageshow', async event => {
  if (!event.persisted) return
  const cart = document.querySelector('cart-container')
  if (!cart) return
  const url = new URL(location.href)
  url.searchParams.set('sections', 'cart-count-badge,offcanvas-cart')
  try {
    const { response, data } = await requestCart(url.href, { cache: 'no-store' })
    if (response.ok && cart.isConnected) cart.reloadCartElements(data)
  } catch (_) {}
})


class WesCartPairingsLoader extends HTMLElement {
  connectedCallback () {
    this.controller?.abort()
    this.controller = new AbortController()
    const panel = this.closest('.offcanvas')
    const schedule = () => {
      if ('requestIdleCallback' in window) requestIdleCallback(() => this.load(), { timeout: 700 })
      else setTimeout(() => this.load(), 0)
    }
    panel?.addEventListener('shown.bs.offcanvas', schedule, { signal: this.controller.signal })
    if (panel?.classList.contains('show') && !this.closest('cart-container')?.hasAttribute('aria-busy')) schedule()
  }

  async load () {
    if (!this.isConnected || this.loading || this.loaded || this.closest('cart-container')?.hasAttribute('aria-busy')) return
    this.loading = true
    const url = new URL(window.Shopify.routes.cart_url, location.origin)
    url.searchParams.set('section_id', 'wes-cart-pairings')
    try {
      const response = await fetch(url.href, { signal: this.controller.signal })
      if (!response.ok) return
      const doc = new DOMParser().parseFromString(await response.text(), 'text/html')
      const suggestions = doc.querySelector('wes-cart-pairings')
      if (!this.isConnected) return
      if (suggestions) this.replaceChildren(suggestions)
      this.loaded = true
    } catch (_) {} finally { this.loading = false }
  }

  disconnectedCallback () { this.controller?.abort() }
}
customElements.define('wes-cart-pairings-loader', WesCartPairingsLoader)
