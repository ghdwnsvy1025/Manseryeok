import type {
  AstrologyFeatureVectorRecord,
  AstrologyProfileRecord,
  AstrologySnapshotRecord,
  CalculationMode,
} from "./types";
import type { AstrologyStorage } from "./snapshot";

function keyOf(q: {
  userId: string | null;
  localDate: string;
  calculationMode: CalculationMode;
  calculationVersion: string;
  featureSchemaVersion: string;
}): string {
  return [
    q.userId ?? "local",
    q.localDate,
    q.calculationMode,
    q.calculationVersion,
    q.featureSchemaVersion,
  ].join("|");
}

/** 테스트·게스트용 인메모리 저장소 */
export class MemoryAstrologyStorage implements AstrologyStorage {
  profiles = new Map<string, AstrologyProfileRecord>();
  snapshots = new Map<string, AstrologySnapshotRecord>();
  vectors: AstrologyFeatureVectorRecord[] = [];

  async getProfileByUser(
    userId: string | null
  ): Promise<AstrologyProfileRecord | null> {
    const uid = userId ?? "local";
    return this.profiles.get(uid) ?? null;
  }

  async upsertProfile(
    profile: AstrologyProfileRecord
  ): Promise<AstrologyProfileRecord> {
    const uid = profile.userId ?? "local";
    this.profiles.set(uid, profile);
    return profile;
  }

  async findSnapshot(query: {
    userId: string | null;
    localDate: string;
    calculationMode: CalculationMode;
    calculationVersion: string;
    featureSchemaVersion: string;
  }): Promise<AstrologySnapshotRecord | null> {
    return this.snapshots.get(keyOf(query)) ?? null;
  }

  async insertSnapshot(
    snapshot: AstrologySnapshotRecord
  ): Promise<AstrologySnapshotRecord> {
    const k = keyOf({
      userId: snapshot.userId,
      localDate: snapshot.localDate,
      calculationMode: snapshot.calculationMode,
      calculationVersion: snapshot.calculationVersion,
      featureSchemaVersion: snapshot.featureSchemaVersion,
    });
    if (this.snapshots.has(k) && this.snapshots.get(k)!.status === "ready") {
      throw new Error("duplicate snapshot");
    }
    this.snapshots.set(k, snapshot);
    return snapshot;
  }

  async insertFeatureVector(
    vector: AstrologyFeatureVectorRecord
  ): Promise<AstrologyFeatureVectorRecord> {
    this.vectors.push(vector);
    return vector;
  }

  async listSnapshotsByUser(
    userId: string | null
  ): Promise<AstrologySnapshotRecord[]> {
    const uid = userId ?? "local";
    return Array.from(this.snapshots.values()).filter(
      (s) => (s.userId ?? "local") === uid
    );
  }
}
