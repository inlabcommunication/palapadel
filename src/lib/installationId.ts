const INSTALLATION_ID_KEY = "palapadel.installationId";

function randomId(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function getInstallationId(): string {
  const existing = localStorage.getItem(INSTALLATION_ID_KEY);
  if (existing && /^[a-zA-Z0-9_-]{16,96}$/.test(existing)) return existing;
  const id = randomId();
  localStorage.setItem(INSTALLATION_ID_KEY, id);
  return id;
}
