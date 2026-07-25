import { useState } from "react";
import { Download, Share2, X } from "lucide-react";
import { generateMatchdayShareImages, type MatchdayShareInput } from "../lib/matchdayShareImage";

export function MatchdayShareButton({ input, showToast }: { input: MatchdayShareInput; showToast: (message: string) => void }) {
  const [images, setImages] = useState<Awaited<ReturnType<typeof generateMatchdayShareImages>>>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(0);

  const generate = async () => {
    setOpen(true);
    setBusy(true);
    try {
      const result = await generateMatchdayShareImages(input);
      setImages(result);
      setSelected(0);
    } catch (error) {
      console.error(error);
      showToast("Errore nella generazione della giornata.");
    } finally {
      setBusy(false);
    }
  };

  const download = (index = selected) => {
    const image = images[index];
    if (!image) return;
    const url = URL.createObjectURL(image.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = image.filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 800);
  };

  const share = async () => {
    const image = images[selected];
    if (!image) return;
    const file = new File([image.blob], image.filename, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: `Giornata ${input.matchdayNumber} PalaPadel` });
    } else {
      download();
      showToast("Condivisione non supportata: PNG scaricato.");
    }
  };

  return (
    <>
      <button type="button" onClick={generate} disabled={busy} className="flex items-center gap-1.5 text-[12.5px] font-bold text-[#BBFF5E] disabled:opacity-50">
        <Share2 size={15} /> {busy ? "Genero PNG..." : "Condividi giornata"}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg rounded-lg border border-[rgba(251,243,222,0.12)] bg-[#0A0B08] p-4" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <strong className="text-[13px] uppercase">Giornata pronta</strong>
              <button aria-label="Chiudi" onClick={() => setOpen(false)} className="rounded-full bg-[rgba(251,243,222,0.08)] p-2"><X size={16} /></button>
            </div>
            {busy && <div className="mx-auto aspect-[9/16] max-h-[62dvh] bg-[#123008]" />}
            {!busy && images[selected] && (
              <>
                <img src={images[selected].dataUrl} alt={`Giornata ${input.matchdayNumber}`} className="mx-auto aspect-[9/16] max-h-[62dvh] w-auto max-w-full object-contain" />
                {images.length > 1 && <div className="mt-3 flex justify-center gap-2">{images.map((image, index) => <button key={image.filename} onClick={() => setSelected(index)} className={`h-8 min-w-8 rounded-full ${selected === index ? "bg-lime text-[#081208]" : "bg-[rgba(251,243,222,0.08)]"}`}>{image.page}</button>)}</div>}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button onClick={() => download()} className="flex items-center justify-center gap-2 rounded-lg bg-lime py-2.5 font-bold text-[#081208]"><Download size={16} /> Scarica</button>
                  <button onClick={share} className="flex items-center justify-center gap-2 rounded-lg border border-[rgba(251,243,222,0.18)] py-2.5 font-bold"><Share2 size={16} /> Condividi</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
