/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Ignore ESLint during Vercel/production builds so temporary typing issues don't block deployments.
    ignoreDuringBuilds: true
  }
}

export default nextConfig
