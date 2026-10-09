import { useMemo } from "react";
import type { Result } from "@shared/schema";
import { calculateShorthandResultMetrics } from "@/lib/utils";

interface ShorthandResultMetricsProps {
  result: Result;
  variant: "summary" | "analysis";
}

export function ShorthandResultMetrics({
  result,
  variant,
}: ShorthandResultMetricsProps) {
  const metrics = useMemo(
    () =>
      calculateShorthandResultMetrics(
        result.originalText || "",
        result.typedText || "",
        result.time,
      ),
    [result.originalText, result.typedText, result.time],
  );

  if (variant === "summary") {
    return (
      <div className="flex items-center gap-3">
        <span
          className={`px-3 py-1 rounded-full text-sm font-semibold ${
            metrics.result === "Pass"
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-600"
          }`}
        >
          {metrics.result}
        </span>
        <span className="text-sm text-muted-foreground">
          {metrics.mistakes} mistakes
        </span>
      </div>
    );
  }

  return (
    <>
      <div>
        <span className="font-semibold">Mistakes:</span>{" "}
        <span className="text-red-600 font-bold">{metrics.mistakes}</span>
      </div>
      <div>
        <span className="font-semibold">Total Original Words:</span>{" "}
        <span>{metrics.fullOriginalWords}</span>
      </div>
      <div>
        <span className="font-semibold">Result:</span>{" "}
        <span
          className={
            metrics.result === "Pass"
              ? "text-green-600 font-bold"
              : "text-red-600 font-bold"
          }
        >
          {metrics.result}
        </span>
      </div>
    </>
  );
}
