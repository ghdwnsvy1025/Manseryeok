import { describe, expect, test } from "@jest/globals";
import { createDiaryEntry } from "@/lib/diary/createEntry";
import {
  planLocalImport,
  resolveConflicts,
} from "@/lib/diary/mergeLocalImport";

describe("planLocalImport / resolveConflicts", () => {
  test("원격에 없는 로컬 기록은 toUpload로 분류", () => {
    const local = [createDiaryEntry("2024-05-01", "로컬만", { happinessRating: 4 })];
    const plan = planLocalImport(local, []);
    expect(plan.toUpload).toHaveLength(1);
    expect(plan.conflicts).toHaveLength(0);
  });

  test("같은 날짜 다른 내용은 conflict", () => {
    const local = [
      createDiaryEntry("2024-05-01", "로컬 내용", {
        id: "local-1",
        happinessRating: 5,
      }),
    ];
    const remote = [
      createDiaryEntry("2024-05-01", "원격 내용", {
        id: "remote-1",
        happinessRating: 2,
      }),
    ];
    const plan = planLocalImport(local, remote);
    expect(plan.toUpload).toHaveLength(0);
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0].date).toBe("2024-05-01");
  });

  test("동일 내용·동일 시각은 충돌로 보지 않음", () => {
    const shared = createDiaryEntry("2024-05-01", "동일", {
      id: "same",
      happinessRating: 3,
    });
    const plan = planLocalImport([shared], [{ ...shared }]);
    expect(plan.toUpload).toHaveLength(0);
    expect(plan.conflicts).toHaveLength(0);
  });

  test("resolveConflicts는 사용자 선택을 반영", () => {
    const local = createDiaryEntry("2024-05-01", "로컬", {
      id: "l",
      happinessRating: 5,
    });
    const remote = createDiaryEntry("2024-05-01", "원격", {
      id: "r",
      happinessRating: 1,
    });
    const resolvedLocal = resolveConflicts(
      [{ date: "2024-05-01", local, remote }],
      { "2024-05-01": "local" }
    );
    expect(resolvedLocal[0].id).toBe("l");

    const resolvedRemote = resolveConflicts(
      [{ date: "2024-05-01", local, remote }],
      { "2024-05-01": "remote" }
    );
    expect(resolvedRemote[0].id).toBe("r");
  });
});
