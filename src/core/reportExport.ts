import type { DiagnosticNode, ScanResult } from "./types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function nodeToHtml(node: DiagnosticNode): string {
  const evidence = node.evidence
    .map(
      (item) => `
        <li>
          <strong>${escapeHtml(item.label)}</strong>
          <span>${escapeHtml(item.value)}</span>
          <em>${escapeHtml(item.status)}</em>
          ${item.detail ? `<p>${escapeHtml(item.detail)}</p>` : ""}
        </li>`
    )
    .join("");

  return `
    <section class="node ${escapeHtml(node.status)}">
      <h3>${escapeHtml(node.label)}</h3>
      <p>${escapeHtml(node.summary)}</p>
      <ul>${evidence}</ul>
    </section>`;
}

export function buildJsonReport(scan: ScanResult): string {
  return JSON.stringify(
    {
      privacy:
        "This report is generated locally. It intentionally excludes saved Wi-Fi passwords and is not uploaded by Aegis Network Doctor.",
      scan
    },
    null,
    2
  );
}

export function buildHtmlReport(scan: ScanResult): string {
  const failedNode = scan.nodes.find(
    (node) => node.id === scan.diagnosis.primaryFailedNodeId
  );

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Aegis Network Report</title>
  <style>
    :root { color-scheme: dark; font-family: Aptos, "Segoe UI", sans-serif; background: #07101d; color: #ecfeff; }
    body { margin: 0; padding: 40px; background: radial-gradient(circle at 20% 0%, rgba(56,213,255,.18), transparent 30%), #07101d; }
    main { max-width: 980px; margin: 0 auto; }
    header, section { border: 1px solid rgba(255,255,255,.12); background: rgba(13,20,36,.78); border-radius: 24px; padding: 24px; margin-bottom: 18px; box-shadow: 0 20px 80px rgba(0,0,0,.28); }
    h1, h2, h3 { margin: 0 0 10px; }
    p { color: #b9c8da; line-height: 1.6; }
    .timeline { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
    .node.ok { border-color: rgba(68,224,165,.35); }
    .node.warning { border-color: rgba(251,191,36,.45); }
    .node.failed { border-color: rgba(251,113,133,.55); }
    ul { padding-left: 18px; }
    li { margin: 10px 0; color: #dce8f7; }
    li span { color: #93c5fd; margin-left: 8px; }
    li em { color: #94a3b8; margin-left: 8px; font-style: normal; }
    .privacy { color: #fcd34d; }
    pre { white-space: pre-wrap; background: rgba(0,0,0,.28); border-radius: 16px; padding: 16px; color: #b9e6ff; }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>${escapeHtml(scan.diagnosis.title)}</h1>
      <p>${escapeHtml(scan.diagnosis.summary)}</p>
      <p><strong>Confidence:</strong> ${scan.diagnosis.confidence}% · <strong>Mode:</strong> ${escapeHtml(scan.mode)} · <strong>Created:</strong> ${escapeHtml(scan.createdAt)}</p>
      <p class="privacy">Privacy note: this local report excludes saved Wi-Fi passwords and is not uploaded by Aegis Network Doctor.</p>
    </header>
    ${
      failedNode
        ? `<section><h2>Primary failure point</h2><p>${escapeHtml(failedNode.label)}: ${escapeHtml(failedNode.summary)}</p></section>`
        : ""
    }
    <section>
      <h2>Timeline</h2>
      <div class="timeline">${scan.nodes.map(nodeToHtml).join("")}</div>
    </section>
    <section>
      <h2>Recommended fixes</h2>
      <ul>${scan.diagnosis.recommendedFixes
        .map(
          (fix) =>
            `<li><strong>${escapeHtml(fix.title)}</strong> (${escapeHtml(fix.safety)}) - ${escapeHtml(fix.description)}</li>`
        )
        .join("")}</ul>
    </section>
    <section>
      <h2>Raw output</h2>
      ${scan.nodes
        .filter((node) => node.rawOutput)
        .map(
          (node) =>
            `<details><summary>${escapeHtml(node.label)}</summary><pre>${escapeHtml(node.rawOutput ?? "")}</pre></details>`
        )
        .join("")}
    </section>
  </main>
</body>
</html>`;
}

export function downloadTextFile(
  filename: string,
  content: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
