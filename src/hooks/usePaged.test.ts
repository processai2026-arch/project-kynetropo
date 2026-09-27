import { describe, expect, it } from "vitest";
import { slicePage } from "@/hooks/usePaged";

const items = Array.from({ length: 23 }, (_, i) => i + 1); // 1 = oldest, 23 = newest

describe("slicePage", () => {
  it("pages from the start: the last page takes the remainder", () => {
    expect(slicePage(items, 1, 10)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(slicePage(items, 3, 10)).toEqual([21, 22, 23]);
  });

  it("pages from the end: the newest page is full, the oldest takes the remainder", () => {
    expect(slicePage(items, 3, 10, true)).toEqual([14, 15, 16, 17, 18, 19, 20, 21, 22, 23]);
    expect(slicePage(items, 2, 10, true)).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(slicePage(items, 1, 10, true)).toEqual([1, 2, 3]);
  });

  it("keeps an out-of-range page inside the list", () => {
    expect(slicePage(items, 9, 10)).toEqual([21, 22, 23]);
    expect(slicePage(items, 0, 10)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(slicePage([], 1, 10)).toEqual([]);
  });

  it("shows a short list whole", () => {
    expect(slicePage([1, 2, 3], 1, 10, true)).toEqual([1, 2, 3]);
  });
});
