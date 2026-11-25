import { describe, expect, it } from "vitest";
import { chunkChat, formatNotes } from "../notes";

describe("two-stage read helpers", () => {
  it("splits on line boundaries under the token limit and keeps every line", () => {
    const lines = Array.from({ length: 500 }, (_, i) => `1.6.24 09:${String(i % 60).padStart(2, "0")}|אמא|הודעה מספר ${i} עם קצת טקסט`);
    const chunks = chunkChat(lines.join("\n"), 1_000);
    expect(chunks.length).toBeGreaterThan(5);
    expect(chunks.join("\n").split("\n")).toEqual(lines);
  });
  it("formats notes for the writer", () => {
    const out = formatNotes([{ period: "6.2024", summary: "s", dynamics: ["d"], moments: [{ when: "1.6", who: "אמא", what: "w" }], running_jokes: [], quotes: [{ author: "אמא", text: "בוקר טוב", why: "w" }] }]);
    expect(out).toContain("## Part 1 · 6.2024");
    expect(out).toContain('אמא: "בוקר טוב"');
    expect(out).not.toContain("Running jokes");
  });
});
