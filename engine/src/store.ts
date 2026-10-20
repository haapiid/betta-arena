// The engine's memory: one JSON file, written atomically (temp file, then rename), so a crash
// mid-write never leaves a broken state. A new token address starts a fresh state.

import fs from 'node:fs'
import path from 'node:path'
import { config } from './config.ts'
import { freshState, type State } from './rules.ts'

const file = path.resolve(config.dataDir, 'state.json')
fs.mkdirSync(path.dirname(file), { recursive: true })

function load(): State {
  const token = (config.token ?? '').toLowerCase()
  try {
    const s = JSON.parse(fs.readFileSync(file, 'utf8')) as State
    if (s.version === 1 && s.token === token) return s
    if (s.token && s.token !== token) fs.copyFileSync(file, `${file}.${s.token.slice(0, 10)}.bak`)
  } catch {
    /* first run */
  }
  return freshState(token)
}

export const state: State = load()

export function saveNow() {
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(state))
  fs.renameSync(tmp, file)
}

let timer: NodeJS.Timeout | null = null
export function saveSoon() {
  if (timer) return
  timer = setTimeout(() => {
    timer = null
    saveNow()
  }, 1500)
}

export type Level = 'info' | 'warn' | 'error' | 'success'
export const logs: { t: number; level: Level; msg: string }[] = []
export function log(level: Level, msg: string) {
  logs.unshift({ t: Date.now(), level, msg })
  logs.length = Math.min(logs.length, 300)
  console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](`[${level}] ${msg}`)
}
