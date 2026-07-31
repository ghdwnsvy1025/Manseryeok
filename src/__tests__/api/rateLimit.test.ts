import { checkRateLimit } from "@/lib/api/rateLimit";

describe("checkRateLimit", () => {
  it("allows under the limit then blocks", () => {
    const key = `test-${Date.now()}-${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit({ key, limit: 3, windowMs: 60_000 }).ok).toBe(true);
    }
    const blocked = checkRateLimit({ key, limit: 3, windowMs: 60_000 });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.response.status).toBe(429);
    }
  });
});
