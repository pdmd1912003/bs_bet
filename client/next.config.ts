// client/next.config. ts

// ❌ DELETE Civic import:
// import { createCivicAuthPlugin } from "@civic/auth-web3/nextjs"

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  compiler: {
    styledComponents: true,
  },
  experimental: {
    esmExternals: 'loose' as const,
  },
};

// ❌ DELETE these lines:
// const civicClientId = process.env.NEXT_PUBLIC_CIVIC_CLIENT_ID || "... ";
// const withCivicAuth = createCivicAuthPlugin({ clientId: civicClientId });
// export default withCivicAuth(nextConfig)

// ✅ REPLACE with:
export default nextConfig;