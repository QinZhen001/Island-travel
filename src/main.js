import './styles/main.css'

const root = document.documentElement
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* ---------- 元素引用 ---------- */
const progressBar = document.getElementById('progressBar')
const topnav = document.getElementById('topnav')
const navScroller = topnav.querySelector('.topnav-inner')
const navLinks = [...topnav.querySelectorAll('a')]
const sections = navLinks
  .map((a) => document.querySelector(a.getAttribute('href')))
  .filter(Boolean)

/* ==========================================================
   滚动调度
   所有滚动逻辑共用一个 rAF 节流任务：一帧只做一次布局读取，
   避免在 scroll 事件里反复读写导致强制同步布局（滚动卡顿的常见原因）
   ========================================================== */
let maxScroll = 0
let navH = 52
let sectionTops = []
let ticking = false
const scrollTasks = new Set()

function measure() {
  maxScroll = Math.max(0, root.scrollHeight - window.innerHeight)
  navH = topnav.offsetHeight
  sectionTops = sections.map((s) => s.offsetTop)
  root.style.setProperty('--nav-h', `${Math.round(navH)}px`)
}

function runScrollTasks() {
  ticking = false
  const y = window.scrollY
  scrollTasks.forEach((task) => task(y))
}

function scheduleScroll() {
  if (ticking) return
  ticking = true
  requestAnimationFrame(runScrollTasks)
}

window.addEventListener('scroll', scheduleScroll, { passive: true })
window.addEventListener(
  'resize',
  () => {
    measure()
    scheduleScroll()
  },
  { passive: true }
)
// 懒加载图片、折叠展开、Tab 切换都会改变文档高度，需要重新测量
new ResizeObserver(() => {
  measure()
  scheduleScroll()
}).observe(document.body)

/* ---------- 阅读进度条 ---------- */
scrollTasks.add((y) => {
  const ratio = maxScroll > 0 ? Math.min(1, y / maxScroll) : 0
  progressBar.style.transform = `scaleX(${ratio})`
})

/* ---------- 顶部导航：吸顶态 ---------- */
scrollTasks.add((y) => {
  topnav.classList.toggle('is-stuck', y > window.innerHeight * 0.6)
})

/* ---------- 顶部导航：当前章节高亮 ---------- */
let activeId = ''
let lockUntil = 0

// 只滚动导航条自身。scrollIntoView 会滚动所有可滚动祖先（包括页面垂直方向），
// 会把用户正在进行的滚动"抢走"，这是原实现滑动手感异常的直接原因
function centerNavLink(link) {
  if (!link || navScroller.scrollWidth <= navScroller.clientWidth) return
  const navRect = navScroller.getBoundingClientRect()
  const linkRect = link.getBoundingClientRect()
  const delta = linkRect.left + linkRect.width / 2 - (navRect.left + navRect.width / 2)
  const max = navScroller.scrollWidth - navScroller.clientWidth
  const left = Math.max(0, Math.min(navScroller.scrollLeft + delta, max))
  if (Math.abs(left - navScroller.scrollLeft) < 2) return
  navScroller.scrollTo({ left, behavior: reduceMotion ? 'auto' : 'smooth' })
}

function setActive(id) {
  if (!id || id === activeId) return
  activeId = id
  navLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === id))
  centerNavLink(navLinks.find((a) => a.getAttribute('href') === id))
}

scrollTasks.add((y) => {
  if (Date.now() < lockUntil) return
  // 用「越过导航下沿的最后一块」判断当前章节，比 IntersectionObserver 稳定，边界不会来回跳
  const line = y + navH + 24
  let current = sections[0]
  for (let i = 0; i < sections.length; i += 1) {
    if (sectionTops[i] <= line) current = sections[i]
  }
  setActive(`#${current.id}`)
})

navLinks.forEach((a) => {
  a.addEventListener('click', () => {
    lockUntil = Date.now() + 700 // 平滑滚动过程中不要被 Observer 抢着改高亮
    setActive(a.getAttribute('href'))
  })
})

/* ---------- 滚动出现动画 ---------- */
const revealEls = [...document.querySelectorAll('.reveal')]
if (reduceMotion || !('IntersectionObserver' in window)) {
  revealEls.forEach((el) => el.classList.add('in'))
} else {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('in')
        revealObserver.unobserve(entry.target)
      })
    },
    // threshold 用 0：区块很高时 0.08 的交叉比例可能永远达不到，整块会一直不显示
    { threshold: 0, rootMargin: '0px 0px -10% 0px' }
  )
  revealEls.forEach((el) => revealObserver.observe(el))
}

/* ---------- 行程 Tab ---------- */
const tabs = [...document.querySelectorAll('.tab')]
const tabsEl = document.querySelector('.tabs')
tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab
    const anchorTop = tabsEl.getBoundingClientRect().top

    tabs.forEach((t) => {
      const on = t === tab
      t.classList.toggle('is-active', on)
      t.setAttribute('aria-selected', String(on))
    })
    document.querySelectorAll('.panel').forEach((panel) => {
      const on = panel.id === target
      panel.classList.toggle('is-active', on)
      panel.hidden = !on
    })

    measure()
    // 切换后文档高度变化会让页面"跳一下"：把 Tab 栏拉回原来的视口位置
    if (anchorTop >= 0 && anchorTop < window.innerHeight) {
      const drift = tabsEl.getBoundingClientRect().top - anchorTop
      if (Math.abs(drift) > 1) {
        root.style.scrollBehavior = 'auto'
        window.scrollBy(0, drift)
        root.style.scrollBehavior = ''
      }
    }
    scheduleScroll()
  })
})

/* ---------- 图片查看器 ---------- */
const lightbox = document.getElementById('lightbox')
const lbImg = document.getElementById('lbImg')
let lastFocused = null
let lockedY = 0

const openLightbox = (img) => {
  lastFocused = img
  lbImg.src = img.currentSrc || img.src
  lbImg.alt = img.alt
  lockedY = window.scrollY
  lightbox.hidden = false
  // iOS 上 body{overflow:hidden} 不生效，改用固定定位 + 记录偏移
  document.body.style.top = `-${lockedY}px`
  root.classList.add('is-locked')
}

const closeLightbox = () => {
  if (lightbox.hidden) return
  lightbox.hidden = true
  lbImg.src = ''
  root.classList.remove('is-locked')
  document.body.style.top = ''
  root.style.scrollBehavior = 'auto'
  window.scrollTo(0, lockedY)
  root.style.scrollBehavior = ''
  lastFocused?.focus?.({ preventScroll: true })
}

document.addEventListener('click', (e) => {
  const img = e.target.closest('img[data-zoom]')
  if (img) openLightbox(img)
})
lightbox.addEventListener('click', closeLightbox)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !lightbox.hidden) closeLightbox()
})

/* ---------- 出发清单：本地记忆 ---------- */
const STORAGE_KEY = 'island-travel-checklist'
const list = document.getElementById('checkList')
const progress = document.getElementById('checkProgress')
const boxes = [...list.querySelectorAll('input[type="checkbox"]')]

const readStore = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
  } catch {
    return {}
  }
}

const render = () => {
  const done = boxes.filter((b) => b.checked).length
  progress.textContent = `已准备 ${done} / ${boxes.length}`
}

boxes.forEach((box) => {
  const saved = readStore()[box.dataset.key]
  if (typeof saved === 'boolean') box.checked = saved
  box.addEventListener('change', () => {
    const store = readStore()
    store[box.dataset.key] = box.checked
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
    } catch {
      /* 隐私模式下忽略 */
    }
    render()
  })
})
render()

document.getElementById('resetCheck').addEventListener('click', () => {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
  boxes.forEach((box) => {
    box.checked = box.defaultChecked
  })
  render()
})

/* ---------- 初始化 ---------- */
measure()
scheduleScroll()
window.addEventListener('load', () => {
  measure()
  scheduleScroll()
})
