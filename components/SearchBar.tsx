'use client';
import React, { useRef, useState } from "react";

type Props = {
  onSend: (text:string)=>void;
  onStreamStart?: (id:string, query?: string)=>void;
  onStreamToken?: (id:string, token:string)=>void;
  onStreamDone?: (id:string)=>void;
};

export default function SearchBar({ onSend, onStreamStart, onStreamToken, onStreamDone }: Props){
  const inputRef = useRef<HTMLInputElement|null>(null);
  const [value, setValue] = useState("");

  React.useEffect(()=>{
    const handler = (e:KeyboardEvent) => {
      const active = document.activeElement;
      if(e.key === '/' && active && (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA')) {
        e.preventDefault(); inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return ()=>document.removeEventListener('keydown', handler);
  },[]);

  const send = () => {
    const t = value.trim();
    if(!t) return;
    setValue('');
    // Inform parent that a stream is starting (parent/ChatWindow may actually do the streaming)
    const streamId = crypto?.randomUUID?.() ?? String(Date.now());
    onStreamStart?.(streamId, t);
    try {
      onSend(t);
    } finally {
      // We don't stream here; parent should call onStreamToken / onStreamDone as it receives tokens.
      // Mark stream done immediately so UI doesn't hang when SearchBar is used alone.
      onStreamDone?.(streamId);
    }
  };

  return (
    <div className="search-pill" role="search" aria-label="Ask BlockTalk">
      <div className="search-badge" aria-hidden>Ask</div>
      <input ref={inputRef} className="search-input" value={value} onChange={(e)=>setValue(e.target.value)} placeholder='Ask BlockTalk — try: "How much gas did I spend this week?"' onKeyDown={(e)=>{ if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); send(); } }} />
      <button className="search-cta" onClick={send}>Ask</button>
    </div>
  );
}
