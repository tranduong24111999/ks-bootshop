/* Editor-only, read-only diagnostics. Never alter IDs, review visibility, app initialization or moderation. */
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
    if (mount) this.observer.observe(mount, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-id', 'data-product-id', 'data-number-of-reviews'] })
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
    if (!widgets.length) messages.push('Chưa tìm thấy Review Widget trong section này. Kiểm tra app block Review Widget và Judge.me App embed trên chính theme nháp.')
    if (allWidgets.length > 1) messages.push(`Có ${allWidgets.length} Review Widget trên trang: kiểm tra và bỏ widget trùng trong theme editor.`)
    for (const widget of widgets) {
      const id = widget.dataset.productId || widget.dataset.id
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
if (!customElements.get('helios-review-diagnostics')) customElements.define('helios-review-diagnostics', HeliosReviewDiagnostics)
