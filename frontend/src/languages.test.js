import { describe, expect, it } from "vitest";
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from "./languages";

describe("Eventure language catalogue", () => {
  it("offers English and all 22 Indian languages supported by Sarvam Translate", () => {
    expect(DEFAULT_LANGUAGE).toBe("en");
    expect(SUPPORTED_LANGUAGES).toHaveLength(23);
    expect(new Set(SUPPORTED_LANGUAGES.map((language) => language.code)).size).toBe(23);
    expect(SUPPORTED_LANGUAGES.map((language) => language.code)).toContain("hi-IN");
    expect(SUPPORTED_LANGUAGES.map((language) => language.code)).toContain("ur-IN");
    expect(SUPPORTED_LANGUAGES.map((language) => language.code)).toContain("sat-IN");
  });

  it("shows each language in its native script", () => {
    const hindi = SUPPORTED_LANGUAGES.find((language) => language.code === "hi-IN");
    const tamil = SUPPORTED_LANGUAGES.find((language) => language.code === "ta-IN");
    expect(hindi.label).toContain("हिन्दी");
    expect(tamil.label).toContain("தமிழ்");
  });
});
