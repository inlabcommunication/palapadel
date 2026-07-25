import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Loader2, Maximize2, RefreshCw, Trash2, UploadCloud, X } from "lucide-react";
import { assertValidImageFile, formatImageFileSize, StorageImageError } from "../lib/storageImageUpload";

interface ImageUploadFieldProps {
  label: string;
  currentUrl?: string | null;
  currentAlt?: string;
  selectedFile: File | null;
  loading?: boolean;
  error?: string | null;
  uploadLabel?: string;
  replaceLabel?: string;
  removeLabel?: string;
  onFileChange: (file: File | null) => void;
  onRemoveImage?: () => void;
}

export function ImageUploadField({
  label,
  currentUrl,
  currentAlt = "",
  selectedFile,
  loading = false,
  error,
  uploadLabel = "Carica immagine",
  replaceLabel = "Sostituisci immagine",
  removeLabel = "Elimina immagine",
  onFileChange,
  onRemoveImage,
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedFile) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  const previewUrl = objectUrl || currentUrl || "";
  const hasImage = Boolean(previewUrl);
  const displayError = error || localError;
  const actionLabel = hasImage ? replaceLabel : uploadLabel;
  const fileInfo = useMemo(() => {
    if (!selectedFile) return currentUrl ? "Immagine salvata" : "Nessuna immagine selezionata";
    return `${selectedFile.name} - ${formatImageFileSize(selectedFile.size)}`;
  }, [currentUrl, selectedFile]);

  const pickFile = (file: File | null) => {
    if (!file) return;
    try {
      assertValidImageFile(file);
      setLocalError(null);
      onFileChange(file);
    } catch (err) {
      const message = err instanceof StorageImageError ? err.message : "Impossibile leggere l'immagine selezionata.";
      setLocalError(message);
      onFileChange(null);
    }
  };

  const clearOrRemove = () => {
    setLocalError(null);
    if (selectedFile) {
      onFileChange(null);
      return;
    }
    onRemoveImage?.();
  };

  return (
    <div className="rounded-xl border border-[rgba(251,243,222,0.12)] bg-[rgba(251,243,222,0.035)] p-3.5">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-[12.5px] font-bold text-[#FBF3DE]">{label}</p>
        {loading && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#BBFF5E]">
            <Loader2 size={13} className="animate-spin" /> Caricamento
          </span>
        )}
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          pickFile(event.dataTransfer.files?.[0] ?? null);
        }}
        className={`relative overflow-hidden rounded-lg border border-dashed transition ${
          dragging ? "border-[#BBFF5E] bg-[rgba(187,255,94,0.10)]" : "border-[rgba(251,243,222,0.18)] bg-[#0A0B08]"
        }`}
      >
        {hasImage ? (
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="group block w-full text-left"
            disabled={loading}
            aria-label="Apri anteprima immagine"
          >
            <img src={previewUrl} alt={currentAlt} className="w-full aspect-video object-cover" />
            <span className="absolute right-2 top-2 rounded-full bg-black/55 p-1.5 text-[#FBF3DE] opacity-0 transition group-hover:opacity-100">
              <Maximize2 size={14} />
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full aspect-video flex-col items-center justify-center gap-2 text-[rgba(251,243,222,0.48)]"
            disabled={loading}
          >
            <UploadCloud size={28} className="text-[#BBFF5E]" />
            <span className="text-[12px] font-semibold">Trascina qui un'immagine o caricala dal dispositivo</span>
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-lime px-3 py-2 text-[12px] font-bold text-[#081208] disabled:opacity-50"
        >
          {hasImage ? <RefreshCw size={14} /> : <ImagePlus size={14} />}
          {actionLabel}
        </button>
        {hasImage && (
          <button
            type="button"
            onClick={clearOrRemove}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(255,107,107,0.36)] px-3 py-2 text-[12px] font-bold text-[#FF6B6B] disabled:opacity-50"
          >
            <Trash2 size={14} />
            {removeLabel}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={(event) => {
          pickFile(event.target.files?.[0] ?? null);
          event.currentTarget.value = "";
        }}
        className="hidden"
      />

      <p className="mt-2 text-[11px] text-[rgba(251,243,222,0.48)]">{fileInfo}</p>
      <p className="mt-1 text-[11px] text-[rgba(251,243,222,0.38)]">JPG, JPEG, PNG o WebP. Massimo 5 MB prima della compressione.</p>
      {displayError && <p className="mt-2 text-[12px] font-semibold text-[#FF6B6B]">{displayError}</p>}

      {previewOpen && previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setPreviewOpen(false)}>
          <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-[rgba(251,243,222,0.12)] bg-[#0A0B08]">
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-[#FBF3DE]"
              aria-label="Chiudi anteprima"
            >
              <X size={18} />
            </button>
            <img src={previewUrl} alt={currentAlt} className="max-h-[82vh] w-full object-contain" onClick={(event) => event.stopPropagation()} />
          </div>
        </div>
      )}
    </div>
  );
}
