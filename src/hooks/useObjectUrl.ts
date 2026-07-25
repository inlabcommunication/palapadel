import { useEffect, useState } from "react";

/**
 * Crea un object URL per l'anteprima locale di un file selezionato (non ancora
 * caricato), e lo revoca automaticamente quando il file cambia o il componente si
 * smonta: evita perdite di memoria da URL.createObjectURL mai rilasciati.
 */
export function useObjectUrl(file: File | null) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!file) {
      setUrl("");
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);
  return url;
}
