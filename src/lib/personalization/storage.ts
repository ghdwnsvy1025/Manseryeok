import type { PersonalizationModelRecord } from "./types";

export type PersonalizationStorage = {
  listByUser(userId: string): Promise<PersonalizationModelRecord[]>;
  getActive(
    userId: string,
    categoryKey: string
  ): Promise<PersonalizationModelRecord | null>;
  findByTrainingRunKey(
    trainingRunKey: string
  ): Promise<PersonalizationModelRecord | null>;
  insert(model: PersonalizationModelRecord): Promise<PersonalizationModelRecord>;
  deprecate(id: string, at: string): Promise<void>;
};

export class MemoryPersonalizationStorage implements PersonalizationStorage {
  models: PersonalizationModelRecord[] = [];

  async listByUser(userId: string): Promise<PersonalizationModelRecord[]> {
    return this.models.filter((m) => m.userId === userId);
  }

  async getActive(
    userId: string,
    categoryKey: string
  ): Promise<PersonalizationModelRecord | null> {
    const rows = this.models
      .filter(
        (m) =>
          m.userId === userId &&
          m.categoryKey === categoryKey &&
          !m.deprecatedAt
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return rows[0] ?? null;
  }

  async findByTrainingRunKey(
    trainingRunKey: string
  ): Promise<PersonalizationModelRecord | null> {
    return this.models.find((m) => m.trainingRunKey === trainingRunKey) ?? null;
  }

  async insert(
    model: PersonalizationModelRecord
  ): Promise<PersonalizationModelRecord> {
    if (this.models.some((m) => m.trainingRunKey === model.trainingRunKey)) {
      throw new Error("duplicate_training_run");
    }
    // deprecate previous active same user/category
    const now = model.createdAt;
    for (const m of this.models) {
      if (
        m.userId === model.userId &&
        m.categoryKey === model.categoryKey &&
        !m.deprecatedAt
      ) {
        m.deprecatedAt = now;
      }
    }
    this.models.push(model);
    return model;
  }

  async deprecate(id: string, at: string): Promise<void> {
    const m = this.models.find((x) => x.id === id);
    if (m) m.deprecatedAt = at;
  }
}

/** 멱등 학습: 동일 trainingRunKey면 재사용 */
export async function saveTrainingRun(
  storage: PersonalizationStorage,
  model: PersonalizationModelRecord
): Promise<{ model: PersonalizationModelRecord; reused: boolean }> {
  const existing = await storage.findByTrainingRunKey(model.trainingRunKey);
  if (existing) return { model: existing, reused: true };
  const saved = await storage.insert(model);
  return { model: saved, reused: false };
}

