import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize Remotion packages and their dependencies
      // These are server-side only and shouldn't be bundled by Next.js
      config.externals = config.externals || [];
      config.externals.push({
        '@remotion/bundler': 'commonjs @remotion/bundler',
        '@remotion/renderer': 'commonjs @remotion/renderer',
        '@remotion/lambda': 'commonjs @remotion/lambda',
        'esbuild': 'commonjs esbuild',
      });
    }
    return config;
  },
  // Disable Turbopack for now to use standard webpack
  // Turbopack has issues with native binaries
  experimental: {
    turbo: undefined,
  },
};

export default nextConfig;
