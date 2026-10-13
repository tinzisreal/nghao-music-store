import { Track } from "../types/track";
import { Producer } from "../types/store";

// Mock data — used only while API_BASE_URL in utils/api.ts is empty.
export const producer: Producer = {
  name: "Nghao",
  tagline: { vi: "Producer · Hà Nội", en: "Producer · Hanoi" },
  photo: "/image.png",
  bio: {
    vi: "Chào mừng bạn đến với website của mình. Mình là producer đến từ Hà Nội — hãy nghe thử các bản demo và ủng hộ mình bằng cách mua bản đầy đủ nhé.",
    en: "Welcome to my website. I'm a music producer from Hanoi; please check out the demos and support me by purchasing the full versions."
  }
};

const covers = {
  velvet: "/93a1c955-3e8d-4a84-a10d-f99ec875fe2d.jpg",
  mono: "/b347f119-d638-4cc4-9d2b-02453a26f014.jpg",
  silk: "/eefac02a-880c-4f17-810d-559cc373fc51.jpg",
  city: "/53e9384c-2c31-4014-a2b5-8611598e3040.jpg",
  teal: "/c4bc4fcc-85de-4bee-952c-10b16c1d75b5.jpg"
};

export const tracks: Track[] = [
{ id: "t1", title: "Midnight Ember", artist: producer.name, album: "Red Velvet Nights", genre: "R&B", cover: covers.velvet, duration: 214, price: 29000 },
{ id: "t2", title: "Paper Moon", artist: producer.name, album: "Monochrome", genre: "Soul", cover: covers.mono, duration: 236, price: 25000 },
{ id: "t3", title: "Satin Hours", artist: producer.name, album: "Silk Theory", genre: "Pop", cover: covers.silk, duration: 198, price: 25000 },
{ id: "t4", title: "Streetlight Drive", artist: producer.name, album: "After Hours City", genre: "Synthwave", cover: covers.city, duration: 251, price: 32000 },
{ id: "t5", title: "Cold Blooded", artist: producer.name, album: "Teal Shadows", genre: "Hip-hop", cover: covers.teal, duration: 187, price: 29000 },
{ id: "t6", title: "Golden Smoke", artist: producer.name, album: "Red Velvet Nights", genre: "R&B", cover: covers.velvet, duration: 222, price: 29000, featured: true },
{ id: "t7", title: "Echoes in Grey", artist: producer.name, album: "Monochrome", genre: "Soul", cover: covers.mono, duration: 263, price: 25000 },
{ id: "t8", title: "Silk Road", artist: producer.name, album: "Silk Theory", genre: "Pop", cover: covers.silk, duration: 205, price: 25000 },
{ id: "t9", title: "Neon Rain", artist: producer.name, album: "After Hours City", genre: "Synthwave", cover: covers.city, duration: 244, price: 32000, featured: true },
{ id: "t10", title: "Undertow", artist: producer.name, album: "Teal Shadows", genre: "Hip-hop", cover: covers.teal, duration: 176, price: 29000 },
{ id: "t11", title: "Last Call", artist: producer.name, album: "Red Velvet Nights", genre: "R&B", cover: covers.velvet, duration: 231, price: 29000, featured: true },
{ id: "t12", title: "Ivory Tape", artist: producer.name, album: "Monochrome", genre: "Soul", cover: covers.mono, duration: 219, price: 25000 },
{ id: "t13", title: "Glass Heart", artist: producer.name, album: "Silk Theory", genre: "Pop", cover: covers.silk, duration: 192, price: 25000, featured: true },
{ id: "t14", title: "Highway 7", artist: producer.name, album: "After Hours City", genre: "Synthwave", cover: covers.city, duration: 268, price: 32000 },
{ id: "t15", title: "Smoke Signals", artist: producer.name, album: "Teal Shadows", genre: "Hip-hop", cover: covers.teal, duration: 201, price: 29000, featured: true },
{ id: "t16", title: "Velvet Static", artist: producer.name, album: "Red Velvet Nights", genre: "R&B", cover: covers.velvet, duration: 239, price: 29000 }];