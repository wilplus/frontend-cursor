/* THE SERVICE WORKER'S CACHE NAME, DERIVED (founder 2026-09-18).
 *
 * `public/sw.js` is a static file, so nothing in the build can interpolate
 * into it — which is why its cache name was a hand-bumped `-v6` constant, and
 * why a deploy that forgot to bump it left phones on the previous shell with
 * no visible cause. `activate` deletes every cache whose name is not the
 * current one, so the NAME is the only flush there is.
 *
 * The commit sha where a deploy provides one, else the build's own wall clock.
 * The fallback is not a nicety: a local `next build` has no sha, and a build
 * id that resolves to the literal string "undefined" is a constant again — the
 * exact failure this removes.
 */
const BUILD_ID =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || `local-${Date.now()}`;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },
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
