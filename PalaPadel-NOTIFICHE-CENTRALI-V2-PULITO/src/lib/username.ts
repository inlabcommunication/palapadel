// Firebase Authentication (provider Email/Password) richiede sempre un indirizzo email
// per identificare un account. Per permettere il login con solo nome utente + password
// (senza chiedere una vera email), si genera una email "sintetica" a uso interno,
// mai mostrata né usata per inviare messaggi reali.
const SYNTHETIC_DOMAIN = "palapadel.app";

export function slugifyUsername(username: string) {
  return username
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // rimuove accenti
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function usernameToEmail(username: string) {
  const slug = slugifyUsername(username);
  return `${slug}@${SYNTHETIC_DOMAIN}`;
}
