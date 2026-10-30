/* Exercise the actual carousel transition, including wraparound and reduced motion. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const source = fs.readFileSync(require('node:path').join(__dirname, '../assets/helios.js'), 'utf8')
const Carousel = vm.runInNewContext(source.slice(0, source.indexOf("if (!customElements.get('helios-carousel'))")) + '\nHeliosCarousel', { HTMLElement: class {} })
function fixture (hero = false, reduced = false) {
  const frames = []
  const carousel = new Carousel()
  carousel.index = 0
  carousel.motion = { matches: reduced }
  carousel.classList = { contains: name => hero && name === 'helios-hero' }
  carousel.querySelectorAll = () => []
  carousel.querySelector = () => null
  carousel.updateAutoplay = () => {}
  carousel.slides = Array.from({ length: 3 }, () => ({
    style: {}, classList: { toggle () {} }, setAttribute () {},
    animate (keyframes, timing) { frames.push({ keyframes, timing }); return { finished: Promise.resolve(), cancel () {} } }
  }))
  return { carousel, frames }
}
for (const [from, to, direction] of [[0, 1, 1], [1, 0, -1], [2, 3, 1], [0, -1, -1]]) {
  const { carousel, frames } = fixture()
  carousel.index = from
  carousel.show(to)
  assert.equal(frames[0].keyframes[0].transform, `translateX(${direction * 100}%)`)
  assert.equal(frames[1].keyframes[1].transform, `translateX(${-direction * 100}%)`)
  assert.equal(carousel.index, (to + 3) % 3)
}
const hero = fixture(true); hero.carousel.show(1)
assert.equal(hero.frames[0].timing.duration, 1400)
assert.equal(hero.frames[0].keyframes[0].opacity, 0)
const reduced = fixture(false, true); reduced.carousel.show(1)
assert.equal(reduced.frames.length, 0)
console.log('PASS: horizontal announcement transitions, previous/next wraparound, hero blend unchanged, reduced motion')
