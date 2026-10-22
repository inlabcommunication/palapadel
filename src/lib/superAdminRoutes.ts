export function isSuperAdminWorkspacePath(pathname: string) {
  return (
    pathname === "/" ||
    pathname.startsWith("/gestione") ||
    pathname.startsWith("/campionati") ||
    pathname === "/albo" ||
    pathname === "/news" ||
    pathname === "/notifiche" ||
    pathname === "/analytics"
    || pathname === "/giornate"
    || pathname === "/utenti-impostazioni"
  );
}
