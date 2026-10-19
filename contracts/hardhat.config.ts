import hardhatToolboxViemPlugin from '@nomicfoundation/hardhat-toolbox-viem'
import { configVariable, defineConfig } from 'hardhat/config'

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    profiles: {
      default: {
        version: '0.8.28',
        settings: { optimizer: { enabled: true, runs: 200 }, viaIR: true, evmVersion: 'cancun' },
      },
    },
  },
  networks: {
    localhost: { type: 'http', chainType: 'l1', url: 'http://127.0.0.1:8545' },
    // Robinhood Chain (Arbitrum Orbit, gas paid in ETH)
    robinhoodTestnet: {
      type: 'http',
      chainType: 'generic',
      chainId: 46630,
      url: configVariable('RH_TESTNET_RPC'),
      accounts: [configVariable('DEPLOYER_KEY')],
    },
    robinhood: {
      type: 'http',
      chainType: 'generic',
      chainId: 4663,
      url: configVariable('RH_MAINNET_RPC'),
      accounts: [configVariable('DEPLOYER_KEY')],
    },
  },
})
