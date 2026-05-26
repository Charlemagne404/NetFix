import { MOCK_SCENARIOS } from "@/core/mockData";
import type { MockScenarioId } from "@/core/types";

type ScenarioSwitcherProps = {
  value: MockScenarioId;
  onChange: (scenario: MockScenarioId) => void;
  compact?: boolean;
};

export function ScenarioSwitcher({
  value,
  onChange,
  compact = false
}: ScenarioSwitcherProps) {
  const selected = MOCK_SCENARIOS.find((scenario) => scenario.id === value);

  return (
    <label className="grid gap-1 text-[11px] text-slate-500">
      {compact ? "Scenario" : "Demo scenario"}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as MockScenarioId)}
        className="min-w-44 rounded-[10px] border border-[color:var(--aegis-line-soft)] bg-[rgba(118,146,188,0.04)] px-3 py-2 text-[13px] font-medium text-slate-100 outline-none transition focus:border-[#4b8dff]/60 focus:ring-2 focus:ring-[#4b8dff]/15"
      >
        {MOCK_SCENARIOS.map((scenario) => (
          <option key={scenario.id} value={scenario.id}>
            {scenario.label}
          </option>
        ))}
      </select>
      {!compact && selected ? (
        <span className="text-[11px] text-slate-500">{selected.description}</span>
      ) : null}
    </label>
  );
}
