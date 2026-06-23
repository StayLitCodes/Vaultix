type RedirectTarget = {
  pathname: string;
  params?: Record<string, string>;
};

let pendingRedirect: RedirectTarget | null = null;

export function isAuthenticated() {
  return Boolean((global as Record<string, unknown>).__authToken);
}

export function requireAuth(
  router: { replace: (target: string | { pathname: string; params?: Record<string, string> }) => void },
  redirectTarget: RedirectTarget,
) {
  if (isAuthenticated()) {
    return true;
  }

  pendingRedirect = redirectTarget;
  router.replace('/');
  return false;
}

export function consumePendingRedirect(): RedirectTarget | null {
  const redirect = pendingRedirect;
  pendingRedirect = null;
  return redirect;
}
