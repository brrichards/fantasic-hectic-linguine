// Live two-client sync check against a running tinylicious (7070) and Vite
// dev server (5173). Run with: node e2e/sync-check.mjs [--headed]
import { chromium } from 'playwright'

const headed = process.argv.includes('--headed')
const BASE = 'http://localhost:5173'

const browser = await chromium.launch({ headless: !headed, slowMo: headed ? 500 : 0 })
try {
  const pageA = await browser.newPage()
  pageA.on('console', (m) => console.log(`[pageA:${m.type()}]`, m.text()))
  await pageA.goto(BASE)
  await pageA.waitForSelector('.count')
  await pageA.waitForFunction(() => location.hash.length > 1)
  const url = pageA.url()
  console.log('client A created container:', url)

  const countOf = async (page) => Number(await page.locator('.count').textContent())

  if ((await countOf(pageA)) !== 0) throw new Error('expected fresh container to start at 0')

  await pageA.click('button')
  if ((await countOf(pageA)) !== 1) throw new Error('local +1 did not render 1')
  console.log('client A clicked +1, sees 1')

  const pageB = await browser.newPage()
  pageB.on('console', (m) => console.log(`[pageB:${m.type()}]`, m.text()))
  await pageB.goto(url)
  await pageB.waitForSelector('.count')
  await pageB.waitForFunction(() => document.querySelector('.count')?.textContent === '1')
  console.log('client B joined and sees 1')

  await pageB.click('button')
  await pageA.waitForFunction(() => document.querySelector('.count')?.textContent === '2')
  await pageB.waitForFunction(() => document.querySelector('.count')?.textContent === '2')
  console.log('client B clicked +1, both clients see 2')

  console.log('SYNC CHECK PASSED')
} finally {
  await browser.close()
}
