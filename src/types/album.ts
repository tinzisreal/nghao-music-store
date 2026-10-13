export interface Album {
  id: string;
  title: string;
  artist: string;
  cover: string;
  releaseYear?: number;
  description?: string;
  createdAt?: string;
}

export type AlbumInput = Omit<Album, "id" | "artist" | "createdAt">;
