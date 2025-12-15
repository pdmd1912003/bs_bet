import { createCivicAuthPlugin } from "@civic/auth-web3/nextjs"
import type { NextConfig } from "next";

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true, // Ignore TypeScript errors during build
  },
  eslint: {
    ignoreDuringBuilds: true, // Ignore ESLint errors during build
  },
  compiler: {
    styledComponents: true,
  },
  experimental: {
    esmExternals: 'loose' as const,
  },
};

// Get Civic client ID from environment variables
const civicClientId = process.env.NEXT_PUBLIC_CIVIC_CLIENT_ID || "33614fbc-b837-4f44-a076-0eb2a669c7fa";

const withCivicAuth = createCivicAuthPlugin({
  clientId: civicClientId
});

export default withCivicAuth(nextConfig)