import React, { useRef, useState } from "react";
import { ImageIcon, Loader2Icon, MusicIcon, UploadIcon } from "lucide-react";
import { api, errorMessage } from "../../utils/api";

interface FileUploadProps {
  kind: "image" | "audio";
  label: string;
  value?: string;
  onChange: (url: string | undefined) => void;
  onAudioDuration?: (seconds: number) => void;
  error?: string;
  hint?: string;
}

const LIMITS = { image: 5, audio: 50 }; // MB

export function FileUpload({ kind, label, value, onChange, onAudioDuration, error, hint }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState("");

  const handleFile = async (file: File) => {
    setUploadError("");
    if (!file.type.startsWith(`${kind}/`)) {
      setUploadError(kind === "image" ? "Vui lòng chọn file ảnh (JPG, PNG, WEBP)." : "Vui lòng chọn file âm thanh (MP3, WAV).");
      return;
    }
    if (file.size > LIMITS[kind] * 1024 * 1024) {
      setUploadError(`File tối đa ${LIMITS[kind]}MB.`);
      return;
    }
    if (kind === "audio" && onAudioDuration) readDuration(file, onAudioDuration);

    setUploading(true);
    try {
      const { url } = await api.uploadFile(file, kind);
      setFileName(file.name);
      onChange(url);
    } catch (err) {
      setUploadError(errorMessage(err, "Tải file lên thất bại. Thử lại nhé."));
    } finally {
      setUploading(false);
    }
  };

  const pick = () => inputRef.current?.click();
  const shownError = uploadError || error;

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-white/80">{label}</p>
      <input
        ref={inputRef}
        type="file"
        accept={kind === "image" ? "image/*" : "audio/*"}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }} />
      

      {value && !uploading ?
      <div className="flex items-center gap-4 rounded-2xl bg-white/[0.04] p-3 ring-1 ring-inset ring-white/10">
          {kind === "image" ?
        <img src={value} alt="Xem trước" className="h-24 w-24 shrink-0 rounded-xl object-cover" /> :

        <div className="min-w-0 flex-1">
              <p className="mb-2 flex items-center gap-2 truncate text-sm text-white/80">
                <MusicIcon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="truncate">{fileName || "File hiện tại"}</span>
              </p>
              <audio src={value} controls className="h-9 w-full" />
            </div>
        }
          <div className={`flex gap-2 ${kind === "image" ? "flex-col" : "shrink-0 flex-col"}`}>
            <button
            type="button"
            onClick={pick}
            className="rounded-full bg-white/10 px-3.5 py-1.5 text-sm text-white transition-colors duration-150 hover:bg-white/20">
            
              Đổi file
            </button>
            <button
            type="button"
            onClick={() => {
              onChange(undefined);
              setFileName("");
            }}
            className="rounded-full px-3.5 py-1.5 text-sm text-white/60 transition-colors duration-150 hover:text-ember">
            
              Xoá
            </button>
          </div>
        </div> :

      <button
        type="button"
        onClick={pick}
        disabled={uploading}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-8 text-center transition-colors duration-150 ${
        dragging ? "border-white/60 bg-white/10" : "border-white/20 bg-white/[0.03] hover:border-white/40 hover:bg-white/[0.06]"} ${
        shownError ? "border-ember/60" : ""}`}>
        
          {uploading ?
        <>
              <Loader2Icon className="h-6 w-6 animate-spin text-white/70" aria-hidden />
              <span className="text-sm text-white/70">Đang tải lên…</span>
            </> :

        <>
              {kind === "image" ?
          <ImageIcon className="h-6 w-6 text-white/50" aria-hidden /> :

          <UploadIcon className="h-6 w-6 text-white/50" aria-hidden />
          }
              <span className="text-sm text-white">
                Kéo thả hoặc <span className="underline underline-offset-2">chọn file</span>
              </span>
              <span className="text-xs text-white/45">
                {kind === "image" ? `JPG, PNG, WEBP · tối đa ${LIMITS.image}MB` : `MP3, WAV · tối đa ${LIMITS.audio}MB`}
              </span>
            </>
        }
        </button>
      }

      {shownError ?
      <p className="mt-1.5 text-xs text-ember" role="alert">
          {shownError}
        </p> :
      hint ?
      <p className="mt-1.5 text-xs text-white/45">{hint}</p> :
      null}
    </div>);

}

function readDuration(file: File, cb: (s: number) => void) {
  const url = URL.createObjectURL(file);
  const audio = new Audio();
  audio.preload = "metadata";
  audio.onloadedmetadata = () => {
    if (Number.isFinite(audio.duration)) cb(Math.round(audio.duration));
    URL.revokeObjectURL(url);
  };
  audio.onerror = () => URL.revokeObjectURL(url);
  audio.src = url;
}