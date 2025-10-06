// components/NotificationBell.tsx
'use client';
import React, { useEffect, useRef, useState } from 'react';
import { pushToast } from './Toast';

const MOCK_NOTIFS = [
  { id: '1', title: 'DAO vote due tomorrow', body: 'Community vote for Treasury upgrade closes in 24h.' },
  { id: '2', title: 'Gas fee spike', body: 'Gas fees spiked 2x in the last hour.' },
  { id: '3', title: 'PnL up 5% this week', body: 'Your portfolio is up 5% vs last week.' },
];

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items] = useState(MOCK_NOTIFS);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const markAllRead = () => {
    pushToast('All notifications marked read');
    setOpen(false);
  };

  const openItem = (it: typeof MOCK_NOTIFS[number]) => {
    pushToast(`Opened: ${it.title}`);
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', alignItems: 'center', marginRight: 8 }}>
      <button
        className="notif-btn"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen(s => !s)}
        title="Notifications"
        style={{
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.03)',
          padding: '8px 10px',
          borderRadius: 10,
          cursor: 'pointer',
          color: 'var(--muted)',
        }}
      >
        <span aria-hidden style={{ fontSize: 16 }}>🔔</span>
        <span style={{
          display: 'inline-block',
          minWidth: 18,
          marginLeft: 8,
          padding: '2px 6px',
          borderRadius: 999,
          background: 'linear-gradient(90deg,var(--accent-a),var(--accent-b))',
          color: '#041414',
          fontWeight: 700,
          fontSize: 12
        }}>3</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          style={{
            position: 'absolute',
            right: 0,
            top: 46,
            minWidth: 280,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))',
            border: '1px solid rgba(255,255,255,0.03)',
            boxShadow: '0 12px 30px rgba(0,0,0,0.6)',
            padding: 10,
            borderRadius: 10,
            zIndex: 999
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontWeight: 700 }}>Notifications</div>
            <button onClick={markAllRead} style={{ fontSize: 12, color: 'var(--muted)', background: 'transparent', border: 0, cursor: 'pointer' }}>Mark all</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map(it => (
              <button
                key={it.id}
                onClick={() => openItem(it)}
                style={{
                  textAlign: 'left',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.02)',
                  padding: 8,
                  borderRadius: 8,
                  cursor: 'pointer',
                  color: '#e6eef6'
                }}
              >
                <div style={{ fontWeight: 700 }}>{it.title}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{it.body}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
