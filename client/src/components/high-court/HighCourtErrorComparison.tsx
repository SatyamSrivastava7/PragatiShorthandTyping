import { cn } from "@/lib/utils";
import { cleanHighCourtDisplayText, type HighCourtAlignmentEntry } from "@/lib/highCourt";

export function HighCourtErrorComparison({
  alignment = [],
}: {
  alignment?: HighCourtAlignmentEntry[];
}) {
  if (!alignment.length) {
    return <p className="text-sm text-muted-foreground">No comparison detail is available yet.</p>;
  }

  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-lg border bg-slate-50 p-4 text-sm leading-7 [overflow-wrap:anywhere]">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Error comparison
      </p>
      {alignment.map((entry, index) => {
        const original = cleanHighCourtDisplayText(entry.original);
        const typed = cleanHighCourtDisplayText(entry.typed);
        if (!original && !typed) return null;

        if (entry.status === "match") {
          return <span key={index} className="mr-1 [overflow-wrap:anywhere] text-slate-700">{typed}</span>;
        }
        if (entry.status === "missing") {
          return (
            <span key={index} className="mr-1 [overflow-wrap:anywhere]">
              <span
                className={cn(
                  "rounded px-1 font-semibold",
                  entry.severity === "half" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-700",
                )}
              >
                —
              </span>
              <span className="ml-1 font-semibold text-emerald-700">[{original}]</span>
            </span>
          );
        }
        if (entry.status === "extra") {
          return (
            <span
              key={index}
                className={cn(
                  "mr-1 rounded px-1 font-semibold underline [overflow-wrap:anywhere]",
                entry.severity === "half" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-700",
              )}
            >
              {typed}
            </span>
          );
        }
        return (
          <span key={index} className="mr-1 [overflow-wrap:anywhere]">
            <span
              className={cn(
                "rounded px-1 font-semibold underline",
                entry.severity === "half" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-700",
              )}
            >
              {typed}
            </span>
            <span className="ml-1 font-semibold text-emerald-700">[{original}]</span>
          </span>
        );
      })}
      <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-600">
        <span><b className="text-red-700">Red</b> full mistake</span>
        <span><b className="text-amber-700">Amber</b> half mistake</span>
        <span><b className="text-emerald-700">[Green]</b> expected text; <b>—</b> omitted word uses its mistake color</span>
      </div>
    </div>
  );
}