// components/Toast.tsx
'use client';
import React, { useEffect, useState } from 'react';

type ToastMessage = { id: string; text: string; duration?: number };

let globalPush: ((msg: ToastMessage) => void) | null = null;

/**
 * pushToast(text, durationMs?)
 * Small helper to show a toast from anywhere (imperative).
 * Usage: import { pushToast } from './Toast' then call pushToast('Copied!')
 */
export function pushToast(text: string, duration = 2000) {
  const id = String(Date.now()) + Math.random().toString(36).slice(2, 8);
  globalPush?.({ id, text, duration });
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    globalPush = (msg: ToastMessage) => {
      setToasts((s) => [...s, msg]);
      setTimeout(() => {
        setToasts((s) => s.filter((t) => t.id !== msg.id));
      }, msg.duration ?? 2000);
    };
    return () => {
      globalPush = null;
    };
  }, []);

  return (
    <div aria-live="polite" style={{ position: 'fixed', left: 18, bottom: 18, zIndex: 9999 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            style={{
              background: 'linear-gradient(90deg, rgba(110,231,215,0.08), rgba(192,132,252,0.06))',
              color: '#e6eef6',
              padding: '10px 12px',
              borderRadius: 10,
              boxShadow: '0 8px 20px rgba(0,0,0,0.5)',
              border: '1px solid rgba(255,255,255,0.04)',
              fontSize: 14,
              maxWidth: 320,
            }}
          >
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
