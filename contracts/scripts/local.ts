// LOCAL TESTING ONLY: deploys the Pons mock to a Hardhat node and plays market traffic, so the
// engine can be watched end to end without the real chain.
//
//   npx hardhat node                                      (in this folder, keep it running)
//   npx hardhat run scripts/local.ts --network localhost  (deploys, prints the engine .env lines)
//   TRAFFIC=1 MOCK=<curve address> npx hardhat run scripts/local.ts --network localhost   (more buys and sells)
import fs from 'node:fs'
import path from 'node:path'
import { network } from 'hardhat'
import { parseEther, type Address } from 'viem'

const { viem } = await network.getOrCreate()
const pub = await viem.getPublicClient()
const wallets = await viem.getWalletClients()
const creator = wallets[2] // the engine's key in engine/.env.local-test (Hardhat account #2)
const file = path.join(import.meta.dirname, '..', 'pons-local.json')

let curveAddr: Address
let tokenAddr: Address
if (!process.env.TRAFFIC) {
  const escrow = await viem.deployContract('MockPonsEscrow')
  const curve = await viem.deployContract('MockPonsCurve', [escrow.address, creator.account.address])
  const token = await viem.deployContract('MockPonsToken', [curve.address])
  await curve.write.setToken([token.address])
  curveAddr = curve.address
  tokenAddr = token.address
  const start = await pub.getBlockNumber()
  fs.writeFileSync(file, JSON.stringify({ escrow: escrow.address, curve: curve.address, token: token.address, startBlock: String(start) }, null, 2))
  console.log(`TOKEN_ADDRESS=${token.address}\nPONS_FEE_ESCROW=${escrow.address}\nSTART_BLOCK=${start}`)
} else {
  const d = JSON.parse(fs.readFileSync(file, 'utf8'))
  curveAddr = d.curve
  tokenAddr = d.token
}

// market traffic: buys of different sizes from ten wallets, and two of them sell
const curve = await viem.getContractAt('MockPonsCurve', curveAddr)
const token = await viem.getContractAt('MockPonsToken', tokenAddr)
const buyers = wallets.slice(5, 15)
const sizes = ['0.0003', '0.002', '0.02', '0.2', '1.5']
for (let i = 0; i < Number(process.env.BUYS || 24); i++) {
  const w = buyers[i % buyers.length]
  const eth = parseEther(sizes[(i * 7) % sizes.length])
  const hash = await curve.write.buy([eth, 0n, w.account.address], { account: w.account, value: eth })
  await pub.waitForTransactionReceipt({ hash })
}
for (const w of buyers.slice(8, 10)) {
  const bal = await token.read.balanceOf([w.account.address])
  if (bal === 0n) continue
  await pub.waitForTransactionReceipt({ hash: await token.write.approve([curveAddr, bal], { account: w.account }) })
  await pub.waitForTransactionReceipt({ hash: await curve.write.sell([bal / 2n], { account: w.account }) })
}
console.log('traffic done')
