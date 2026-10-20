// The fish and fights shown in the launch content. Demo data: $BETTA is not live yet.
import { G } from '../game/species'
import type { Bout, Fighter } from './ring'

export const RONIN: Fighter = { g: G.plakat, name: 'Ronin', breed: 'Plakat Fighter', lv: 9 }
export const KAISER: Fighter = { g: G.koi, name: 'Kaiser', breed: 'Koi Galaxy', lv: 14 }
export const STORM: Fighter = { g: G.crowntail, name: 'Storm', breed: 'Crowntail', lv: 6 }

export const BUY = {
  n: 212,
  tx: '0x7f3a9c41d2e8b05f6a19c7e3d4b28f90a6e1c57b3d92f04e8a61b7c5d309c91e',
  tokens: '250,000',
  buyer: '0x51c2e07ab3f4c9d8e6a1b2c3d4e5f60718293a4b',
}

/** Demo video: a Lv 9 buy takes the belt off a Lv 14 champion on a 4-fight streak. */
export const DEMO_BOUT: Bout = {
  a: RONIN,
  b: KAISER,
  drop: 1.25,
  start: 2.0,
  step: 0.78,
  events: [
    { actor: 0, kind: 'hit', hp: [100, 76] },
    { actor: 1, kind: 'hit', hp: [81, 76] },
    { actor: 0, kind: 'miss', hp: [81, 76] },
    { actor: 1, kind: 'crit', hp: [44, 76] },
    { actor: 0, kind: 'crit', hp: [44, 31] },
    { actor: 1, kind: 'miss', hp: [44, 31] },
    { actor: 0, kind: 'hit', hp: [44, 0] },
  ],
}

/** GIF loop (6 s): a buy drops in, the champion keeps the belt, the ring resets to where it began. */
export const GIF_BOUT: Bout = {
  a: STORM,
  b: KAISER,
  drop: 0.85,
  start: 1.35,
  step: 0.5,
  exit: 4.6,
  heal: 5.0,
  seed: 77,
  events: [
    { actor: 0, kind: 'hit', hp: [100, 80] },
    { actor: 1, kind: 'hit', hp: [74, 80] },
    { actor: 0, kind: 'miss', hp: [74, 80] },
    { actor: 1, kind: 'crit', hp: [30, 80] },
    { actor: 1, kind: 'hit', hp: [0, 80] },
  ],
}

export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
