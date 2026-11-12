(() => {
  if (window.wesWishlistReady) return
  window.wesWishlistReady = true
  const dialog = document.querySelector('#WesWishlist')
  if (!dialog) return
  const labels = JSON.parse(dialog.querySelector('[data-wes-wishlist-labels]').textContent)
  const key = 'wes-freed-wishlist-v1'
  const valid = handle => typeof handle === 'string' && /^[\p{L}\p{N}][\p{L}\p{N}-]{0,254}$/u.test(handle)
  let saved = []
  const read = () => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]')
      if (Array.isArray(value)) saved = [...new Set(value.filter(valid))].slice(0, 100)
    } catch {}
  }
  read()
  let revision = 0
  const list = dialog.querySelector('[data-wes-wishlist-list]')
  const status = dialog.querySelector('[data-wes-wishlist-status]')
  const announce = message => { document.querySelector('[data-wes-wishlist-announcement]').textContent = message }
  const sync = (scope = document) => {
    const buttons = [...scope.querySelectorAll('[data-wes-wishlist-toggle]')]
    if (scope.matches?.('[data-wes-wishlist-toggle]')) buttons.push(scope)
    buttons.forEach(button => {
      const pressed = saved.includes(button.dataset.handle)
      button.setAttribute('aria-pressed', String(pressed))
      button.setAttribute('aria-label', `${pressed ? button.dataset.removeLabel : button.dataset.addLabel}: ${button.dataset.title || ''}`)
    })
    document.querySelectorAll('[data-wes-wishlist-count]').forEach(count => {
      if (count.textContent !== String(saved.length)) count.textContent = saved.length
    })
  }
  const persist = () => {
    try { localStorage.setItem(key, JSON.stringify(saved)) } catch {}
    sync()
    window.dispatchEvent(new CustomEvent('wes.wishlist.change', { detail: { handles: [...saved] } }))
  }
  const element = (tag, className, text) => {
    const node = document.createElement(tag)
    if (className) node.className = className
    if (text !== undefined) node.textContent = text
    return node
  }
  const productUrl = handle => `${dialog.dataset.root.replace(/\/$/, '')}/products/${handle}`
  const price = amount => new Intl.NumberFormat(document.documentElement.lang || 'ko', { style: 'currency', currency: dialog.dataset.currency || 'KRW' }).format(amount / 100)
  const makeItem = (handle, product) => {
    const item = element('article', 'wes-wishlist-item')
    const imageLink = element('a')
    imageLink.href = productUrl(handle)
    if (product?.featured_image) {
      const imageUrl = new URL(product.featured_image, location.origin)
      if (imageUrl.protocol === 'https:') {
        imageUrl.searchParams.set('width', '180')
        const img = element('img'); img.src = imageUrl.href; img.alt = ''; img.loading = 'lazy'; imageLink.append(img)
      }
    }
    const body = element('div')
    const title = element('h3'), link = element('a', '', product?.title || handle)
    link.href = productUrl(handle); title.append(link); body.append(title)
    const remove = element('button', 'wes-wishlist-toggle')
    remove.type = 'button'; remove.dataset.wesWishlistToggle = ''; remove.dataset.handle = handle
    remove.dataset.title = product?.title || handle; remove.dataset.addLabel = labels.add; remove.dataset.removeLabel = labels.remove
    const icon = document.querySelector('[data-wes-wishlist-open] svg')?.cloneNode(true)
    if (icon) remove.append(icon)
    item.append(imageLink, body, remove)
    if (!product) { body.append(element('p', '', labels.error)); return item }
    const amount = element('p', '', price(product.price)); body.append(amount)
    const available = product.variants.filter(variant => variant.available)
    const wrapper = element('product-form'), form = element('form')
    form.method = 'post'; form.action = `${dialog.dataset.root.replace(/\/$/, '')}/cart/add`; form.dataset.productid = product.id
    if (product.variants.length > 1) {
      const select = element('select'); select.name = 'id'; select.setAttribute('aria-label', labels.select)
      product.variants.forEach(variant => {
        const option = element('option', '', `${variant.title} — ${price(variant.price)}`)
        option.value = variant.id; option.disabled = !variant.available
        option.selected = variant.id === available[0]?.id; select.append(option)
      })
      select.addEventListener('change', () => { const variant = product.variants.find(v => String(v.id) === select.value); if (variant) amount.textContent = price(variant.price) })
      if (available[0]) amount.textContent = price(available[0].price)
      form.append(select)
    } else {
      const input = element('input'); input.type = 'hidden'; input.name = 'id'; input.value = available[0]?.id || ''; form.append(input)
    }
    const button = element('button', 'btn btn-atc', available.length ? labels.cart : labels.sold_out)
    button.type = 'submit'; button.name = 'add'; button.disabled = !available.length
    form.addEventListener('submit', () => { if (form.checkValidity() && available.length) dialog.close() })
    form.append(button); wrapper.append(form); body.append(wrapper)
    return item
  }
  const render = async () => {
    const current = ++revision
    list.replaceChildren()
    status.textContent = saved.length ? labels.loading : labels.empty
    const handles = [...saved]
    const slots = handles.map(() => { const slot = element('div'); list.append(slot); return slot })
    let next = 0
    const worker = async () => {
      while (next < handles.length) {
        const index = next++, handle = handles[index]
        let product = null
        try {
          const response = await fetch(`${productUrl(handle)}.js`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) })
          if (response.ok) {
            const data = await response.json()
            if (Array.isArray(data.variants)) product = data
          }
        } catch {}
        if (current !== revision) return
        slots[index].replaceWith(makeItem(handle, product)); sync(list)
      }
    }
    await Promise.all([worker(), worker(), worker()])
    if (current === revision) status.textContent = saved.length ? '' : labels.empty
  }
  document.addEventListener('click', event => {
    const toggle = event.target.closest('[data-wes-wishlist-toggle]')
    if (toggle) {
      event.preventDefault()
      const handle = toggle.dataset.handle
      if (!valid(handle)) return
      if (saved.includes(handle)) { saved = saved.filter(value => value !== handle); announce(labels.remove) }
      else { if (saved.length >= 100) { announce(labels.limit); return }; saved.push(handle); announce(labels.add) }
      persist()
      if (dialog.open) render()
    }
    if (event.target.closest('[data-wes-wishlist-open]')) { dialog.showModal(); render() }
    if (event.target.closest('[data-wes-wishlist-close]')) dialog.close()
  })
  dialog.addEventListener('click', event => { if (event.target === dialog && event.clientX < dialog.getBoundingClientRect().left) dialog.close() })
  dialog.addEventListener('close', () => { revision++ })
  window.addEventListener('storage', event => { if (event.key === key || event.key === null) { read(); sync(); if (dialog.open) render() } })
  window.addEventListener('pageshow', () => { read(); sync() })
  new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(node => {
      if (node.nodeType === 1 && (node.matches('[data-wes-wishlist-toggle]') || node.querySelector('[data-wes-wishlist-toggle]'))) sync(node)
    }))
  }).observe(document.body, { childList: true, subtree: true })
  document.documentElement.classList.add('wes-wishlist-ready')
  sync()
})()
