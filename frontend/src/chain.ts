import { BrowserProvider, Contract, JsonRpcProvider } from 'ethers'

export const BOT_CHAIN_ID = 677
export const BOT_CHAIN_HEX = '0x2a5'
export const RPC_URL = 'https://rpc.botchain.ai'
export const EXPLORER = 'https://scan.botchain.ai'
export const CONTRACT_ADDRESS = import.meta.env.VITE_AFTERDATE_ADDRESS ?? ''

export const ABI = [
  'function listingCount() view returns (uint256)',
  'function listingOf(uint256 id) view returns (address seller,address buyer,uint128 price,uint64 revealWindow,uint64 deadline,uint8 state,bytes32 payloadHash,bytes32 keyHash,bytes32 key,string label)',
  'function list(bytes32 payloadHash,bytes32 keyHash,uint128 price,uint64 revealWindow,string label) returns (uint256)',
  'function buy(uint256 id) payable',
  'function reveal(uint256 id,bytes32 key)',
  'function refund(uint256 id)',
  'function cancel(uint256 id)',
  'function pending(address) view returns (uint256)',
  'function withdraw()',
] as const

export type Eip1193 = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown>; on?: (event: string, fn: (...args: unknown[]) => void) => void }

export async function ensureBotChain(wallet: Eip1193) {
  try {
    await wallet.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BOT_CHAIN_HEX }] })
  } catch (error) {
    if ((error as { code?: number }).code !== 4902) throw error
    await wallet.request({ method: 'wallet_addEthereumChain', params: [{
      chainId: BOT_CHAIN_HEX,
      chainName: 'BOT Chain Mainnet',
      nativeCurrency: { name: 'BOT', symbol: 'BOT', decimals: 18 },
      rpcUrls: [RPC_URL],
      blockExplorerUrls: [EXPLORER],
    }] })
  }
}

export const readContract = () => CONTRACT_ADDRESS ? new Contract(CONTRACT_ADDRESS, ABI, new JsonRpcProvider(RPC_URL)) : null
export const writeContract = async (wallet: Eip1193) => {
  await ensureBotChain(wallet)
  const provider = new BrowserProvider(wallet)
  return new Contract(CONTRACT_ADDRESS, ABI, await provider.getSigner())
}
