import type { MockScenarioId } from "./types";

const MOCK_FIX_TRANSITIONS: Partial<
  Record<MockScenarioId, Partial<Record<string, MockScenarioId>>>
> = {
  "dns-failure": {
    "flush-dns": "healthy",
    "renew-dhcp": "healthy",
    "dns-automatic": "healthy",
    "set-public-dns": "healthy"
  },
  "dhcp-apipa": {
    "renew-dhcp": "healthy",
    "restart-adapter": "healthy"
  },
  "wlan-service-stopped": {
    "restart-wlan-service": "healthy"
  },
  "gateway-unreachable": {
    "renew-dhcp": "healthy",
    "restart-adapter": "healthy"
  },
  "windows-false-negative": {
    "flush-dns": "healthy"
  },
  "captive-portal": {
    "open-network-settings": "healthy"
  }
};

export function projectMockScenarioAfterFix(
  scenarioId: MockScenarioId,
  fixId: string
): MockScenarioId {
  return MOCK_FIX_TRANSITIONS[scenarioId]?.[fixId] ?? scenarioId;
}
