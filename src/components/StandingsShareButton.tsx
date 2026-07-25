import { useState } from "react";
import { Download, Images, Share2, X } from "lucide-react";
import {
  generateStandingsShareImages,
  type GeneratedStandingsShareImage,
  type StandingsShareInput,
} from "../lib/standingsShareImage";
import { trackAnalyticsEvent } from "../lib/analyticsClient";

interface StandingsShareButtonProps {
  input: StandingsShareInput;
  showToast: (msg: string) => void;
}

function downloadImage(image: GeneratedStandingsShareImage) {
  const url = URL.createObjectURL(image.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = image.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 800);
}

export function StandingsShareButton({ input, showToast }: StandingsShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [images, setImages] = useState<GeneratedStandingsShareImage[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = images[selectedIndex];

  const openPreview = async () => {
    setOpen(true);
    if (images.length > 0) return;

    setGenerating(true);
    try {
      const generated = await generateStandingsShareImages(input);
      setImages(generated);
      setSelectedIndex(0);
      trackAnalyticsEvent("share_standings", {
        categoryName: input.categoryName,
        season: input.season,
        kind: input.kind,
        pageCount: generated.length,
      });
    } catch (err) {
      console.error(err);
      showToast("Errore nella generazione della classifica PNG.");
    } finally {
      setGenerating(false);
    }
  };

  const downloadAll = () => {
    images.forEach(downloadImage);
    showToast(images.length > 1 ? "PNG classifica scaricati." : "PNG classifica scaricato.");
  };

  const shareSelected = async () => {
    if (!selected) return;
    const file = new File([selected.blob], selected.filename, { type: "image/png" });
    const shareData: ShareData = {
      files: [file],
      title: "Classifica PalaPadel",
      text: `${input.categoryName} ${input.season}`,
    };

    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share(shareData);
        return;
      }
      downloadImage(selected);
      showToast("Condivisione non supportata: PNG scaricato.");
    } catch (err) {
      console.error(err);
      showToast("Condivisione annullata o non disponibile.");
    }
  };

  return (
    <>
      <button
        onClick={openPreview}
        disabled={generating}
        className="flex items-center gap-1.5 text-[13px] font-semibold text-[#BBFF5E] disabled:opacity-50"
        title="Condividi classifica"
      >
        <Share2 size={15} /> {generating ? "Genero PNG..." : "CONDIVIDI CLASSIFICA"}
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/70 p-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-lg bg-[#0A0B08] border border-[rgba(251,243,222,0.12)] rounded-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(251,243,222,0.08)]">
              <p className="text-[13px] font-extrabold uppercase tracking-wider text-[#FBF3DE]">Classifica pronta</p>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-full bg-[rgba(251,243,222,0.08)]">
                <X size={15} />
              </button>
            </div>

            <div className="p-4">
              {generating && (
                <div className="aspect-[9/16] max-h-[62dvh] rounded-lg bg-[#123008] flex items-center justify-center text-[12.5px] text-[rgba(251,243,222,0.58)]">
                  Generazione...
                </div>
              )}

              {!generating && selected && (
                <>
                  <img
                    src={selected.dataUrl}
                    alt={`Classifica ${input.categoryName} ${input.season}`}
                    className="mx-auto aspect-[9/16] max-h-[62dvh] w-auto max-w-full object-contain rounded-lg border border-[rgba(251,243,222,0.10)] bg-[#06140B]"
                  />

                  {images.length > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-3">
                      {images.map((image, index) => (
                        <button
                          key={image.filename}
                          onClick={() => setSelectedIndex(index)}
                          className={`h-8 min-w-8 rounded-full px-2 text-[12px] font-bold ${
                            index === selectedIndex
                              ? "bg-lime text-[#081208]"
                              : "bg-[rgba(251,243,222,0.08)] text-[rgba(251,243,222,0.72)]"
                          }`}
                        >
                          {image.page}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <button
                      onClick={downloadAll}
                      className="flex items-center justify-center gap-1.5 bg-lime text-[#081208] rounded-lg py-2.5 text-sm font-bold"
                    >
                      <Download size={16} /> Scarica
                    </button>
                    <button
                      onClick={shareSelected}
                      className="flex items-center justify-center gap-1.5 border border-[rgba(251,243,222,0.18)] rounded-lg py-2.5 text-sm font-semibold"
                    >
                      {images.length > 1 ? <Images size={16} /> : <Share2 size={16} />} Condividi
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
