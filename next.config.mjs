/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow font optimization to fail gracefully
  optimizeFonts: true,
  webpack: (config) => {
    // pdfjs-dist (slide-deck rendering) optionally requires Node's `canvas`;
    // the browser build never uses it, so stub it so webpack doesn't try to
    // bundle a native module. Standard pdfjs-in-Next guard.
    config.resolve.alias = { ...config.resolve.alias, canvas: false };
    return config;
  },
  async redirects() {
    return [
      // Browsers request /favicon.ico directly; redirect to the dynamic icon route.
      {
        source: "/favicon.ico",
        destination: "/icon",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
