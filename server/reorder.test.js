import test from "node:test";
import assert from "node:assert/strict";

function reorderTracks(tracks, trackIds) {
  const existingMap = new Map((tracks || []).map((t) => [t.id, t]));
  const reordered = [];

  for (const id of trackIds) {
    if (existingMap.has(id)) {
      reordered.push(existingMap.get(id));
      existingMap.delete(id);
    }
  }

  // Bổ sung những bài còn lại nếu client chưa gửi hết
  for (const remaining of existingMap.values()) {
    reordered.push(remaining);
  }

  return reordered;
}

test("reorderTracks reorders tracks according to specified trackIds sequence", () => {
  const sampleTracks = [
    { id: "t1", title: "Track 1", price: 100 },
    { id: "t2", title: "Track 2", price: 200 },
    { id: "t3", title: "Track 3", price: 300 }
  ];

  const reordered = reorderTracks(sampleTracks, ["t3", "t1", "t2"]);
  assert.deepEqual(reordered.map((t) => t.id), ["t3", "t1", "t2"]);
  assert.equal(reordered[0].title, "Track 3");
  assert.equal(reordered[1].title, "Track 1");
  assert.equal(reordered[2].title, "Track 2");
});

test("reorderTracks retains unmentioned tracks at the end without data loss", () => {
  const sampleTracks = [
    { id: "t1", title: "Track 1" },
    { id: "t2", title: "Track 2" },
    { id: "t3", title: "Track 3" },
    { id: "t4", title: "Track 4" }
  ];

  const reordered = reorderTracks(sampleTracks, ["t3", "t2"]);
  assert.deepEqual(reordered.map((t) => t.id), ["t3", "t2", "t1", "t4"]);
});

test("reorderTracks ignores non-existent ids gracefully", () => {
  const sampleTracks = [
    { id: "t1", title: "Track 1" },
    { id: "t2", title: "Track 2" }
  ];

  const reordered = reorderTracks(sampleTracks, ["non_existent", "t2", "t1"]);
  assert.deepEqual(reordered.map((t) => t.id), ["t2", "t1"]);
});
