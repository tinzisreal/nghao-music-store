import { StoreSections } from "../types/store";

/** Max tracks allowed in the "Nổi bật" cover flow. */
export const MAX_FEATURED = 5;

// Mock data — used only while API_BASE_URL in utils/api.ts is empty.
export const sections: StoreSections = {
  newReleases: {
    title: { vi: "Mới phát hành", en: "New releases" },
    trackIds: ["t1", "t2", "t3", "t4", "t5"]
  }
};