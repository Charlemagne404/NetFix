# Aegis Trace

Aegis Trace is a mock-first Tauri desktop app for visual Wi-Fi and network diagnostics on Windows. The product centers on a left-to-right diagnostic timeline that shows where the connection path breaks across:

Device -> Adapter -> Wi-Fi -> Profile -> IP Address -> Gateway -> Internet -> DNS -> Windows Status -> Apps

## Current State

The project already has a usable React/Tauri shell, a typed diagnostic model, realistic mock scenarios, ranked repair recommendations, local report export, and a Windows-only backend for live probes and allowlisted fixes.

What is implemented today:

- Timeline-first dashboard with animated scan progression.
- Normal and Technician modes.
- Ten mock scenarios for cross-platform development and demos.
- Local scan history with restore-on-load behavior.
- Repair confirmation flow with command previews and post-fix verification.
- Local JSON, HTML, and ZIP case-file export.
- Tauri v2 command surface for live Windows scans, report export, and allowlisted fix execution.
- Windows compile validation in GitHub Actions.

What is still limited:

- Real diagnostics and repair execution only work in the Windows Tauri runtime.
- Browser development mode falls back to preview or mock data and does not execute live fixes.
- Runtime validation on real Windows hardware is still needed for broader confidence.
- Code-signing and polished release automation are scaffolded, not finished.

## Safety Model

Aegis Trace is built around diagnosis before repair.

- No arbitrary shell input from the frontend.
- Frontend requests scans and allowlisted fix IDs only.
- Fix execution is mapped in the backend to fixed commands with confirmation gates.
- Moderate and aggressive repairs require explicit confirmation.
- Reports stay local.
- Saved Wi-Fi passwords are never read or exported.
- Telemetry and report uploads are not implemented.

## Development

Install dependencies:

```bash
npm install
```

Run the browser preview:

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

Run the Tauri desktop app:

```bash
npm run tauri dev
```

Windows compile validation runs in [`.github/workflows/windows-validate.yml`](./.github/workflows/windows-validate.yml). It covers frontend tests, frontend build, and Rust `cargo check` on `windows-latest`, but it does not replace live runtime testing on a real Windows machine.

## Project Layout

```text
src/
  components/     React UI for dashboard, timeline, details, fixes, reports, and settings
  core/           typed models, mock scenarios, scoring, report export, history, repair verification
  hooks/          scan orchestration and footer metrics
  platform/       browser/mock/Tauri adapters

src-tauri/
  src/            Tauri commands and Windows diagnostics/fix logic
  tauri.conf.json app metadata and bundle defaults
  tauri.windows.conf.json Windows installer bundle config
  tauri.windows.release.conf.json optional signing overlay
```

## Windows Packaging

- Windows installer targets are configured in [`src-tauri/tauri.windows.conf.json`](./src-tauri/tauri.windows.conf.json).
- Optional signing overlay guidance lives in [`docs/windows-release.md`](./docs/windows-release.md).
- ZIP case files include a plain-language summary, structured scan JSON, a styled HTML timeline report, manifest metadata, and raw per-node output when available.
