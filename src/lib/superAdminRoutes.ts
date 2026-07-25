export function isSuperAdminWorkspacePath(pathname: string) {
  return (
    pathname === "/" ||
    pathname.startsWith("/gestione") ||
    pathname.startsWith("/campionati") ||
    pathname === "/albo" ||
    pathname === "/notifiche" ||
    pathname === "/analytics"
  );
}
