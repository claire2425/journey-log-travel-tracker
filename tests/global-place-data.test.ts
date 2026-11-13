import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type GeneratedPlace = {
  aliases: string[];
  code: string;
  name_en: string;
  name_zh: string;
};

async function readData(name: string): Promise<GeneratedPlace[]> {
  const path = join(process.cwd(), "public", "reference-data", name);
  return JSON.parse(await readFile(path, "utf8")) as GeneratedPlace[];
}

describe("bundled global place data", () => {
  it("includes the requested worldwide airport codes and Chinese aliases", async () => {
    const airports = await readData("global-airports.json");
    const tsa = airports.find((place) => place.code === "TSA");
    const hnd = airports.find((place) => place.code === "HND");

    expect(tsa).toMatchObject({ name_zh: "臺北松山機場" });
    expect(tsa?.aliases).toContain("台北松山機場");
    expect(hnd).toMatchObject({ name_en: "Tokyo Haneda International Airport", name_zh: "羽田機場" });
    expect(hnd?.aliases).toContain("東京羽田機場");
  });

  it("includes the global station index and common translated station aliases", async () => {
    const stations = await readData("global-stations.json");
    const tokyo = stations.find((place) => place.aliases.includes("Tokyo Station"));

    expect(stations.length).toBeGreaterThan(70_000);
    expect(tokyo?.aliases).toContain("東京駅");
  });

  it("never shows a Chinese name glued to a Latin place name", async () => {
    const places = [...await readData("global-airports.json"), ...await readData("global-stations.json")];
    const malformed = places.filter((place) => /[\u3400-\u9fff]/.test(place.name_zh) && /[a-z]/.test(place.name_zh));
    expect(malformed.map((place) => `${place.code} ${place.name_zh}`)).toEqual([]);
    expect(places.find((place) => place.code === "TPE")?.name_zh).toBe("臺灣桃園國際機場");
  });
});
