// EIP-712 messages the game server signs and the contracts verify. Field order and types must
// match the typehashes in BettaArena.sol and BettaShop.sol exactly.

import type { Address } from 'viem'

export const snapshotTypes = {
  Snapshot: [
    { name: 'owner', type: 'address' },
    { name: 'fishId', type: 'uint256' },
    { name: 'round', type: 'uint32' },
    { name: 'division', type: 'uint8' },
    { name: 'attack', type: 'uint16' },
    { name: 'defense', type: 'uint16' },
    { name: 'beauty', type: 'uint16' },
    { name: 'health', type: 'uint8' },
    { name: 'sick', type: 'bool' },
    { name: 'traits', type: 'uint8' },
    { name: 'level', type: 'uint8' },
    { name: 'deadline', type: 'uint64' },
  ],
} as const

export const fishPermitTypes = {
  FishPermit: [
    { name: 'buyer', type: 'address' },
    { name: 'species', type: 'uint16' },
    { name: 'female', type: 'bool' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint64' },
  ],
} as const

export const bredPermitTypes = {
  BredPermit: [
    { name: 'to', type: 'address' },
    { name: 'species', type: 'uint16' },
    { name: 'female', type: 'bool' },
    { name: 'gen', type: 'uint8' },
    { name: 'seed', type: 'uint32' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint64' },
  ],
} as const

export const arenaDomain = (chainId: number, verifyingContract: Address) => ({ name: 'BettaArena', version: '1', chainId, verifyingContract }) as const
export const shopDomain = (chainId: number, verifyingContract: Address) => ({ name: 'BettaShop', version: '1', chainId, verifyingContract }) as const

export interface Snapshot {
  owner: Address
  fishId: bigint
  round: number
  division: number
  attack: number
  defense: number
  beauty: number
  health: number
  sick: boolean
  traits: number
  level: number
  deadline: bigint
}
