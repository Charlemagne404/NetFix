import { describe, expect, it } from "vitest";
import { MOCK_SCENARIOS, createMockScanResult } from "./mockData";
import { TIMELINE_NODE_IDS } from "./timelineDefinition";

describe("mock diagnostic scenarios", () => {
  it("keeps every scenario aligned to the full timeline", () => {
    for (const scenario of MOCK_SCENARIOS) {
      const scan = createMockScanResult(scenario.id);
      expect(scan.nodes.map((node) => node.id)).toEqual(TIMELINE_NODE_IDS);
    }
  });

  it("includes evidence for every node", () => {
    for (const scenario of MOCK_SCENARIOS) {
      const scan = createMockScanResult(scenario.id);
      expect(scan.nodes.every((node) => node.evidence.length > 0)).toBe(true);
    }
  });
});
