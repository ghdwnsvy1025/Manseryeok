import {
  buildNatalReadingMaterialsFromInput,
  natalReadingInputHash,
} from "@/lib/saju/reading/natalMaterials";
import { generateNatalReading } from "@/lib/saju/reading/generateNatalReading";

describe("natal reading materials", () => {
  it("builds 기축 chart for 1995-10-25 13:57 male", () => {
    const materials = buildNatalReadingMaterialsFromInput({
      year: 1995,
      month: 10,
      day: 25,
      hour: 13,
      minute: 57,
      gender: "male",
      options: {
        calendarType: "solar",
        timezone: "Asia/Seoul",
        dayChangeRule: "midnight",
        timeCorrection: "none",
        location: { name: "서울", longitude: 126.98, latitude: 37.57 },
      },
    });

    expect(materials.dayMaster.hanja).toBe("己");
    expect(materials.pillars.day.ganjiKo).toBe("기축");
    expect(materials.pillars.year.ganjiKo).toBe("을해");
    expect(materials.pillars.month.ganjiKo).toBe("병술");
    expect(materials.pillars.hour?.ganjiKo).toBe("신미");
    expect(materials.daeun.cycles.length).toBeGreaterThan(0);
  });

  it("hashes birth inputs stably", () => {
    const a = natalReadingInputHash({
      birthDate: "1995-10-25",
      birthHour: 13,
      birthMinute: 57,
      gender: "male",
      calculationVersion: "0.1.0",
    });
    const b = natalReadingInputHash({
      birthDate: "1995-10-25",
      birthHour: 13,
      birthMinute: 57,
      gender: "male",
      calculationVersion: "0.1.0",
    });
    const c = natalReadingInputHash({
      birthDate: "1995-10-25",
      birthHour: 14,
      birthMinute: 57,
      gender: "male",
      calculationVersion: "0.1.0",
    });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("skipLlm returns structured fallback with all sections", async () => {
    const materials = buildNatalReadingMaterialsFromInput({
      year: 1995,
      month: 10,
      day: 25,
      hour: 13,
      minute: 57,
      gender: "male",
      options: {
        calendarType: "solar",
        timezone: "Asia/Seoul",
        dayChangeRule: "midnight",
        timeCorrection: "none",
      },
    });
    const reading = await generateNatalReading(materials, { skipLlm: true });
    expect(reading.version).toBe("natal-v1");
    expect(reading.overview.longForm.length).toBeGreaterThan(10);
    expect(reading.domains.work.title).toBeTruthy();
    expect(reading.daeun.narrative.length).toBeGreaterThan(5);
    expect(reading.growthFormula.length).toBeGreaterThan(0);
  });
});
