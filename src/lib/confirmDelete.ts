// Conferma nativa del browser prima di un'eliminazione definitiva.
// Centralizzata qui perché era duplicata identica in più file.
export function confirmDelete(label: string): boolean {
  return window.confirm(`Eliminare definitivamente "${label}"? L'operazione non si può annullare.`);
}
