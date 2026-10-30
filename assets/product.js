/*
  © 2024 KondaSoft
  https://www.kondasoft.com
*/

class ProductForm extends HTMLElement {
  connectedCallback () {
    this.controller?.abort()
    this.controller = new AbortController()
    const { signal } = this.controller
    this.form = this.querySelector('form')
    if (!this.form) return
    this.form.querySelector('[data-variant-id]')?.removeAttribute('disabled')
    this.productOptions = this.form.querySelectorAll('.product-options [name*="option"]')
    this.atcBtn = this.form.querySelector('.btn-atc')
    this.buyBtn = this.form.querySelector('.btn-buy')
    if (!this.atcBtn) return
    this.labels = {
      available: this.atcBtn.dataset.labelAvailable || window.theme.locales.product.add_to_cart,
      soldOut: this.atcBtn.dataset.labelSoldOut || window.theme.locales.product.sold_out,
      unavailable: this.atcBtn.dataset.labelUnavailable || window.theme.locales.product.unavailable
    }
    this.initialDisabled = this.atcBtn.disabled
    this.submitting = false
    try { this.variants = JSON.parse(this.form.dataset.variants || '[]') } catch { this.variants = [] }
    this.selectedVariant = this.variants.find(variant => String(variant.id) === this.form.querySelector('[name="id"]')?.value)
    this.form.addEventListener('submit', event => this.onSubmit(event), { signal })
    this.productOptions.forEach(input => input.addEventListener('change', event => this.onChangeProductOption(event), { signal }))
    this.buyBtn?.addEventListener('click', event => this.onClickBuyBtn(event), { signal })
    this.form.querySelectorAll('[data-quantity-change]').forEach(button => {
      button.addEventListener('click', () => {
        const input = this.form.querySelector('[name="quantity"]')
        const minimum = Number(input.min) || 1
        const maximum = Number(input.max) || Infinity
        const step = Number(input.step) || 1
        const value = Number.isFinite(input.valueAsNumber) ? input.valueAsNumber : minimum
        input.value = String(Math.min(maximum, Math.max(minimum, value + Number(button.dataset.quantityChange) * step)))
        input.dispatchEvent(new Event('change', { bubbles: true }))
      }, { signal })
    })
    this.form.querySelector('[name="quantity"]')?.addEventListener('change', () => this.updateQuantityButtons(), { signal })
    this.updateQuantityButtons()
  }

  updateQuantityButtons () {
    const input = this.form.querySelector('[name="quantity"]')
    if (!input) return
    const minimum = Number(input.min) || 1
    const maximum = Number(input.max) || Infinity
    const minus = this.form.querySelector('[data-quantity-change="-1"]')
    const plus = this.form.querySelector('[data-quantity-change="1"]')
    if (minus) minus.disabled = !Number.isFinite(input.valueAsNumber) || input.valueAsNumber <= minimum
    if (plus) plus.disabled = input.valueAsNumber >= maximum
  }

  onChangeProductOption (event) {
    event.preventDefault()
    const selectedOptions = []
    this.productOptions.forEach(input => {
      if ((input.type === 'radio' && input.checked) || input.type === 'select-one') selectedOptions.push(input.value)
    })
    this.selectedVariant = this.variants.find(variant => JSON.stringify(variant.options) === JSON.stringify(selectedOptions)) || null
    this.form.querySelector('[name="id"]').value = this.selectedVariant?.id || ''
    const quantity = this.form.querySelector('[name="quantity"]')
    const rule = this.selectedVariant?.quantity_rule
    if (quantity && rule) {
      quantity.min = String(rule.min || 1)
      quantity.step = String(rule.increment || 1)
      if (rule.max) quantity.max = String(rule.max)
      else quantity.removeAttribute('max')
      if (Number(quantity.value) < Number(quantity.min)) quantity.value = quantity.min
      this.updateQuantityButtons()
    }
    this.adjustPricing(this.selectedVariant)
    this.adjustButtons(this.selectedVariant)
    if (this.selectedVariant && this.closest('.product-main')) {
      const url = new URL(window.location)
      url.searchParams.set('variant', this.selectedVariant.id)
      window.history.replaceState({}, '', url)
    }
    if (this.selectedVariant) {
      window.dispatchEvent(new CustomEvent('kt.product.variant.change', {
        detail: { ...this.selectedVariant, product_id: this.form.dataset.productid }
      }))
    }
  }

  adjustPricing (variant) {
    const comparePrice = this.form.querySelector('.product-price-compare')
    const finalPrice = this.form.querySelector('.product-price-final')
    const compareBadge = this.form.querySelector('.product-sale-badge')
    const soldOutBadge = this.form.querySelector('.product-sold-out-badge')
    const discounted = variant && variant.compare_at_price > variant.price
    if (comparePrice) {
      comparePrice.hidden = !discounted
      comparePrice.innerHTML = discounted ? window.Shopify.formatMoney(variant.compare_at_price) : ''
    }
    if (finalPrice) {
      finalPrice.innerHTML = variant ? window.Shopify.formatMoney(variant.price) : ''
      finalPrice.classList.toggle('product-price-final-sale', !!discounted)
    }
    if (compareBadge) {
      compareBadge.hidden = !discounted
      if (discounted) {
        const savings = compareBadge.dataset.discountType === 'percentage'
          ? `${100 - Math.round(variant.price / variant.compare_at_price * 100)}%`
          : window.Shopify.formatMoney(variant.compare_at_price - variant.price)
        compareBadge.innerHTML = `${window.theme.locales.product.save} ${savings}`
      }
    }
    if (soldOutBadge) soldOutBadge.hidden = !variant || variant.available
  }

  adjustButtons (variant = this.selectedVariant) {
    const available = variant === undefined ? !this.initialDisabled : !!variant?.available
    this.atcBtn.disabled = this.submitting || !available
    if (this.buyBtn) this.buyBtn.disabled = this.submitting || !available
    this.atcBtn.textContent = available ? this.labels.available : variant ? this.labels.soldOut : this.labels.unavailable
  }

  showError (message) {
    let error = this.form.querySelector('.product-form-error')
    if (!error) { error = document.createElement('p'); error.className = 'product-form-error'; error.setAttribute('role', 'alert'); this.form.append(error) }
    error.textContent = message
    error.hidden = !message
  }

  validSelection () {
    return /^\d+$/.test(this.form.querySelector('[name="id"]')?.value || '') && this.selectedVariant !== null && this.selectedVariant?.available !== false && (this.selectedVariant !== undefined || !this.initialDisabled)
  }

  async onSubmit (event) {
    const cart = document.querySelector('cart-container')
    if (!cart) return // Native Shopify form submission remains the fallback.
    event.preventDefault()
    if (this.submitting) return
    if (!this.form.reportValidity() || !this.validSelection()) {
      this.showError('Vui lòng chọn mẫu/size còn hàng và số lượng hợp lệ.')
      return
    }
    this.showError('')
    this.submitting = true
    this.atcBtn.classList.add('loading')
    this.atcBtn.setAttribute('aria-busy', 'true')
    this.adjustButtons()
    try {
      const result = await cart.add(new FormData(this.form))
      if (result?.ok === false) this.showError(result.error || 'Không thể thêm sản phẩm. Vui lòng thử lại.')
    } catch { this.showError('Không thể kết nối giỏ hàng. Vui lòng thử lại.') } finally {
      this.submitting = false
      this.atcBtn.classList.remove('loading')
      this.atcBtn.setAttribute('aria-busy', 'false')
      this.adjustButtons()
    }
  }

  onClickBuyBtn (event) {
    event.preventDefault()
    if (this.submitting || !this.form.reportValidity() || !this.validSelection()) {
      this.showError('Vui lòng chọn mẫu/size còn hàng và số lượng hợp lệ.')
      return
    }
    this.buyBtn.classList.add('loading')
    const variantId = this.form.querySelector('[name="id"]').value
    const quantity = Number(this.form.querySelector('[name="quantity"]')?.value || 1)
    const cartUrl = window.Shopify.routes.cart_url.replace(/\/$/, '')
    window.location.href = `${cartUrl}/${variantId}:${quantity}`
  }

  disconnectedCallback () { this.controller?.abort() }
}
customElements.define('product-form', ProductForm)

class ProductMediaGallery extends HTMLElement {
  constructor () {
    super()

    const initialSlide = Number(this.dataset.initialSlide)

    /** @type {Swiper} */
    this.thumbs = new window.Swiper(this.querySelector('.swiper-thumbs'), this.thumbsOptions())

    /** @type {Swiper} */
    this.main = new window.Swiper(this.querySelector('.swiper-main'), this.mainOptions())

    this.main.slideTo(initialSlide)
    this.initZoom()
    this.main.on('slideChange', () => {
      this.querySelectorAll('.swiper-main video').forEach(video => video.pause())
      const button = this.querySelector('[data-gallery-zoom]')
      if (button) button.disabled = !this.main.slides[this.main.activeIndex]?.querySelector('img')
    })

    this.setStickyPosition()
    this.listenVariantChange()
  }

  thumbsOptions () {
    /** @type {SwiperOptions} */
    const options = {
      slidesPerView: Number(this.dataset.thumbsPerView),
      spaceBetween: 10,
      watchSlidesProgress: true,
      breakpoints: { 1024: { direction: 'vertical', slidesPerView: 'auto' } }
    }
    return options
  }

  initZoom () {
    const dialog = this.querySelector('.helios-gallery-dialog')
    if (!dialog) return
    this.classList.add('has-image-zoom')
    const openZoom = () => {
      const image = this.querySelector('.swiper-main .swiper-slide-active img')
      if (!image) return
      const url = new URL(image.currentSrc || image.src, window.location.href)
      url.searchParams.set('width', '2000')
      url.searchParams.delete('height')
      const enlarged = dialog.querySelector('img')
      enlarged.src = url.toString()
      enlarged.alt = image.alt || enlarged.alt
      if (!dialog.open) dialog.showModal()
    }
    this.querySelector('[data-gallery-zoom]')?.addEventListener('click', openZoom)
    this.querySelector('.swiper-main')?.addEventListener('click', event => {
      if (this.main.allowClick && event.target.closest('.swiper-slide-active img')) openZoom()
    })
    dialog.querySelector('[data-gallery-close]').addEventListener('click', () => dialog.close())
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close() })
  }

  mainOptions () {
    /** @type {SwiperOptions} */
    const options = {
      speed: Number(this.dataset.speed),
      rewind: true,
      pagination: {
        type: 'bullets',
        el: this.querySelector('.swiper-main .swiper-pagination'),
        dynamicBullets: true,
        dynamicMainBullets: 2,
        renderFraction: function (currentClass, totalClass) {
          return `<span class="${currentClass}"></span>/<span class="${totalClass}"></span>`
        }
      },
      navigation: {
        nextEl: this.querySelector('.swiper-button-next'),
        prevEl: this.querySelector('.swiper-button-prev')
      },
      thumbs: {
        swiper: this.thumbs,
        autoScrollOffset: 1
      }
    }
    return options
  }

  setStickyPosition () {
    if (this.closest('.product-main') && window.matchMedia('(min-width: 1200px)').matches) {
      const headerGroup = document.querySelector('#header-group.sticky-top')

      let oldScroll = window.scrollY

      window.addEventListener('scroll', () => {
        const newScroll = window.scrollY
        if (newScroll > oldScroll) {
          if (newScroll > headerGroup.clientHeight) {
            this.style.top = '20px'
          }
        } else if (newScroll < oldScroll) {
          this.style.top = `${headerGroup.clientHeight + 20}px`
        }

        oldScroll = Math.max(window.scrollY, 0)
      })
    }
  }

  listenVariantChange () {
    window.addEventListener('kt.product.variant.change', (event) => {
      const selectedVariant = event.detail

      if (selectedVariant?.product_id && String(selectedVariant.product_id) !== this.dataset.productId) return
      const position = selectedVariant?.featured_media?.position || selectedVariant?.featured_image?.position
      if (position) {
        this.main.slideTo(position - 1)
      }
    }, false)
  }
}
customElements.define('product-media-gallery', ProductMediaGallery)

// Shopify Subscriptions app
const adjustShopifySubscriptionsStyling = () => {
  document.querySelectorAll('.shopify_subscriptions_app_block [type="radio"]').forEach(radio => {
    radio.classList.add('form-check-input')
  })
}
adjustShopifySubscriptionsStyling()
window.addEventListener('kt.product.quick_view.modal_shown', adjustShopifySubscriptionsStyling)
