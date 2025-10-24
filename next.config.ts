import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize Remotion packages - they'll load their own dependencies at runtime
      config.externals = config.externals || [];
      config.externals.push({
        '@remotion/bundler': 'commonjs @remotion/bundler',
        '@remotion/renderer': 'commonjs @remotion/renderer',
        '@remotion/lambda': 'commonjs @remotion/lambda',
        '@remotion/tailwind-v4': 'commonjs @remotion/tailwind-v4',
        'esbuild': 'commonjs esbuild',
        // Don't externalize webpack loaders - they need to be available
        'style-loader': 'commonjs style-loader',
        'css-loader': 'commonjs css-loader',
        'postcss-loader': 'commonjs postcss-loader',
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
