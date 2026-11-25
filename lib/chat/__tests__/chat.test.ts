import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { computeStats, compressForLLM, parseWhatsApp } from "..";

const fx = (f: string) => readFileSync(path.join(__dirname, f), "utf8");

describe("parseWhatsApp + computeStats", () => {
  it("parses an iPhone Hebrew export: RLM lines, media, multi-line, system notices", () => {
    const res = parseWhatsApp(fx("fixture_ios_he.txt"));
    expect(res.format).toBe("ios");
    expect(res.groupName).toBe("החזנים מתרחבים");
    // 13 timestamped lines − 2 group-name notices − 1 U+202B notice = 10 messages (media + deleted still count)
    expect(res.messages).toHaveLength(10);
    expect(res.systemFiltered).toBe(3);

    const m = res.messages;
    expect(m.filter((x) => x.media === "image")).toHaveLength(2); // both LRM- and RLM-prefixed lines parsed
    expect(m.find((x) => x.media === "audio")?.sender).toBe("אמא");
    expect(m.find((x) => x.media === "sticker")?.sender).toBe("רעי");
    const multi = m.find((x) => x.sender === "דניאל קולט");
    expect(multi?.text).toBe("הודעה ראשונה\nשורה שנייה של אותה הודעה\nושורה שלישית"); // trimmed name, joined lines
    const edited = m.find((x) => x.edited);
    expect(edited?.text).toBe("בוקר טוב לכולם ❤️");
    expect(m.at(-1)?.deleted).toBe(true);

    const s = computeStats(m);
    expect(s.totals.messages).toBe(10);
    expect(s.share.all.map((p) => [p.name, p.count])).toEqual([
      ["שרית", 4], ["אמא", 3], ["רעי", 2], ["דניאל קולט", 1],
    ]);
    expect(s.share.all[0].pct).toBe(40);
    expect(s.voice.total).toBe(1);
    expect(s.goodMorning.days).toBe(2);
    expect(s.goodMorning.firstBy[0]).toMatchObject({ name: "אמא", count: 1 });
    // openers: first message, 13:30 after 3h20m silence, next morning
    expect(s.openers.total).toBe(3);
    expect(s.laugh.longest).toEqual({ sender: "שרית", length: 6 });
    expect(s.petNames.top.map((p) => p.term)).toEqual(expect.arrayContaining(["בובי", "מאמי"]));
    expect(s.emoji[0]).toEqual({ emoji: "😍", count: 2 });
    expect(s.peakDay).toEqual({ date: "2024-06-01", count: 6 });
    expect(s.streak.longestDays).toBe(2);

    const c = compressForLLM(m, 10_000);
    expect(c.text).toContain("[תמונה ×2]");
    expect(c.text).not.toContain("מחקת את ההודעה");
    expect(c.cutoff).toBeNull();
  });

  it("parses an Android English export", () => {
    const res = parseWhatsApp(fx("fixture_android_en.txt"));
    expect(res.format).toBe("android");
    expect(res.messages.map((x) => x.sender)).toEqual(["Tair", "Elhanan", "Tair"]);
    expect(res.messages[1].media).toBe("media");
    expect(res.messages[2].text).toBe("line one\nline two");
    expect(new Date(res.messages[2].ts).toISOString()).toBe("2024-06-13T22:15:00.000Z");
  });
});
