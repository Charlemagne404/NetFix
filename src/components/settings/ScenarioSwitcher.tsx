import { MOCK_SCENARIOS } from "@/core/mockData";
import type { MockScenarioId } from "@/core/types";

type ScenarioSwitcherProps = {
  value: MockScenarioId;
  onChange: (scenario: MockScenarioId) => void;
};

export function ScenarioSwitcher({ value, onChange }: ScenarioSwitcherProps) {
  const selected = MOCK_SCENARIOS.find((scenario) => scenario.id === value);

  return (
    <label className="grid gap-1 text-xs text-slate-400">
      Demo scenario
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as MockScenarioId)}
        className="min-w-56 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm font-medium text-slate-100 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20"
      >
        {MOCK_SCENARIOS.map((scenario) => (
          <option key={scenario.id} value={scenario.id}>
            {scenario.label}
          </option>
        ))}
      </select>
      {selected ? <span className="text-[11px] text-slate-500">{selected.description}</span> : null}
    </label>
  );
}
