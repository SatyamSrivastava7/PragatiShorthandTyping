import { useCallback, useEffect, useRef, useState } from "react";

function getClockTime() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

/**
 * Shared countdown for assessment pages.
 *
 * A monotonic deadline is armed synchronously when a student starts, so wall
 * clock adjustments, React rerenders, or background-tab throttling cannot
 * reset or shorten the timer.
 */
export function useAssessmentTimer(active: boolean, onExpire: () => void) {
  const [timeLeft, setTimeLeft] = useState(0);
  const deadlineRef = useRef<number | null>(null);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const startTimer = useCallback((durationSeconds: number) => {
    const safeDuration = Math.max(0, Math.floor(durationSeconds));
    deadlineRef.current = getClockTime() + safeDuration * 1000;
    setTimeLeft(safeDuration);
  }, []);

  const resetTimer = useCallback((durationSeconds: number) => {
    deadlineRef.current = null;
    setTimeLeft(Math.max(0, Math.floor(durationSeconds)));
  }, []);

  useEffect(() => {
    if (!active || deadlineRef.current === null) return;

    let timeout: ReturnType<typeof setTimeout> | null = null;
    let expired = false;

    const update = () => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }

      const deadline = deadlineRef.current;
      if (deadline === null || expired) return;

      const remaining = Math.max(0, Math.ceil((deadline - getClockTime()) / 1000));
      setTimeLeft((current) => current === remaining ? current : remaining);

      if (remaining === 0) {
        expired = true;
        deadlineRef.current = null;
        onExpireRef.current();
        return;
      }

      timeout = setTimeout(update, 250);
    };

    const updateWhenVisible = () => {
      if (!document.hidden) update();
    };

    update();
    document.addEventListener("visibilitychange", updateWhenVisible);

    return () => {
      if (timeout) clearTimeout(timeout);
      document.removeEventListener("visibilitychange", updateWhenVisible);
    };
  }, [active]);

  return { timeLeft, startTimer, resetTimer };
}
