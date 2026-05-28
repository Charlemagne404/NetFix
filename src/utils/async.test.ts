import { describe, expect, it } from "vitest";
import { TimeoutError, withTimeout } from "./async";

describe("withTimeout", () => {
  it("resolves before the timeout expires", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 20, "timed out")).resolves.toBe("ok");
  });

  it("rejects with a timeout error when the promise does not settle in time", async () => {
    const pending = new Promise<string>(() => undefined);

    await expect(withTimeout(pending, 5, "scan timed out")).rejects.toEqual(
      expect.objectContaining<Partial<TimeoutError>>({
        name: "TimeoutError",
        message: "scan timed out"
      })
    );
  });
});
