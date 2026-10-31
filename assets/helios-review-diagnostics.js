/* Editor-only, read-only diagnostics. Never alter IDs, review visibility, app initialization or moderation. */
if (!customElements.get('helios-review-diagnostics')) {
  class HeliosReviewDiagnostics extends HTMLElement {
    connectedCallback () {
      this.controller?.abort()
      this.controller = new AbortController()
      const { signal } = this.controller
      this.root = this.closest('[data-helios-reviews-root]')
      this.output = this.querySelector('[data-review-status]')
      this.observer?.disconnect()
      this.observer = new MutationObserver(() => this.check())
      const mount = this.root?.querySelector('.helios-review-widget-mount')
      if (mount) this.observer.observe(mount, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-id', 'data-product-id', 'data-product-handle', 'data-number-of-reviews'] })
      this.querySelector('[data-review-check]')?.addEventListener('click', () => this.check(), { signal })
      window.addEventListener('load', () => this.check(), { signal })
      document.addEventListener('shopify:section:load', () => this.check(), { signal })
      this.check()
    }

    check () {
      if (!this.root || !this.output) return
      const widgets = Array.from(this.root.querySelectorAll('.jdgm-review-widget'))
      const allWidgets = document.querySelectorAll('.jdgm-review-widget')
      const messages = [`Product ID hiện tại: ${this.dataset.productId}; handle: ${this.dataset.productHandle}.`]
      const main = document.querySelector('[data-helios-product-main]')
      if (main) {
        messages.push(`Context Product main: ID=${main.dataset.productId}; handle=${main.dataset.productHandle}.`)
        if (main.dataset.productId !== this.dataset.productId || main.dataset.productHandle !== this.dataset.productHandle) messages.push('SAI CONTEXT: Product main và section đánh giá không cùng sản phẩm.')
        const cartProductId = main.querySelector('form[data-productid]')?.dataset.productid
        if (cartProductId && cartProductId !== this.dataset.productId) messages.push(`SAI CONTEXT FORM: form mua hàng dùng Product ID ${cartProductId}.`)
      }
      const route = window.location.pathname.match(/\/products\/([^/]+)/)
      if (route) {
        let routeHandle = route[1]
        try { routeHandle = decodeURIComponent(routeHandle) } catch {}
        if (routeHandle !== this.dataset.productHandle) messages.push(`SAI HANDLE THEO URL: URL=${routeHandle}; Liquid=${this.dataset.productHandle}.`)
      }
      if (!widgets.length) messages.push('Chưa tìm thấy Review Widget trong section này. Kiểm tra app block Review Widget và Judge.me App embed trên chính theme nháp.')
      if (allWidgets.length > 1) messages.push(`Có ${allWidgets.length} Review Widget trên trang: kiểm tra và bỏ widget trùng trong theme editor.`)
      for (const widget of widgets) {
        const id = widget.dataset.productId || widget.dataset.id
        const widgetHandle = widget.dataset.productHandle
        if (widgetHandle && widgetHandle !== this.dataset.productHandle) messages.push(`SAI WIDGET HANDLE: widget=${widgetHandle}; Shopify=${this.dataset.productHandle}.`)
        const form = widget.closest('form')
        if (form && (form.matches('[data-productid]') || form.action.includes('/cart/add'))) messages.push('WIDGET TRONG FORM MUA HÀNG: chuyển Review Widget đầy đủ sang section Apps để tránh form đánh giá lồng trong form mua hàng.')
        if (!id) messages.push('Widget chưa cung cấp Product ID trong DOM; cần kiểm tra request Judge.me trong Network.')
        else if (id !== this.dataset.productId) messages.push(`SAI PRODUCT ID: widget=${id}, Shopify=${this.dataset.productId}. Không sửa ID bằng JavaScript; kiểm tra mapping trong Judge.me và app block.`)
        else messages.push(`Widget gắn đúng Shopify Product ID ${id}.`)
        const count = widget.querySelector('[data-number-of-reviews]')?.dataset.numberOfReviews ?? widget.dataset.numberOfReviews
        if (count !== undefined) messages.push(`Số review widget báo: ${count}.`)
        const rendered = widget.querySelectorAll('.jdgm-rev').length
        messages.push(`Số dòng review đang có trong DOM: ${rendered} (có thể chỉ là một trang phân trang).`)
        if (!rendered) messages.push('Nếu chỉ có nút viết đánh giá: đối chiếu Published/Hidden, loại Product Reviews/Store Reviews, mapping sản phẩm và lỗi request ứng dụng. Theme không thể hiển thị review chưa được Judge.me trả về.')
      }
      messages.push(`Đối tượng runtime jdgm: ${window.jdgm ? 'có' : 'chưa thấy'}; điều này không tự xác nhận mọi request ứng dụng đã thành công.`)
      const text = messages.join('\n')
      if (this.output.textContent !== text) this.output.textContent = text
    }

    disconnectedCallback () { this.controller?.abort(); this.observer?.disconnect() }
  }
  customElements.define('helios-review-diagnostics', HeliosReviewDiagnostics)
}
