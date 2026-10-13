import React, { useState } from "react";
import { Disc3Icon, PlusIcon, PencilIcon, Trash2Icon, MusicIcon, XIcon, Loader2Icon } from "lucide-react";
import { Album, AlbumInput } from "../../types/album";
import { Track } from "../../types/track";
import { FileUpload } from "./FileUpload";
import { Field } from "./Field";
import { toast } from "sonner";
import { errorMessage } from "../../utils/api";

interface AlbumManagerProps {
  albums: Album[];
  tracks: Track[];
  onSave: (album: AlbumInput, id?: string) => Promise<Album>;
  onDelete: (id: string) => Promise<void>;
}

export function AlbumManager({ albums, tracks, onSave, onDelete }: AlbumManagerProps) {
  const [editing, setEditing] = useState<Album | null | "new">(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const getTracksOfAlbum = (album: Album) => {
    return tracks.filter((t) => t.albumId === album.id || t.album === album.title);
  };

  const handleDelete = async (album: Album) => {
    const trackCount = getTracksOfAlbum(album).length;
    const confirmMsg = trackCount > 0 
      ? `Album "${album.title}" đang có ${trackCount} bài hát. Xóa album thì các bài này sẽ chuyển thành bài lẻ (Single). Bạn có chắc muốn xóa?`
      : `Bạn có chắc muốn xóa album "${album.title}"?`;
    
    if (!window.confirm(confirmMsg)) return;
    
    setDeletingId(album.id);
    try {
      await onDelete(album.id);
      toast.success("Đã xóa album");
    } catch (err) {
      toast.error(errorMessage(err, "Xóa thất bại."));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Quản lý Album</h2>
          <p className="text-sm text-white/50">Tạo album để gom nhiều bài hát vào cùng một dự án / đĩa nhạc.</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition-transform duration-150 hover:scale-105 active:scale-95 self-start sm:self-auto">
          <PlusIcon className="h-4 w-4" aria-hidden />
          Tạo Album mới
        </button>
      </div>

      {albums.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 py-16 text-center">
          <Disc3Icon className="h-12 w-12 text-white/20" aria-hidden />
          <p className="mt-4 text-base font-medium text-white/80">Chưa có album nào</p>
          <p className="mt-1 text-sm text-white/40">Bấm "Tạo Album mới" để phát hành đĩa nhạc đầu tiên.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {albums.map((album) => {
            const albumTracks = getTracksOfAlbum(album);
            return (
              <div
                key={album.id}
                className="group relative flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-4 transition-all duration-200 hover:border-white/20 hover:bg-white/[0.05]">
                <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black/40">
                  <img src={album.cover} alt={album.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white/90 backdrop-blur">
                    {album.releaseYear || new Date().getFullYear()}
                  </span>
                </div>

                <div className="mt-3 flex-1">
                  <h3 className="truncate text-base font-semibold text-white">{album.title}</h3>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-white/50">
                    <MusicIcon className="h-3.5 w-3.5" />
                    <span>{albumTracks.length} bài hát</span>
                  </p>
                  {album.description && (
                    <p className="mt-2 line-clamp-2 text-xs text-white/60">{album.description}</p>
                  )}
                </div>

                {albumTracks.length > 0 && (
                  <div className="mt-3 rounded-xl bg-white/[0.03] p-2">
                    <p className="text-[11px] font-medium text-white/40 mb-1">Các bài trong album:</p>
                    <ul className="space-y-1">
                      {albumTracks.slice(0, 3).map((t) => (
                        <li key={t.id} className="truncate text-xs text-white/70">
                          • {t.title}
                        </li>
                      ))}
                      {albumTracks.length > 3 && (
                        <li className="text-[11px] text-white/40 italic">và {albumTracks.length - 3} bài khác...</li>
                      )}
                    </ul>
                  </div>
                )}

                <div className="mt-4 flex items-center justify-end gap-2 border-t border-white/5 pt-3">
                  <button
                    type="button"
                    onClick={() => setEditing(album)}
                    className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/20">
                    <PencilIcon className="h-3.5 w-3.5" />
                    Sửa
                  </button>
                  <button
                    type="button"
                    disabled={deletingId === album.id}
                    onClick={() => handleDelete(album)}
                    className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs text-white/50 transition-colors hover:text-red-400">
                    {deletingId === album.id ? (
                      <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2Icon className="h-3.5 w-3.5" />
                    )}
                    Xóa
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <AlbumEditorModal
          album={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={onSave}
        />
      )}
    </div>
  );
}

function AlbumEditorModal({
  album,
  onClose,
  onSave
}: {
  album: Album | null;
  onClose: () => void;
  onSave: (album: AlbumInput, id?: string) => Promise<Album>;
}) {
  const [cover, setCover] = useState<string | undefined>(album?.cover);
  const [title, setTitle] = useState(album?.title ?? "");
  const [releaseYear, setReleaseYear] = useState(album?.releaseYear ? String(album.releaseYear) : String(new Date().getFullYear()));
  const [description, setDescription] = useState(album?.description ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!cover) return setError("Vui lòng tải ảnh bìa cho album.");
    if (!title.trim()) return setError("Vui lòng nhập tên album.");

    setSaving(true);
    try {
      await onSave(
        {
          cover,
          title: title.trim(),
          releaseYear: Number(releaseYear) || new Date().getFullYear(),
          description: description.trim()
        },
        album?.id
      );
      toast.success(album ? "Đã lưu thay đổi album" : "Đã tạo album mới");
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Lưu album thất bại."));
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-xl bg-white/[0.06] px-3.5 py-2.5 text-sm text-white placeholder:text-white/35 ring-1 ring-inset ring-white/10 focus:outline-none focus:ring-2 focus:ring-white/40";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-[#121214] p-6 text-white shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <h3 className="text-lg font-semibold">{album ? "Sửa Album" : "Tạo Album mới"}</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white">
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <FileUpload
            kind="image"
            label="Ảnh bìa Album"
            value={cover}
            onChange={setCover}
            hint="Ảnh vuông tỉ lệ 1:1, tối thiểu 800×800px."
          />

          <Field label="Tên Album" htmlFor="alb-title">
            <input
              id="alb-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ví dụ: Red Velvet Nights"
              className={inputClass}
            />
          </Field>

          <Field label="Năm phát hành" htmlFor="alb-year">
            <input
              id="alb-year"
              inputMode="numeric"
              value={releaseYear}
              onChange={(e) => setReleaseYear(e.target.value.replace(/\D/g, ""))}
              placeholder="2026"
              className={inputClass}
            />
          </Field>

          <Field label="Mô tả / Lời giới thiệu (Tuỳ chọn)" htmlFor="alb-desc">
            <textarea
              id="alb-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Giới thiệu đôi nét về concept album này..."
              className={inputClass}
            />
          </Field>

          {error && <p className="text-xs text-ember font-medium">{error}</p>}

          <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-5 py-2 text-sm text-white/70 hover:text-white">
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-full bg-white px-6 py-2 text-sm font-semibold text-black transition-transform hover:scale-105 disabled:opacity-50">
              {saving && <Loader2Icon className="h-4 w-4 animate-spin" />}
              {album ? "Lưu thay đổi" : "Tạo Album"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
