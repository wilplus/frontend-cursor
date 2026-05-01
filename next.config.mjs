/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow font optimization to fail gracefully
  optimizeFonts: true,
  async redirects() {
    return [
      // Browsers request /favicon.ico directly; redirect to the dynamic icon route.
      {
        source: "/favicon.ico",
        destination: "/icon",
        permanent: false,
      },
      // PLG pivot: permanently redirect legacy funnel URL to new root landing page
      {
        source: "/try/shaky-voice",
        destination: "/",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
