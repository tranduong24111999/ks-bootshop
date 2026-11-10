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
    formData.append('sections', ['cart-count-badge', 'offcanvas-cart'])
    formData.append('sections_url', window.location.pathname)

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
    } else {
      this.showError(data.description)
    }

    document.querySelectorAll('.offcanvas').forEach(offcanvas => {
      if (offcanvas.id === 'offcanvas-cart') {
        window.bootstrap.Offcanvas.getOrCreateInstance(offcanvas).show()
      } else {
        window.bootstrap.Offcanvas.getOrCreateInstance(offcanvas).hide()
      }
    })
    return { ok: response.ok, error: data.description }
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
