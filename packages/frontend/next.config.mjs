/** @type {import('next').NextConfig} */
const nextConfig = {
  // Backend API URL für Server-seitige Requests
  env: {
    BACKEND_URL: process.env.BACKEND_URL ?? 'http://localhost:3001',
  },
  // Leaflet-Karten funktionieren nur Client-seitig
  webpack: (config) => {
    config.resolve.fallback = { fs: false };
    return config;
  },
};

export default nextConfig;
