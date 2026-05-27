/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // No rewrites here: the Vercel deployment serves /api/* from this same
  // Next.js app (route handlers). For local Express-backend testing, the
  // frontend's api.ts uses NEXT_PUBLIC_API_URL directly.
};

module.exports = nextConfig;
