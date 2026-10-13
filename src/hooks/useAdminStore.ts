import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "../utils/api";
import { StoreData, Producer, StoreInfo, StoreSections } from "../types/store";
import { TrackInput } from "../types/track";
import { AlbumInput } from "../types/album";
import { StoreDataState } from "./useStoreData";

export function useAdminStore() {
  const [state, setState] = useState<StoreDataState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    api.
    getStoreData({ admin: true }).
    then((data) => !cancelled && setState({ status: "ready", data })).
    catch((err: unknown) => !cancelled && setState({ status: "error", error: errorMessage(err, "Không tải được dữ liệu.") }));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  const update = (fn: (d: StoreData) => StoreData) =>
  setState((s) => s.status === "ready" ? { status: "ready", data: fn(s.data) } : s);

  const saveTrack = useCallback(async (input: TrackInput, id?: string) => {
    const track = id ? await api.updateTrack(id, input) : await api.createTrack(input);
    update((d) => ({
      ...d,
      tracks: id ? d.tracks.map((t) => t.id === id ? track : t) : [track, ...d.tracks]
    }));
    return track;
  }, []);

  const patchTrack = useCallback(async (id: string, patch: Partial<TrackInput>) => {
    const track = await api.updateTrack(id, patch);
    update((d) => ({ ...d, tracks: d.tracks.map((t) => t.id === id ? track : t) }));
  }, []);

  const deleteTrack = useCallback(async (id: string) => {
    await api.deleteTrack(id);
    update((d) => ({
      ...d,
      tracks: d.tracks.filter((t) => t.id !== id),
      sections: {
        ...d.sections,
        newReleases: { ...d.sections.newReleases, trackIds: d.sections.newReleases.trackIds.filter((tid) => tid !== id) }
      }
    }));
  }, []);

  const reorderTracks = useCallback(async (trackIds: string[]) => {
    // Optimistic update local state first
    update((d) => {
      const map = new Map(d.tracks.map((t) => [t.id, t]));
      const reordered: Track[] = [];
      for (const id of trackIds) {
        const t = map.get(id);
        if (t) {
          reordered.push(t);
          map.delete(id);
        }
      }
      for (const t of map.values()) reordered.push(t);
      return { ...d, tracks: reordered };
    });
    const updated = await api.reorderTracks(trackIds);
    update((d) => ({ ...d, tracks: updated }));
    return updated;
  }, []);

  const saveSections = useCallback(async (sections: StoreSections) => {
    const saved = await api.updateSections(sections);
    update((d) => ({ ...d, sections: saved }));
  }, []);

  const saveProducer = useCallback(async (producer: Producer) => {
    const saved = await api.updateProducer(producer);
    update((d) => ({ ...d, producer: saved, tracks: d.tracks.map((t) => ({ ...t, artist: saved.name })) }));
  }, []);

  const saveInfo = useCallback(async (info: StoreInfo) => {
    const saved = await api.updateStoreInfo(info);
    update((d) => ({ ...d, info: saved }));
  }, []);

  const saveAlbum = useCallback(async (input: AlbumInput, id?: string) => {
    const album = id ? await api.updateAlbum(id, input) : await api.createAlbum(input);
    update((d) => ({
      ...d,
      albums: id ? (d.albums || []).map((a) => (a.id === id ? album : a)) : [album, ...(d.albums || [])],
      tracks: id && input.title ? d.tracks.map((t) => (t.albumId === id ? { ...t, album: input.title } : t)) : d.tracks
    }));
    return album;
  }, []);

  const deleteAlbum = useCallback(async (id: string) => {
    await api.deleteAlbum(id);
    update((d) => ({
      ...d,
      albums: (d.albums || []).filter((a) => a.id !== id),
      tracks: d.tracks.map((t) => (t.albumId === id ? { ...t, albumId: undefined, album: "Single" } : t))
    }));
  }, []);

  return { state, retry, saveTrack, patchTrack, deleteTrack, reorderTracks, saveAlbum, deleteAlbum, saveProducer, saveInfo, saveSections };
}