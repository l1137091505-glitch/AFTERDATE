import { useEffect, useMemo, useState } from 'react'
import { formatEther, isAddress, parseEther, zeroPadValue } from 'ethers'
import { BOT_CHAIN_HEX, CONTRACT_ADDRESS, Eip1193, ensureBotChain, readContract, writeContract } from './chain'

declare global { interface Window { ethereum?: Eip1193 & { providers?: Eip1193[] } } }

type Listing = { id: bigint; seller: string; buyer: string; price: bigint; revealWindow: bigint; deadline: bigint; state: number; payloadHash: string; keyHash: string; key: string; label: string }
type View = 'market' | 'list' | 'vault'
const ZERO = '0x0000000000000000000000000000000000000000'
const states = ['AVAILABLE', 'LOCKED', 'REVEALED', 'REFUNDED', 'CANCELLED']
const demo: Listing[] = [
  { id: 8n, seller: '0x78E2c410d1D4F8E91F4586602B7dc7A5D09d6A21', buyer: ZERO, price: parseEther('2.40'), revealWindow: 86400n, deadline: 0n, state: 0, payloadHash: '0xa81b…e190', keyHash: '0x19a2…77c0', key: '0x', label: 'Field recordings / Vol. 04' },
  { id: 7n, seller: '0x2A2bA1FDFbb77a2E268a6be065A22ef2D42651d4', buyer: ZERO, price: parseEther('0.85'), revealWindow: 21600n, deadline: 0n, state: 0, payloadHash: '0x50f2…19ae', keyHash: '0xc001…8f42', key: '0x', label: 'Research archive — September' },
  { id: 6n, seller: '0x43800c5C533E9411D91368a6C84826A4Dd4D880A', buyer: ZERO, price: parseEther('4.10'), revealWindow: 172800n, deadline: 0n, state: 0, payloadHash: '0xb833…0021', keyHash: '0xfe92…190a', key: '0x', label: 'Private asset bundle 12B' },
]

function short(a: string) { return a.length > 16 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a }
function errorText(e: unknown) { const x = e as { shortMessage?: string; message?: string }; return x.shortMessage || x.message || 'The transaction could not be completed.' }

export default function App() {
  const [view, setView] = useState<View>('market')
  const [wallet, setWallet] = useState<Eip1193 | null>(null)
  const [account, setAccount] = useState('')
  const [items, setItems] = useState<Listing[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [filter, setFilter] = useState<'all' | 'open' | 'mine'>('all')
  const preview = !CONTRACT_ADDRESS || !isAddress(CONTRACT_ADDRESS)

  async function load() {
    const contract = readContract()
    if (!contract) { setItems(demo); return }
    setLoading(true)
    try {
      const total = Number(await contract.listingCount())
      const ids = Array.from({ length: Math.min(total, 24) }, (_, i) => BigInt(total - i))
      const rows = await Promise.all(ids.map(async id => {
        const r = await contract.listingOf(id)
        return { id, seller: r.seller, buyer: r.buyer, price: r.price, revealWindow: r.revealWindow, deadline: r.deadline, state: Number(r.state), payloadHash: r.payloadHash, keyHash: r.keyHash, key: r.key, label: r.label } as Listing
      }))
      setItems(rows)
    } catch (e) { setNotice(errorText(e)) } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  async function connect() {
    const injected = window.ethereum
    if (!injected) {
      const mobile = /Android|iPhone|iPad/i.test(navigator.userAgent)
      if (mobile) window.location.href = `https://metamask.app.link/dapp/${location.host}${location.pathname}`
      else setNotice('No browser wallet found. Install MetaMask, Rabby or another EVM wallet, then refresh.')
      return
    }
    try {
      const chosen = injected.providers?.find(p => Boolean((p as unknown as { isMetaMask?: boolean }).isMetaMask)) || injected.providers?.[0] || injected
      const accounts = await chosen.request({ method: 'eth_requestAccounts' }) as string[]
      await chosen.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BOT_CHAIN_HEX }] }).catch(async (e: { code?: number }) => {
        if (e.code === 4902) await ensureBotChain(chosen); else throw e
      })
      setWallet(chosen); setAccount(accounts[0] || ''); setNotice('Wallet connected to BOT Chain.')
      chosen.on?.('accountsChanged', (...args) => setAccount(((args[0] as string[]) || [])[0] || ''))
    } catch (e) { setNotice(errorText(e)) }
  }

  async function act(key: string, fn: () => Promise<unknown>) {
    if (preview) { setNotice('Preview mode is active. Deploy the contract and add VITE_AFTERDATE_ADDRESS to enable transactions.'); return }
    if (!wallet) { await connect(); return }
    setBusy(key); setNotice('Confirm the transaction in your wallet…')
    try { const tx = await fn() as { wait: () => Promise<unknown> }; await tx.wait(); setNotice('Transaction confirmed on BOT Chain.'); await load() }
    catch (e) { setNotice(errorText(e)) } finally { setBusy('') }
  }

  const shown = useMemo(() => items.filter(x => filter === 'all' || (filter === 'open' ? x.state === 0 : x.seller.toLowerCase() === account.toLowerCase() || x.buyer.toLowerCase() === account.toLowerCase())), [items, filter, account])
  const openCount = items.filter(x => x.state === 0).length
  const lockedValue = items.filter(x => x.state === 1).reduce((a, x) => a + x.price, 0n)

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={() => setView('market')}><span className="brand-mark">AD</span><span>AFTERDATE<small>KEY EXCHANGE OFFICE</small></span></button>
      <nav>
        <button className={view === 'market' ? 'active' : ''} onClick={() => setView('market')}>Exchange</button>
        <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>Create listing</button>
        <button className={view === 'vault' ? 'active' : ''} onClick={() => setView('vault')}>My ledger</button>
      </nav>
      <button className="wallet" onClick={connect}><i />{account ? short(account) : 'Connect wallet'}<span>↗</span></button>
    </header>

    {preview && <div className="preview-strip"><b>PREVIEW LEDGER</b><span>Sample records are visible. Deploy the contract to write live entries.</span></div>}
    {notice && <button className="notice" onClick={() => setNotice('')}>{notice}<b>×</b></button>}

    <main>
      {view === 'market' && <>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">BOT CHAIN / FAIR EXCHANGE / 2026</p>
            <h1>Trade the key.<br/><em>Not the trust.</em></h1>
            <p className="lede">A timed desk for encrypted deliveries. Payment stays in escrow until the exact key is revealed — or returns to the buyer.</p>
            <div className="hero-actions"><button className="primary" onClick={() => setView('list')}>Open a listing <span>↗</span></button><a href="#ledger">Browse the ledger ↓</a></div>
          </div>
          <div className="hero-visual">
            <div className="date-card"><span>EXCHANGE NOTE</span><b>{String(new Date().getDate()).padStart(2,'0')}</b><strong>{new Date().toLocaleString('en', { month: 'short' }).toUpperCase()} / {new Date().getFullYear()}</strong><hr/><p>Seller commits</p><p>Buyer locks funds</p><p>Key unlocks payment</p><div className="seal">VERIFIED<br/>SEQUENCE</div></div>
          </div>
        </section>

        <section className="ticker"><div><b>{String(openCount).padStart(2,'0')}</b><span>Open listings</span></div><div><b>{items.length.toString().padStart(2,'0')}</b><span>Ledger entries</span></div><div><b>{Number(formatEther(lockedValue)).toFixed(2)}</b><span>BOT in escrow</span></div><div><b>677</b><span>Network ID</span></div></section>

        <section className="ledger" id="ledger">
          <div className="section-head"><div><p className="eyebrow">THE PUBLIC LEDGER</p><h2>Current exchanges</h2></div><div className="filters">{(['all','open','mine'] as const).map(f => <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>{f}</button>)}</div></div>
          <div className="list-head"><span>REF / SUBJECT</span><span>SELLER</span><span>WINDOW</span><span>PRICE</span><span>STATUS</span></div>
          <div className="rows">{loading ? <div className="empty">Reading BOT Chain…</div> : shown.length ? shown.map(item => <article className="row" key={item.id.toString()}>
            <div><small>AD—{item.id.toString().padStart(4,'0')}</small><h3>{item.label}</h3><p>{short(item.payloadHash)}</p></div>
            <code>{short(item.seller)}</code>
            <span>{Number(item.revealWindow) / 3600} HOURS</span>
            <strong>{Number(formatEther(item.price)).toFixed(2)} <small>BOT</small></strong>
            <div className="status-action"><i className={`state s${item.state}`}>{states[item.state]}</i>{item.state === 0 && <button disabled={busy === `buy${item.id}`} onClick={() => act(`buy${item.id}`, async () => (await writeContract(wallet!)).buy(item.id, { value: item.price }))}>Acquire →</button>}</div>
          </article>) : <div className="empty">No records match this view.</div>}</div>
        </section>

        <section className="method"><div><p className="eyebrow">THE THREE-DATE METHOD</p><h2>No middleman.<br/>Only sequence.</h2></div>{[['01','COMMIT','The seller posts a data hash, key commitment, price and reveal window.'],['02','LOCK','The first buyer locks exact payment and starts the countdown.'],['03','REVEAL','The matching key releases payment. A missed deadline enables refund.']].map(x => <article key={x[0]}><b>{x[0]}</b><h3>{x[1]}</h3><p>{x[2]}</p></article>)}</section>
      </>}

      {view === 'list' && <CreateListing wallet={wallet} preview={preview} busy={busy} connect={connect} act={act} done={() => { setView('market'); void load() }} />}
      {view === 'vault' && <MyLedger account={account} wallet={wallet} items={items} preview={preview} busy={busy} connect={connect} act={act} />}
    </main>
    <footer><div><span className="brand-mark">AD</span><b>AFTERDATE</b></div><p>Timed exchange for encrypted deliveries.<br/>Every action settles on BOT Chain.</p><div><a href="https://scan.botchain.ai" target="_blank">Explorer ↗</a><a href="https://botchain.ai" target="_blank">BOT Chain ↗</a></div><small>CHAIN ID 677 / MAINNET</small></footer>
  </div>
}

function CreateListing({ wallet, preview, busy, connect, act, done }: { wallet: Eip1193 | null; preview: boolean; busy: string; connect: () => Promise<void>; act: (k:string, f:()=>Promise<unknown>)=>Promise<void>; done:()=>void }) {
  const [label, setLabel] = useState('')
  const [payloadHash, setPayloadHash] = useState('')
  const [keyHash, setKeyHash] = useState('')
  const [price, setPrice] = useState('1')
  const [hours, setHours] = useState('24')
  async function submit(e: React.FormEvent) { e.preventDefault(); if (!wallet && !preview) { await connect(); return }; await act('list', async () => (await writeContract(wallet!)).list(zeroPadValue(payloadHash, 32), zeroPadValue(keyHash, 32), parseEther(price), BigInt(Number(hours) * 3600), label)); done() }
  return <section className="form-page"><div className="form-intro"><p className="eyebrow">NEW EXCHANGE / STEP 01</p><h1>Place a key<br/><em>on the clock.</em></h1><p>Prepare the encrypted file first. The contract stores only its SHA-256 digest and the commitment to your 32-byte decryption key.</p><div className="rule"><b>Important</b><span>The revealed key becomes public on-chain. Use it for a single delivery, never as a reusable password.</span></div></div><form onSubmit={submit}>
    <label><span>01 / Listing title</span><input value={label} onChange={e=>setLabel(e.target.value)} placeholder="e.g. Research archive — October" required maxLength={80}/></label>
    <label><span>02 / Encrypted payload hash</span><input value={payloadHash} onChange={e=>setPayloadHash(e.target.value)} placeholder="0x…  SHA-256 / bytes32" pattern="0x[0-9a-fA-F]{64}" required/><small>Hash the encrypted file, not the plaintext.</small></label>
    <label><span>03 / Key commitment</span><input value={keyHash} onChange={e=>setKeyHash(e.target.value)} placeholder="0x…  keccak256(bytes32 key)" pattern="0x[0-9a-fA-F]{64}" required/></label>
    <div className="pair"><label><span>04 / Price</span><div className="suffix"><input type="number" min="0.0001" step="0.0001" value={price} onChange={e=>setPrice(e.target.value)} required/><b>BOT</b></div></label><label><span>05 / Reveal window</span><div className="suffix"><input type="number" min="1" max="2160" value={hours} onChange={e=>setHours(e.target.value)} required/><b>HRS</b></div></label></div>
    <button className="submit" disabled={busy === 'list'}>{busy === 'list' ? 'Writing to ledger…' : preview ? 'Preview listing' : 'Sign & publish listing'}<span>↗</span></button>
  </form></section>
}

function MyLedger({ account, wallet, items, preview, busy, connect, act }: { account:string; wallet:Eip1193|null; items:Listing[]; preview:boolean; busy:string; connect:()=>Promise<void>; act:(k:string,f:()=>Promise<unknown>)=>Promise<void> }) {
  const mine = items.filter(x => x.seller.toLowerCase() === account.toLowerCase() || x.buyer.toLowerCase() === account.toLowerCase())
  const [revealKeys, setRevealKeys] = useState<Record<string,string>>({})
  if (!account) return <section className="connect-page"><p className="eyebrow">PRIVATE LEDGER VIEW</p><h1>Your exchanges,<br/><em>in one place.</em></h1><p>Connect the wallet used to list or acquire a key.</p><button className="primary" onClick={connect}>Connect wallet ↗</button></section>
  return <section className="vault-page"><div className="section-head"><div><p className="eyebrow">MY LEDGER / {short(account)}</p><h1>Exchange records</h1></div><button className="outline" onClick={() => act('withdraw', async () => (await writeContract(wallet!)).withdraw())}>{busy === 'withdraw' ? 'Withdrawing…' : 'Withdraw proceeds'}</button></div>{mine.length ? mine.map(x => <article className="vault-card" key={x.id.toString()}><div><small>AD—{x.id.toString().padStart(4,'0')}</small><h2>{x.label}</h2><p>{states[x.state]} · {formatEther(x.price)} BOT</p></div><div className="vault-controls">{x.state === 0 && x.seller.toLowerCase() === account.toLowerCase() && <button onClick={() => act(`cancel${x.id}`, async () => (await writeContract(wallet!)).cancel(x.id))}>Cancel listing</button>}{x.state === 1 && x.seller.toLowerCase() === account.toLowerCase() && <><input value={revealKeys[x.id.toString()] || ''} onChange={e=>setRevealKeys({...revealKeys,[x.id.toString()]:e.target.value})} placeholder="0x… 32-byte key"/><button onClick={() => act(`reveal${x.id}`, async () => (await writeContract(wallet!)).reveal(x.id, revealKeys[x.id.toString()]))}>Reveal key</button></>}{x.state === 1 && x.buyer.toLowerCase() === account.toLowerCase() && Number(x.deadline) < Date.now()/1000 && <button onClick={() => act(`refund${x.id}`, async () => (await writeContract(wallet!)).refund(x.id))}>Claim refund</button>}</div></article>) : <div className="empty large">No exchanges are attached to this wallet yet.{preview && ' Preview records are not tied to real accounts.'}</div>}</section>
}
