export const CEO_CANONICAL_HOST = "dev.willpowerlab.com";
export const CEO_ROOT_PATH = "/admin/ceo";

const CEO_SURFACE_PATHS = [CEO_ROOT_PATH, "/admin/users", "/admin/tokens"];
const CEO_API_PATHS = [
  "/api/v2/admin/ceo",
  "/api/v2/admin/users",
  "/api/v2/admin/tokens",
];

export type CeoHostRouteAction =
  | "allow"
  | "redirect-to-ceo"
  | "redirect-to-ceo-host"
  | "not-found";

export interface CeoHostRouteDecision {
  action: CeoHostRouteAction;
  isCeoHost: boolean;
}

export function ceoCanonicalUrl(currentUrl: string): URL {
  const destination = new URL(currentUrl);
  destination.protocol = "https:";
  destination.hostname = CEO_CANONICAL_HOST;
  destination.port = "";
  return destination;
}

function hostnameFromHeaders(
  hostHeader: string | null,
  forwardedHostHeader: string | null
): string {
  const forwardedHost = forwardedHostHeader?.split(",")[0]?.trim();
  const host = forwardedHost || hostHeader?.trim() || "";

  if (host.startsWith("[")) {
    return host.slice(1, host.indexOf("]")).toLowerCase();
  }

  return host.split(":")[0]?.toLowerCase() ?? "";
}

function isPathOrChild(pathname: string, root: string): boolean {
  return pathname === root || pathname.startsWith(`${root}/`);
}

function isLocalHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  );
}

function isAllowedOnCeoHost(pathname: string): boolean {
  if (CEO_SURFACE_PATHS.some((path) => isPathOrChild(pathname, path))) {
    return true;
  }
  if (CEO_API_PATHS.some((path) => isPathOrChild(pathname, path))) return true;
  if (pathname === "/api/v2/admin/whoami") return true;
  if (isPathOrChild(pathname, "/api/auth")) return true;
  if (isPathOrChild(pathname, "/auth")) return true;

  return [
    "/login",
    "/signup",
    "/reset-password",
    "/update-password",
    "/logged-out",
    "/icon",
    "/manifest.webmanifest",
  ].includes(pathname);
}

/**
 * Keep the CEO surface on its own hostname without turning hostname routing
 * into an authorization boundary. AdminGate and the backend's admin decorator
 * remain the security checks; this policy only controls which UI a host serves.
 */
export function decideCeoHostRoute({
  hostHeader,
  forwardedHostHeader,
  pathname,
}: {
  hostHeader: string | null;
  forwardedHostHeader: string | null;
  pathname: string;
}): CeoHostRouteDecision {
  const hostname = hostnameFromHeaders(hostHeader, forwardedHostHeader);

  // Local review must keep working with both `next dev` and `next start`.
  if (!hostname || isLocalHostname(hostname)) {
    return { action: "allow", isCeoHost: false };
  }

  if (hostname === CEO_CANONICAL_HOST) {
    if (pathname === "/") {
      return { action: "redirect-to-ceo", isCeoHost: true };
    }
    if (isAllowedOnCeoHost(pathname)) {
      return { action: "allow", isCeoHost: true };
    }
    if (isPathOrChild(pathname, "/api")) {
      return { action: "not-found", isCeoHost: true };
    }
    return { action: "redirect-to-ceo", isCeoHost: true };
  }

  if (CEO_SURFACE_PATHS.some((path) => isPathOrChild(pathname, path))) {
    return { action: "redirect-to-ceo-host", isCeoHost: false };
  }
  if (CEO_API_PATHS.some((path) => isPathOrChild(pathname, path))) {
    return { action: "not-found", isCeoHost: false };
  }

  return { action: "allow", isCeoHost: false };
}
