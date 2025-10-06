// components/ChatWindow.tsx
'use client';
import React, { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { pushToast } from "./Toast";
import { useAccount } from 'wagmi';

// <-- contract writer
import { writeLogInsight } from '../lib/insightContract';

export type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type Props = {
  messages?: Message[];
  address?: string | null;
};

function shortAddr(a?: string) {
  if (!a) return '';
  try {
    if (typeof a !== 'string') return String(a);
    if (a.length <= 10) return a;
    return `${a.slice(0, 6)}...${a.slice(-4)}`;
  } catch {
    return String(a);
  }
}
function fmtEth(n?: number|null) {
  if (n === null || n === undefined) return 'n/a';
  return `${n.toFixed(6)} ETH`;
}
function fmtUsd(n?: number|null) {
  if (n === null || n === undefined) return 'n/a';
  return `$${n.toFixed(2)}`;
}
function etherscanTxLink(hash: string, network = 'mainnet') {
  if (!hash) return '#';
  const prefix = network === 'mainnet' ? '' : `${network}.`;
  return `https://${prefix}etherscan.io/tx/${hash}`;
}
function fmtTimestamp(ts?: string | number | null) {
  if (!ts) return 'unknown';
  try {
    const d = new Date(ts);
    return d.toLocaleString();
  } catch { return String(ts); }
}

// small helper to safely set the assistant placeholder text (replace, don't append extra JSON)
function setAssistantTextById(setMessages: React.Dispatch<React.SetStateAction<Message[]>>, id: string, text: string) {
  setMessages(prev => prev.map(m => m.id === id ? { ...m, text: (text || '') } : m));
}

// helper: append text to assistant placeholder
function appendAssistantTextById(setMessages: React.Dispatch<React.SetStateAction<Message[]>>, id: string, text: string) {
  setMessages(prev => prev.map(m => m.id === id ? { ...m, text: (m.text || '') + text } : m));
}

/**
 * Safe JSON parse helper (only attempts parse when string appears to be JSON)
 * Returns parsed object or null if not JSON/parse fails.
 */
function tryParseJsonSafe(s: string) {
  const trimmed = String(s ?? '').trim();
  if (!trimmed) return null;
  const first = trimmed[0];
  if (first !== '{' && first !== '[') return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

/**
 * GasSummaryCard component (updated to accept insight prop so it can show Log on-chain)
 */
function GasSummaryCard({ gas, insight }: { gas: any; insight?: { query?: string; answer?: string } }) {
  const totalGasEth = gas.totalGasEth ?? gas.totalGas ?? 0;
  const usd = gas.usd ?? null;
  const receiptsChecked = gas.receiptsChecked ?? gas.approxCount ?? 0;
  const usedWindow = gas.usedWindow ?? gas.window ?? null;

  // diagnostics object may be under gas.diagnostics or inline fields
  const diagnostics = gas.diagnostics ?? (() => {
    const d: any = {};
    if (gas.transfersConsidered !== undefined) d.transfersConsidered = gas.transfersConsidered;
    if (gas.recentCandidates !== undefined) d.recentCandidates = gas.recentCandidates;
    if (gas.sampleHashes !== undefined) d.sampleHashes = gas.sampleHashes;
    if (gas.recentCandidates30 !== undefined) d.recentCandidates30 = gas.recentCandidates30;
    if (gas.sampleHashes30 !== undefined) d.sampleHashes30 = gas.sampleHashes30;
    if (Object.keys(d).length === 0) return null;
    return d;
  })();

  const [showDiag, setShowDiag] = useState(false);

  return (
    <div style={{border:'1px solid rgba(255,255,255,0.03)', padding:12, borderRadius:12, maxWidth:720, marginTop:8}}>
      <div style={{fontWeight:800}}>Gas summary</div>
      <div style={{marginTop:6}}>{`Estimated / Approx gas: ${fmtEth(totalGasEth)} ${usd?`(~${fmtUsd(usd)})`:''}`}</div>
      <div style={{fontSize:12, color:'var(--muted)', marginTop:6}}>
        {`Based on ${receiptsChecked} txs`}{usedWindow ? ` · window: ${usedWindow} days` : ''}
      </div>

      {diagnostics && (
        <div style={{marginTop:10}}>
          <button
            onClick={() => setShowDiag(s => !s)}
            style={{fontSize:12, padding:'6px 8px', cursor:'pointer'}}
            aria-pressed={showDiag}
          >
            {showDiag ? 'Hide diagnostics' : 'Show diagnostics'}
          </button>

          {showDiag && (
            <pre style={{marginTop:8, fontSize:12, color:'var(--muted)', whiteSpace:'pre-wrap', maxHeight: 360, overflow: 'auto', padding:8, background: 'rgba(255,255,255,0.01)', borderRadius:6}}>
              {JSON.stringify(diagnostics, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* If there's an insight attached to this gas summary, show CTA buttons (Log on-chain / Skip) */}
      {insight?.answer && (
        <div style={{marginTop:12, display:'flex', gap:8, alignItems: 'center'}}>
          <button
            onClick={() => confirmAndWriteInsight(insight.query ?? 'AI insight', insight.answer ?? '')}
            style={{ padding: '6px 10px', borderRadius: 8, cursor: 'pointer', background: 'linear-gradient(90deg,var(--accent-a),var(--accent-b))', color:'#041414', fontWeight:700 }}
          >
            Log on-chain
          </button>
          <button
            onClick={() => pushToast('Skipped on-chain logging')}
            style={{ padding: '6px 10px', borderRadius: 8, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(255,255,255,0.03)', color: 'var(--muted)' }}
          >
            Skip
          </button>
        </div>
      )}
    </div>
  );
}

// Wrapper that actually calls writeLogInsight after user confirms (used by buttons)
async function confirmAndWriteInsight(query: string, answer: string) {
  try {
    const ok = window.confirm('Log this insight on-chain? This will open your wallet to confirm and cost LAKA for gas. Proceed?');
    if (!ok) {
      pushToast('Skipped on-chain logging');
      return;
    }
    const tx = await writeLogInsight(query, answer);
    pushToast('Insight logged on Aurora chain ✅');
    console.log('Insight logged, tx hash:', tx.hash);
  } catch (err: any) {
    console.error('Failed to log on-chain', err);
    pushToast('⚠️ Failed to log on-chain: ' + String(err?.message ?? err));
  }
}

export default function ChatWindow({ messages: initialMessages, address: propAddress }: Props) {
  // wagmi fallback: useAccount provides the currently connected address if any
  const { address: wagmiAddress } = useAccount();
  const effectiveAddress = (propAddress && propAddress.length) ? propAddress : (wagmiAddress ?? null);

  const [messages, setMessages] = useState<Message[]>(initialMessages ?? [
    { id: uuidv4(), role: "assistant", text: "Hi — I'm BlockTalk. Ask me about transactions, gas, PnL, or DAO deadlines." }
  ]);

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const containerRef = useRef<HTMLDivElement|null>(null);

  useEffect(()=>{
    if(containerRef.current){
      // scroll last item into view
      containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, isTyping]);

  const suggestions = ['How much gas did I spend this week?','Show my portfolio PnL','Any DAO votes due?'];

  function isWalletIntent(q: string) {
    const s = q.toLowerCase();
    return /last transaction|latest transaction|most recent transaction|gas (did i|spent|spent this week|this week)|pnl|portfolio|recent activity|recent transactions|any dao|dao votes|votes due/i.test(s);
  }

  // Render helpers for structured assistant replies
  function renderTxCard(tx: any, receipt: any, feeEth?: number, feeUsd?: number, insight?: { query?: string; answer?: string }) {
    const hash = (tx?.hash ?? receipt?.transactionHash) as string;
    const status = (receipt?.status === '0x1' || receipt?.status === 1 || receipt?.status === '1') ? 'Succeeded' : 'Failed';
    const gasUsed = receipt?.gasUsed ? Number(BigInt(receipt.gasUsed).toString()) : (receipt?.gasUsed ? Number(receipt.gasUsed) : null);
    const from = receipt?.from ?? tx?.from;
    const to = receipt?.to ?? tx?.to;
    const value = tx?.value ? Number(BigInt(tx.value)) / 1e18 : 0;
    return (
      <div className="tx-card" style={{border:'1px solid rgba(255,255,255,0.03)', padding:12, borderRadius:12, maxWidth:720, marginTop:8}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:12}}>
          <div>
            <div style={{fontWeight:800, fontSize:14}}>Transaction</div>
            <div style={{fontSize:13, color:'var(--muted)'}}>{hash}</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontWeight:700, color: status === 'Succeeded' ? 'limegreen' : 'salmon'}}>{status}</div>
            <div style={{fontSize:12, color:'var(--muted)'}}>{fmtEth(feeEth)} {feeUsd ? `(${fmtUsd(feeUsd)})` : ''}</div>
          </div>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:10}}>
          <div>
            <div style={{fontSize:12, color:'var(--muted)'}}>From</div>
            <div style={{fontWeight:700}}>{shortAddr(from)}</div>
          </div>
          <div>
            <div style={{fontSize:12, color:'var(--muted)'}}>To</div>
            <div style={{fontWeight:700}}>{shortAddr(to)}</div>
          </div>

          <div>
            <div style={{fontSize:12, color:'var(--muted)'}}>Gas used</div>
            <div style={{fontWeight:700}}>{gasUsed ?? 'n/a'}</div>
          </div>
          <div>
            <div style={{fontSize:12, color:'var(--muted)'}}>Value</div>
            <div style={{fontWeight:700}}>{value} ETH</div>
          </div>
        </div>

        <div style={{display:'flex', gap:8, marginTop:12, alignItems:'center'}}>
          <a className="link" href={etherscanTxLink(hash)} target="_blank" rel="noreferrer" style={{fontWeight:700}}>View on Etherscan</a>
          {receipt?.logs && receipt.logs.length > 0 && <div style={{fontSize:12, color:'var(--muted)'}}>{receipt.logs.length} logs</div>}
          <div style={{fontSize:12, color:'var(--muted)'}}>Block: {receipt?.blockNumber ? parseInt(String(receipt.blockNumber), 16) : 'n/a'}</div>

          {/* Log on-chain CTA */}
          {insight?.answer && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button
                onClick={() => confirmAndWriteInsight(insight.query ?? 'AI insight', insight.answer ?? '')}
                style={{ padding: '6px 10px', borderRadius: 8, cursor: 'pointer', background: 'linear-gradient(90deg,var(--accent-a),var(--accent-b))', color:'#041414', fontWeight:700 }}
              >
                Log on-chain
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderTransfersList(arr: any[], insight?: { query?: string; answer?: string }) {
    if (!arr || !arr.length) return <div style={{fontStyle:'italic', color:'var(--muted)', marginTop:8}}>No transfers</div>;
    return (
      <div style={{border:'1px solid rgba(255,255,255,0.03)', padding:12, borderRadius:12, maxWidth:820, marginTop:8}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div style={{fontWeight:800}}>Recent transfers</div>
          {insight?.answer && (
            <button
              onClick={() => confirmAndWriteInsight(insight.query ?? 'AI insight', insight.answer ?? '')}
              style={{ padding: '6px 10px', borderRadius: 8, cursor: 'pointer', background: 'linear-gradient(90deg,var(--accent-a),var(--accent-b))', color:'#041414', fontWeight:700 }}
            >
              Log on-chain
            </button>
          )}
        </div>
        <div style={{marginTop:8, display:'grid', gap:8}}>
          {arr.map((t, i) => (
            <div key={t.hash || i} style={{display:'flex', justifyContent:'space-between', gap:12, alignItems:'center'}}>
              <div>
                <div style={{fontWeight:700}}>{t.category ?? 'tx'}</div>
                <div style={{fontSize:12, color:'var(--muted)'}}>{shortAddr(t.from)} → {shortAddr(t.to)} · {fmtTimestamp(t.timestamp)}</div>
              </div>
              <div style={{fontSize:12, color:'var(--muted)'}}>
                <a href={etherscanTxLink(t.hash)} target="_blank" rel="noreferrer">Etherscan</a>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // A lightweight map that stores structured data for "card" messages keyed by message id.
  const structuredCards = useRef(new Map<string, any>()).current;

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if(!trimmed) return;

    // add user message
    const userMsg: Message = { id: uuidv4(), role: 'user', text: trimmed };
    setMessages(m => [...m, userMsg]);

    // reset input and show typing indicator
    setInput('');
    setIsTyping(true);

    // create assistant placeholder
    const assistantId = uuidv4();
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', text: '' }]);

    // wallet intent requires address
    if (isWalletIntent(trimmed) && !effectiveAddress) {
      pushToast('Connect a wallet (address) to answer wallet-specific questions.');
      appendAssistantTextById(setMessages, assistantId, '\n[Missing wallet address — connect to continue]');
      setIsTyping(false);
      return;
    }

    // Build payload
    const payload: any = { query: trimmed };
    if (effectiveAddress) payload.address = effectiveAddress;

    try {
      console.log('[ChatWindow] Sending /api/ai request', payload);
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      console.log('[ChatWindow] /api/ai response status:', res.status, 'content-type:', res.headers.get('content-type'));

      if (!res.ok) {
        let textBody = '';
        try { textBody = await res.text(); } catch(e){ textBody = '(no body)'; }
        console.warn('[ChatWindow] server error body:', textBody);
        if (/missing address/i.test(textBody)) {
          pushToast('Server: missing address for wallet query. Connect wallet and try again.');
        } else if (res.status === 402 || /quota|insufficient_quota|billing/i.test(textBody)) {
          pushToast('OpenAI quota reached — using local mock replies (check billing/rotate key).');
        } else {
          pushToast('AI service error');
        }
        appendAssistantTextById(setMessages, assistantId, `\n[Server error] ${textBody}`);
        setIsTyping(false);
        return;
      }

      const contentType = res.headers.get('content-type') ?? '';

      // Non-stream (JSON) responses handling — try to parse JSON and render structured UI
      if (!res.body || !contentType.includes('event-stream')) {
        let parsed: any = null;
        let rawText = '';
        try {
          parsed = await res.json();
        } catch (e) {
          try { rawText = await res.text(); } catch { rawText = '(unable to read response)'; }
        }

        // If we parsed JSON, prefer structured handling (and don't append raw JSON)
        if (parsed && typeof parsed === 'object') {
          // 1) tx + receipt structured response
          if ((parsed.tx || parsed.receipt) && (parsed.receipt || parsed.tx)) {
            const txRes = parsed.tx?.result ?? parsed.tx ?? parsed.tx;
            const rRes = parsed.receipt?.result ?? parsed.receipt ?? parsed.receipt;
            const feeEth = parsed.feeEth ?? parsed.totalGasEth ?? null;
            const feeUsd = parsed.feeUsd ?? parsed.usd ?? null;

            // show human readable answer as assistant text
            setAssistantTextById(setMessages, assistantId, '\n' + (parsed.answer ?? ''));

            // store insight on structured card instead of auto-logging
            const cardId = uuidv4();
            setTimeout(()=> setMessages(prev => [...prev, { id: cardId, role: 'assistant', text: '__STRUCTURED_TX__' }]), 10);
            structuredCards.set(cardId, { tx: txRes, receipt: rRes, feeEth, feeUsd, insight: { query: trimmed, answer: parsed.answer } });
            setIsTyping(false);
            return;
          }

          // 2) gas summary (structured)
          if (parsed.totalGasEth !== undefined || parsed.approxCount !== undefined || parsed.receiptsChecked !== undefined) {
            setAssistantTextById(setMessages, assistantId, '\n' + (parsed.answer ?? ''));

            const cardId = uuidv4();
            setTimeout(()=> setMessages(prev => [...prev, { id: cardId, role: 'assistant', text: '__STRUCTURED_GAS__' }]), 10);
            structuredCards.set(cardId, { gas: parsed, insight: { query: trimmed, answer: parsed.answer } });
            setIsTyping(false);
            return;
          }

          // 3) transfers list
          if (Array.isArray(parsed.items) || Array.isArray(parsed.summary) || Array.isArray(parsed.transfers)) {
            const arr = parsed.items ?? parsed.summary ?? parsed.transfers;
            setAssistantTextById(setMessages, assistantId, '\n' + (parsed.answer ?? ''));

            const cardId = uuidv4();
            setTimeout(()=> setMessages(prev => [...prev, { id: cardId, role: 'assistant', text: '__STRUCTURED_TRANSFERS__' }]), 10);
            structuredCards.set(cardId, { transfers: arr, insight: { query: trimmed, answer: parsed.answer } });
            setIsTyping(false);
            return;
          }

          // 4) portfolio / pnl structured
          if (parsed.balanceEth !== undefined || parsed.tokenPrices !== undefined) {
            setAssistantTextById(setMessages, assistantId, '\n' + (parsed.answer ?? ''));

            const cardId = uuidv4();
            setTimeout(()=> setMessages(prev => [...prev, { id: cardId, role: 'assistant', text: '__STRUCTURED_PORTFOLIO__' }]), 10);
            structuredCards.set(cardId, { portfolio: parsed, insight: { query: trimmed, answer: parsed.answer } });
            setIsTyping(false);
            return;
          }

          // If parsed has an 'answer' field prefer it (but do not auto-log)
          if (typeof parsed.answer === 'string' && parsed.answer.trim().length > 0) {
            setAssistantTextById(setMessages, assistantId, '\n' + parsed.answer);

            // create a small structured insight card so user can choose to log it
            const cardId = uuidv4();
            setTimeout(()=> setMessages(prev => [...prev, { id: cardId, role: 'assistant', text: '__STRUCTURED_INSIGHT__' }]), 10);
            structuredCards.set(cardId, { insight: { query: trimmed, answer: parsed.answer } });
            setIsTyping(false);
            return;
          }

          // fallback: pretty-print JSON into assistant placeholder
          setAssistantTextById(setMessages, assistantId, '\n' + JSON.stringify(parsed, null, 2));
          setIsTyping(false);
          return;
        }

        // Parsed failed — append raw text (for non-JSON responses)
        appendAssistantTextById(setMessages, assistantId, '\n' + rawText);
        setIsTyping(false);
        return;
      }

      // --- STREAM HANDLING (robust to combined marker+JSON) ---
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      let tokenCount = 0;
      let expectingStructured = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });

        // split by double-newline (SSE payload separator)
        const parts = buf.split('\n\n');
        buf = parts.pop() || '';

        for (const part of parts) {
          if (!part.startsWith('data:')) continue;
          let token = part.replace(/^data:\s*/, '').trim();
          if (!token) continue;

          // If token contains the structured marker and JSON together, handle it:
          while (token.includes('[STRUCTURED]')) {
            const idx = token.indexOf('[STRUCTURED]');
            const before = token.slice(0, idx);
            if (before.trim()) {
              appendAssistantTextById(setMessages, assistantId, before);
            }
            const rest = token.slice(idx + '[STRUCTURED]'.length).trim();
            if (!rest) {
              expectingStructured = true;
              token = '';
              break;
            }

            // JSON guard: parse only if looks like JSON
            const parsed = tryParseJsonSafe(rest);
            if (parsed !== null) {
              // structured tx
              if (parsed.tx || parsed.receipt) {
                setAssistantTextById(setMessages, assistantId, '\n' + (parsed.answer ?? ''));
                const cardId = uuidv4();
                setTimeout(()=> setMessages(prev => [...prev, { id: cardId, role: 'assistant', text: '__STRUCTURED_TX__' }]), 10);
                structuredCards.set(cardId, { tx: parsed.tx, receipt: parsed.receipt, feeEth: parsed.feeEth, feeUsd: parsed.feeUsd, insight: { query: trimmed, answer: parsed.answer } });
              } else if (parsed.totalGasEth !== undefined || parsed.receiptsChecked !== undefined || parsed.approxCount !== undefined) {
                setAssistantTextById(setMessages, assistantId, '\n' + (parsed.answer ?? ''));
                const cardId = uuidv4();
                setTimeout(()=> setMessages(prev => [...prev, { id: cardId, role: 'assistant', text: '__STRUCTURED_GAS__' }]), 10);
                structuredCards.set(cardId, { gas: parsed, insight: { query: trimmed, answer: parsed.answer } });
              } else if (Array.isArray(parsed.items) || Array.isArray(parsed.summary) || Array.isArray(parsed.transfers)) {
                const arr = parsed.items ?? parsed.summary ?? parsed.transfers;
                setAssistantTextById(setMessages, assistantId, '\n' + (parsed.answer ?? ''));
                const cardId = uuidv4();
                setTimeout(()=> setMessages(prev => [...prev, { id: cardId, role: 'assistant', text: '__STRUCTURED_TRANSFERS__' }]), 10);
                structuredCards.set(cardId, { transfers: arr, insight: { query: trimmed, answer: parsed.answer } });
              } else if (parsed.balanceEth !== undefined || parsed.tokenPrices !== undefined) {
                setAssistantTextById(setMessages, assistantId, '\n' + (parsed.answer ?? ''));
                const cardId = uuidv4();
                setTimeout(()=> setMessages(prev => [...prev, { id: cardId, role: 'assistant', text: '__STRUCTURED_PORTFOLIO__' }]), 10);
                structuredCards.set(cardId, { portfolio: parsed, insight: { query: trimmed, answer: parsed.answer } });
              } else if (typeof parsed.answer === 'string' && parsed.answer.trim().length > 0) {
                setAssistantTextById(setMessages, assistantId, '\n' + parsed.answer);
                const cardId = uuidv4();
                setTimeout(()=> setMessages(prev => [...prev, { id: cardId, role: 'assistant', text: '__STRUCTURED_INSIGHT__' }]), 10);
                structuredCards.set(cardId, { insight: { query: trimmed, answer: parsed.answer } });
              } else {
                appendAssistantTextById(setMessages, assistantId, '\n' + JSON.stringify(parsed, null, 2));
              }
            } else {
              // not JSON-looking; treat as text fallback
              appendAssistantTextById(setMessages, assistantId, rest);
            }

            expectingStructured = false;
            token = '';
            break;
          } // end while token includes marker

          if (!token) continue;

          if (expectingStructured) {
            const parsed = tryParseJsonSafe(token);
            if (parsed !== null) {
              if (parsed.tx || parsed.receipt) {
                setAssistantTextById(setMessages, assistantId, '\n' + (parsed.answer ?? ''));
                const cardId = uuidv4();
                setTimeout(()=> setMessages(prev => [...prev, { id: cardId, role: 'assistant', text: '__STRUCTURED_TX__' }]), 10);
                structuredCards.set(cardId, { tx: parsed.tx, receipt: parsed.receipt, feeEth: parsed.feeEth, feeUsd: parsed.feeUsd, insight: { query: trimmed, answer: parsed.answer } });
              } else if (parsed.totalGasEth !== undefined || parsed.receiptsChecked !== undefined || parsed.approxCount !== undefined) {
                setAssistantTextById(setMessages, assistantId, '\n' + (parsed.answer ?? ''));
                const cardId = uuidv4();
                setTimeout(()=> setMessages(prev => [...prev, { id: cardId, role: 'assistant', text: '__STRUCTURED_GAS__' }]), 10);
                structuredCards.set(cardId, { gas: parsed, insight: { query: trimmed, answer: parsed.answer } });
              } else if (Array.isArray(parsed.items) || Array.isArray(parsed.summary) || Array.isArray(parsed.transfers)) {
                const arr = parsed.items ?? parsed.summary ?? parsed.transfers;
                setAssistantTextById(setMessages, assistantId, '\n' + (parsed.answer ?? ''));
                const cardId = uuidv4();
                setTimeout(()=> setMessages(prev => [...prev, { id: cardId, role: 'assistant', text: '__STRUCTURED_TRANSFERS__' }]), 10);
                structuredCards.set(cardId, { transfers: arr, insight: { query: trimmed, answer: parsed.answer } });
              } else if (parsed.balanceEth !== undefined || parsed.tokenPrices !== undefined) {
                setAssistantTextById(setMessages, assistantId, '\n' + (parsed.answer ?? ''));
                const cardId = uuidv4();
                setTimeout(()=> setMessages(prev => [...prev, { id: cardId, role: 'assistant', text: '__STRUCTURED_PORTFOLIO__' }]), 10);
                structuredCards.set(cardId, { portfolio: parsed, insight: { query: trimmed, answer: parsed.answer } });
              } else if (typeof parsed.answer === 'string' && parsed.answer.trim().length > 0) {
                setAssistantTextById(setMessages, assistantId, '\n' + parsed.answer);
                const cardId = uuidv4();
                setTimeout(()=> setMessages(prev => [...prev, { id: cardId, role: 'assistant', text: '__STRUCTURED_INSIGHT__' }]), 10);
                structuredCards.set(cardId, { insight: { query: trimmed, answer: parsed.answer } });
              } else {
                appendAssistantTextById(setMessages, assistantId, '\n' + JSON.stringify(parsed, null, 2));
              }
            } else {
              appendAssistantTextById(setMessages, assistantId, token);
            }
            expectingStructured = false;
            tokenCount++;
            continue;
          }

          // Normal token flow
          if (token === '[DONE]') {
            if (tokenCount === 0) {
              appendAssistantTextById(setMessages, assistantId, '\n[No reply — server returned empty stream]');
              pushToast('No assistant reply (empty stream). Check server logs.');
            }
            setIsTyping(false);
            return;
          }

          tokenCount++;
          appendAssistantTextById(setMessages, assistantId, token);
        } // end for parts
      } // end while reader

      if (tokenCount === 0) {
        appendAssistantTextById(setMessages, assistantId, '\n[No reply — stream ended]');
        pushToast('No assistant reply (stream ended without tokens).');
      }
      setIsTyping(false);
    } catch (err: any) {
      console.error('[ChatWindow] fetch/stream error', err);
      pushToast('Network or streaming error — check server logs.');
      appendAssistantTextById(setMessages, assistantId, `\n[Network error] ${String(err?.message ?? err)}`);
      setIsTyping(false);
    }
  }

  function renderMessageContent(m: Message) {
    if (m.text === '__STRUCTURED_TX__') {
      const data = structuredCards.get(m.id);
      if (!data) return null;
      return renderTxCard(data.tx, data.receipt, data.feeEth, data.feeUsd, data.insight);
    }
    if (m.text === '__STRUCTURED_GAS__') {
      const data = structuredCards.get(m.id);
      if (!data) return null;
      // <-- pass insight into GasSummaryCard so it can show Log on-chain
      return <GasSummaryCard gas={data.gas} insight={data.insight} />;
    }
    if (m.text === '__STRUCTURED_TRANSFERS__') {
      const data = structuredCards.get(m.id);
      if (!data) return null;
      return renderTransfersList(data.transfers, data.insight);
    }
    if (m.text === '__STRUCTURED_PORTFOLIO__') {
      const data = structuredCards.get(m.id);
      if (!data) return null;
      const p = data.portfolio;
      const insight = data.insight;
      return (
        <div style={{border:'1px solid rgba(255,255,255,0.03)', padding:12, borderRadius:12, maxWidth:720, marginTop:8}}>
          <div style={{fontWeight:800}}>Portfolio</div>
          <div style={{marginTop:8}}>{p.answer ?? ''}</div>
          <div style={{marginTop:8, fontSize:13, color:'var(--muted)'}}>Balance: {fmtEth(p.balanceEth)} {p.ethUsd ? `(~${fmtUsd(p.ethUsd)})` : ''}</div>

          {insight?.answer && (
            <div style={{marginTop:12, display:'flex', gap:8}}>
              <button
                onClick={() => confirmAndWriteInsight(insight.query ?? 'AI insight', insight.answer ?? '')}
                style={{ padding: '6px 10px', borderRadius: 8, cursor: 'pointer', background: 'linear-gradient(90deg,var(--accent-a),var(--accent-b))', color:'#041414', fontWeight:700 }}
              >
                Log on-chain
              </button>
              <button
                onClick={() => pushToast('Skipped on-chain logging')}
                style={{ padding: '6px 10px', borderRadius: 8, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(255,255,255,0.03)', color: 'var(--muted)' }}
              >
                Skip
              </button>
            </div>
          )}
        </div>
      );
    }

    if (m.text === '__STRUCTURED_INSIGHT__') {
      const data = structuredCards.get(m.id);
      if (!data) return null;
      const insight = data.insight;
      return (
        <div style={{border:'1px solid rgba(255,255,255,0.03)', padding:12, borderRadius:12, maxWidth:720, marginTop:8}}>
          <div style={{fontWeight:800}}>Insight</div>
          <div style={{marginTop:8}}>{insight?.answer ?? ''}</div>
          <div style={{marginTop:12, display:'flex', gap:8}}>
            <button
              onClick={() => confirmAndWriteInsight(insight?.query ?? 'AI insight', insight?.answer ?? '')}
              style={{ padding: '6px 10px', borderRadius: 8, cursor: 'pointer', background: 'linear-gradient(90deg,var(--accent-a),var(--accent-b))', color:'#041414', fontWeight:700 }}
            >
              Log on-chain
            </button>
            <button
              onClick={() => pushToast('Skipped on-chain logging')}
              style={{ padding: '6px 10px', borderRadius: 8, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(255,255,255,0.03)', color: 'var(--muted)' }}
            >
              Skip
            </button>
          </div>
        </div>
      );
    }

    return <pre style={{whiteSpace:'pre-wrap', margin:0}}>{m.text}</pre>;
  }

  const handleSuggestionClick = (s: string) => {
    setInput(s);
    pushToast('Suggestion added to input');
  };

  return (
    <div className="chat-mock" aria-live="polite">
      <div className="divider" aria-hidden />

      <div style={{display:'flex', gap:18}}>
        <div className="avatar-col" aria-hidden>
          <div className="avatar-ring"><div className="avatar-inner"/></div>
        </div>

        <div className="content-col">
          <div>
            {messages.map(m => (
              <div key={m.id} style={{display:'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginTop:12}}>
                <div className={`msg ${m.role}`} style={{maxWidth: '86%'}}>
                  {renderMessageContent(m)}
                </div>
              </div>
            ))}

            {isTyping && (
              <div style={{display:'flex', justifyContent:'flex-start', marginTop:8}}>
                <div className="msg assistant" aria-live="polite" style={{display:'inline-flex', alignItems:'center', gap:8}}>
                  <div style={{width:8,height:8,borderRadius:999, background:'#cbd5e1', animation:'bounce 900ms infinite'}} />
                  <div style={{width:8,height:8,borderRadius:999, background:'#cbd5e1', animation:'bounce 900ms infinite', animationDelay:'120ms'}} />
                  <div style={{width:8,height:8,borderRadius:999, background:'#cbd5e1', animation:'bounce 900ms infinite', animationDelay:'240ms'}} />
                </div>
              </div>
            )}
          </div>

          <div className="suggestions" style={{marginTop:14}}>
            {suggestions.map(s => <div key={s} className="suggestion" onClick={()=> handleSuggestionClick(s)}>{s}</div>)}
          </div>

          <div className="input-row" style={{marginTop:6}}>
            <div className="command-bar" style={{flex:1}}>
              <input placeholder="Write a message — press Enter to send" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{ if(e.key === 'Enter'){ e.preventDefault(); sendMessage(input); } }} />
            </div>
            <button className="send-inline" onClick={()=> sendMessage(input)}>Send</button>
          </div>
        </div>
      </div>

      <div ref={containerRef} style={{height:0, width:0}} />
    </div>
  );
}
