# Aegis Network Doctor

Aegis Network Doctor is a polished Windows desktop app for visual Wi-Fi and network diagnostics. Its core experience is an interactive diagnostic timeline that shows where the connection chain breaks:

Device → Adapter → Wi-Fi → Profile → IP Address → Gateway → Internet → DNS → Windows Status → Apps.

The app is mock-first so the full interface works on non-Windows machines. Real Windows diagnostics are isolated behind a Tauri platform adapter and Rust command allowlists.

## Current Capabilities

- Dark, timeline-first React dashboard with animated scan replay.
- Ten realistic mock diagnostic scenarios.
- Typed diagnostic model, scoring logic, ranked fix registry, and platform abstraction.
- Normal and Technician modes.
- Safe fix previews and confirmation modal before execution.
- Automatic repair verification with before/after timeline comparison.
- Persistent local scan history with restore-to-workspace behavior.
- Local JSON/HTML report generation.
- Tauri v2 backend with comprehensive Windows probes, richer confidence-based diagnosis, and allowlisted repair execution.

## Safety And Privacy

Aegis is designed to diagnose before repairing.

- No telemetry.
- No report uploads.
- No Wi-Fi password extraction.
- No arbitrary command execution from the frontend.
- Frontend sends scan requests and fix IDs only.
- Backend maps fix IDs to fixed allowlisted commands.
- Every fix shows command previews before execution.
- Moderate and aggressive fixes stay allowlisted, previewed, and confirmation-gated. Targeted adapter/profile fixes resolve their own context inside the backend before execution.
- Exported reports stay local and include a privacy warning because they may contain adapter names, IP addresses, DNS servers, and command output.

## Development

Install dependencies:

```bash
npm install
```

Run the web app in development mode:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

Build the frontend:

```bash
npm run build
```

Run the Tauri app on a machine with Rust installed:

```bash
npm run tauri dev
```

This environment did not have `cargo`/`rustc`, so the frontend was validated here and the Rust/Tauri backend still needs compile/runtime validation on Windows.

## Architecture

```text
src/
  components/
    dashboard/      status cards and scan history
    details/        node explanation, evidence, technician details
    fixes/          fix cards and confirmation modal
    layout/         app shell
    reports/        local report preview/export UI
    settings/       mode, theme, scenario controls
    timeline/       diagnostic timeline and nodes
  core/
    types.ts              shared diagnostic model
    timelineDefinition.ts timeline order and checks
    fixRegistry.ts        fix metadata and command previews
    diagnosisScoring.ts   diagnosis rules and fix ranking
    mockData.ts           realistic demo scenarios
    diagnosticEngine.ts   adapter orchestration
    reportExport.ts       JSON/HTML report builders
  platform/
    mockAdapter.ts   mock scan/fix/report behavior
    tauriAdapter.ts  Tauri command bridge with mock fallback
  hooks/
    useDiagnosticScan.ts  scan replay state machine

src-tauri/
  src/
    commands.rs      Tauri command entrypoints
    diagnostics.rs   Windows read-only checks and allowlisted fixes
```

## Mock Scenarios

- Healthy connection
- DNS failure
- DHCP failure / APIPA
- No Wi-Fi adapter
- WLAN service stopped
- Gateway unreachable
- Internet unreachable but router reachable
- Proxy/app issue
- Windows false no-internet
- Captive portal suspected

## Roadmap

v0.1:
- Polished mock UI
- Interactive timeline
- Mock scenarios

v0.2:
- Real read-only Windows diagnostics
- Scan reports

v0.3:
- Safe fixes
- Automatic repair verification
- Local-only scan history

v0.4:
- Technician mode
- Event log parsing
- WLAN report integration

v0.5:
- Moderate fixes with confirmations
- Better diagnosis scoring

v1.0:
- Installer
- Signed builds if possible
- Export case files
