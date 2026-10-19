// Deploys BettaFish, BettaShop and BettaArena, sets prices and fees from the game's own tables,
// and writes deployments/<chainId>.json plus ready-to-paste env lines for the server and web app.
//
//   npx hardhat run scripts/deploy.ts --network localhost
//   npx hardhat run scripts/deploy.ts --network robinhoodTestnet
//   npx hardhat run scripts/deploy.ts --network robinhood
//
// Settings (environment variables):
//   TOKEN_ADDRESS     $BETTA on this chain. Left empty on a local chain/testnet: a test token is deployed.
//   SEASON_START      ISO date (UTC) when round 1 opens, e.g. 2026-11-01T13:00:00Z. Default: in 10 minutes.
//   TOURNAMENT_DAYS   days per round (default 3)
//   TREASURY          receives the non-burned share of shop sales (use a multisig). Default: deployer.
//   OWNER             admin of all contracts (use a multisig). Default: deployer.
//   SIGNER_ADDRESS    the game server's signing key address (required)
//   OPERATOR_ADDRESS  the game server's operator wallet address (required)
//   BURN_BPS          share of shop sales burned, in basis points (default 5000 = 50%)
//   METADATA_URL      NFT metadata base, e.g. https://api.example.com/api/fish/
import fs from 'node:fs'
import path from 'node:path'
import { network } from 'hardhat'
import { getAddress, parseUnits, type Address } from 'viem'

const days = Number(process.env.TOURNAMENT_DAYS || 3)
process.env.VITE_TOURNAMENT_DAYS = String(days)
const { ENTRY_LOCK, DIVISIONS } = await import('../../src/game/tournament.ts')
const { SKUS } = await import('../../src/game/catalog.ts')
const { SPECIES } = await import('../../src/game/species.ts')

const { viem, networkName } = await network.getOrCreate()
const publicClient = await viem.getPublicClient()
const [deployer] = await viem.getWalletClients()
const chainId = await publicClient.getChainId()
const isLive = chainId === 4663
const me = deployer.account.address

const need = (k: string) => {
  const v = process.env[k]
  if (!v) throw new Error(`Set ${k}`)
  return getAddress(v)
}
const signerAddr = need('SIGNER_ADDRESS')
const operatorAddr = need('OPERATOR_ADDRESS')
const owner = process.env.OWNER ? getAddress(process.env.OWNER) : me
const treasury = process.env.TREASURY ? getAddress(process.env.TREASURY) : me
const burnBps = Number(process.env.BURN_BPS || 5000)
const metadata = process.env.METADATA_URL || 'http://localhost:8787/api/fish/'
const start = process.env.SEASON_START ? Math.floor(Date.parse(process.env.SEASON_START) / 1000) : Math.floor(Date.now() / 1000) + 600
if (!Number.isFinite(start)) throw new Error('SEASON_START is not a valid date')
if (isLive && !process.env.TOKEN_ADDRESS) throw new Error('Set TOKEN_ADDRESS on mainnet; a test token is only deployed on local chains and testnet')
if (isLive && (owner === me || treasury === me)) console.warn('⚠ OWNER/TREASURY is the deployer key. A multisig is strongly recommended on mainnet.')

console.log(`Deploying to ${networkName} (chain ${chainId}) from ${me}`)
const head = await publicClient.getBlockNumber()

let tokenAddr: Address
if (process.env.TOKEN_ADDRESS) tokenAddr = getAddress(process.env.TOKEN_ADDRESS)
else {
  const t = await viem.deployContract('MockBetta')
  tokenAddr = t.address
  console.log(`  test token (tBETTA, anyone can mint): ${tokenAddr}`)
}
const token = await viem.getContractAt('MockBetta', tokenAddr)
const decimals = await token.read.decimals()
const units = (x: number) => parseUnits(String(x), decimals)

const fish = await viem.deployContract('BettaFish', [me, metadata])
const shop = await viem.deployContract('BettaShop', [me, tokenAddr, fish.address, treasury, signerAddr, burnBps])
const lockSec = BigInt(ENTRY_LOCK / 1000)
const period = BigInt(Math.round(days * 86_400))
const arena = await viem.deployContract('BettaArena', [
  owner, tokenAddr, fish.address, BigInt(start), period, lockSec, signerAddr, operatorAddr, DIVISIONS.map((d) => units(d.fee)) as [bigint, bigint, bigint],
])
const wait = async (hash: `0x${string}`) => publicClient.waitForTransactionReceipt({ hash })
await wait(await fish.write.setMinter([shop.address, true]))
await wait(
  await shop.write.setPrices([
    SPECIES.map((_, i) => i),
    SPECIES.map((s) => units(s.price)),
    SKUS.map((s) => s.index),
    SKUS.map((s) => units(s.price)),
  ]),
)
// hand admin rights to the owner (Ownable2Step: the owner must call acceptOwnership on each)
if (owner !== me) {
  await wait(await fish.write.transferOwnership([owner]))
  await wait(await shop.write.transferOwnership([owner]))
  console.log(`  ownership offered to ${owner}: call acceptOwnership() on BettaFish and BettaShop from it`)
}

const out = {
  network: networkName, chainId, deployedAt: new Date().toISOString(), startBlock: head.toString(),
  token: tokenAddr, fish: fish.address, shop: shop.address, arena: arena.address,
  seasonStart: new Date(start * 1000).toISOString(), tournamentDays: days, lockSeconds: Number(lockSec),
  signer: signerAddr, operator: operatorAddr, owner, treasury, burnBps,
}
const dir = path.join(import.meta.dirname, '..', 'deployments')
fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(path.join(dir, `${chainId}.json`), JSON.stringify(out, null, 2))

console.log('\nDeployed:')
console.log(JSON.stringify(out, null, 2))
console.log('\n# server/.env')
console.log(`CHAIN_ID=${chainId}\nTOKEN_ADDRESS=${tokenAddr}\nFISH_ADDRESS=${fish.address}\nSHOP_ADDRESS=${shop.address}\nARENA_ADDRESS=${arena.address}\nSTART_BLOCK=${head}`)
console.log('\n# web .env')
console.log(`VITE_CHAIN_ID=${chainId}\nVITE_TOKEN_ADDRESS=${tokenAddr}\nVITE_FISH_ADDRESS=${fish.address}\nVITE_SHOP_ADDRESS=${shop.address}\nVITE_ARENA_ADDRESS=${arena.address}\nVITE_SEASON_START=${out.seasonStart}\nVITE_TOURNAMENT_DAYS=${days}`)
