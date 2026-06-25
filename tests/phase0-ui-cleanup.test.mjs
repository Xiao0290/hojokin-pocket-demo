import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const rootDir = path.resolve(new URL('..', import.meta.url).pathname)

async function read(relativePath) {
  return fs.readFile(path.join(rootDir, relativePath), 'utf8')
}

test('design system exposes an accessible Switch for saved binary settings', async () => {
  const switchSource = await read('design-system/project/components/forms/Switch.jsx')
  const barrel = await read('src/ds.js')
  const home = await read('src/screens/home.jsx')

  assert.match(switchSource, /role="switch"/)
  assert.match(switchSource, /aria-checked=\{checked\}/)
  assert.match(switchSource, /onChange\(!checked\)/)
  assert.match(barrel, /components\/forms\/Switch\.jsx/)
  assert.match(home, /Switch/)
  assert.match(home, /saveSettings/)
  assert.match(home, /Push/)
  assert.match(home, /Email/)
  assert.match(home, /締切リマインド/)
})

test('dead src data fixture is removed from active app paths', async () => {
  await assert.rejects(() => fs.stat(path.join(rootDir, 'src/data.js')), /ENOENT/)

  for (const relativePath of ['src/App.jsx', 'src/screens/home.jsx', 'src/screens/diagnose.jsx', 'src/screens/detail.jsx']) {
    const source = await read(relativePath)
    assert.doesNotMatch(source, /from ['"].*data(?:\.js)?['"]/)
  }
})

test('misleading save affordances are removed from the plan footer', async () => {
  const detail = await read('src/screens/detail.jsx')

  assert.doesNotMatch(detail, /申請準備に保存/)
  assert.doesNotMatch(detail, /right=\{ready \? '保存'/)
  assert.match(detail, /申請準備を見る/)
})
