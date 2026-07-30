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
      // The Journal moved to /blog. Permanent so anything already shared (and
      // anything already indexed) keeps working and passes its ranking on.
      {
        source: "/journal",
        destination: "/blog",
        permanent: true,
      },
      {
        source: "/journal/:slug",
        destination: "/blog/:slug",
        permanent: true,
      },
      // /science is consolidated into the blog (founder 2026-07-30): the two
      // papers are now Journal posts in the "Science" category. Permanent so
      // indexed/shared links keep working and pass their ranking on.
      {
        source: "/science",
        destination: "/blog",
        permanent: true,
      },
      // The CMS moved off /admin. Kept out of nav either way.
      {
        source: "/admin/journal",
        destination: "/cms",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
