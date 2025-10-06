// app/page.tsx
'use client';
import React from "react";
import ChatWindow from "../components/ChatWindow";
import Dashboard from "../components/Dashboard";

export default function Page(){
  return (
    <main className="main-wrap">
      <section className="hero">
        <h1 className="hero-title">
          <span className="display">BlockTalk — <span className="gradient">Your AI Wallet Co-Pilot</span></span>
        </h1>
        <p className="hero-sub">Ask about transactions, gas, or portfolio PnL.</p>
      </section>

      {/* ChatWindow receives walletAddress from wagmi hooks internally if connected */}
      <section style={{width:'100%', marginTop:24}}>
        <ChatWindow />
      </section>

      {/* Dashboard — portfolio balances, PnL chart, recent tx */}
      <section style={{ width: '100%', marginTop: 24 }}>
        <Dashboard />
      </section>
    </main>
  );
}
