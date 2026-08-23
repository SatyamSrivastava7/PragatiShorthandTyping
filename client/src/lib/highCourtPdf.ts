import type { HighCourtAttempt, HighCourtGroupedResult } from "@/lib/highCourt";

const safe = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function page(attempt: HighCourtAttempt | null, label: string, maximum: number) {
  if (!attempt) {
    return `<section class="page"><h1>${label}</h1><p class="missing">This paper has not been submitted yet.</p></section>`;
  }
  const rows = (attempt.alignment || []).map((entry) => {
    const className = entry.status === "match" ? "ok" : entry.severity === "half" ? "half" : "full";
    const expected = entry.original ? `<span class="expected">[${safe(entry.original)}]</span>` : "";
    return `<span class="${className}">${safe(entry.typed || "—")}</span>${expected} `;
  }).join("");
  return `<section class="page">
    <h1>${label}</h1>
    <p class="subtitle">${safe(attempt.testTitle)} · Submitted ${new Date(attempt.submittedAt).toLocaleDateString()}</p>
    <div class="summary">
      <div><b>Full mistakes</b><strong>${attempt.mistakes}</strong></div>
      <div><b>Half mistakes</b><strong>${attempt.halfMistakes}</strong></div>
      <div><b>Marks obtained</b><strong>${attempt.marks} / ${maximum}</strong></div>
    </div>
    <h2>Error comparison</h2>
    <div class="comparison">${rows || "No comparison detail available."}</div>
    <footer>High Court Assessment Report</footer>
  </section>`;
}

export function downloadHighCourtPdf(result: HighCourtGroupedResult) {
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) return;
  const content = `<!doctype html><html><head><title>${safe(result.testSetTitle)} — High Court Report</title>
    <style>
      @page { size: A4; margin: 18mm; } body { font-family: Arial, sans-serif; color:#172033; }
      .page { min-height: 255mm; page-break-after: always; } .page:last-child { page-break-after: auto; }
      h1 { color:#92400e; border-bottom:3px solid #f59e0b; padding-bottom:10px; margin:0 0 6px; }
      h2 { font-size:15px; margin-top:28px; } .subtitle { color:#64748b; margin-top:0; }
      .summary { display:flex; gap:12px; margin:22px 0; } .summary div { flex:1; padding:14px; border-radius:8px; background:#fff7ed; border:1px solid #fed7aa; }
      .summary b { display:block; color:#9a3412; font-size:12px; } .summary strong { display:block; font-size:22px; margin-top:5px; }
      .comparison { padding:16px; border:1px solid #cbd5e1; background:#f8fafc; line-height:2; font-size:13px; }
      .full { color:#b91c1c; font-weight:700; text-decoration:underline; } .half { color:#a16207; font-weight:700; text-decoration:underline; }
      .expected { margin-left:3px; color:#15803d; font-weight:700; } .ok { color:#334155; } .missing { color:#64748b; margin-top:28px; }
      footer { position:fixed; bottom:10mm; color:#64748b; font-size:11px; }
    </style></head><body>
    ${page(result.typing, "Typing Test", 100)}
    ${page(result.pitman, "Pitman Test", 100)}
    ${page(result.shorthand, "Shorthand Test", 200)}
    </body></html>`;
  win.document.write(content);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}