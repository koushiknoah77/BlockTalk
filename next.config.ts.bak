// next.config.ts
// Ensure dotenv loads .env.local for dev environment
import 'dotenv/config';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // expose selected vars to client if needed:
  env: {
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000',
    // keep secret keys out of NEXT_PUBLIC_ unless you really need them in client
  },
};

export default nextConfig;
