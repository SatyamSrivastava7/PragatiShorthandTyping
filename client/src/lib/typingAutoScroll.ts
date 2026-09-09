const MIN_SCROLL_PADDING = 12;
const TOP_VISIBLE_LINES = 2;
const BOTTOM_VISIBLE_LINES = 3;

function getLineHeight(element: HTMLElement, fallbackFontSize: number) {
  const computed = window.getComputedStyle(element);
  const fontSize = Number.parseFloat(computed.fontSize) || fallbackFontSize;
  const lineHeight = Number.parseFloat(computed.lineHeight);

  if (!Number.isFinite(lineHeight) || lineHeight <= 0 || lineHeight < fontSize) {
    return Math.max(fallbackFontSize * 1.5, 1);
  }

  return lineHeight;
}

/**
 * Keeps the current-word marker in a stable reading window without
 * forcing the container to the end based on an approximate word ratio.
 */
export function scrollActiveMarkerIntoView(
  container: HTMLElement,
  marker: HTMLElement,
): void {
  if (container.clientHeight <= 0 || container.scrollHeight <= container.clientHeight) {
    return;
  }

  const lineHeight = getLineHeight(marker, 16);
  const containerRect = container.getBoundingClientRect();
  const markerRect = marker.getBoundingClientRect();
  const markerTop = markerRect.top - containerRect.top;
  const markerBottom = markerRect.bottom - containerRect.top;
  const visibleHeight = container.clientHeight;
  const topPadding = Math.max(MIN_SCROLL_PADDING, lineHeight * TOP_VISIBLE_LINES);
  const bottomPadding = Math.max(MIN_SCROLL_PADDING, lineHeight * BOTTOM_VISIBLE_LINES);
  const safeBottom = visibleHeight - bottomPadding;

  let targetScrollTop = container.scrollTop;

  if (markerTop < topPadding) {
    targetScrollTop += markerTop - topPadding;
  } else if (markerBottom > safeBottom) {
    targetScrollTop += markerBottom - safeBottom;
  } else {
    return;
  }

  const maxScrollTop = Math.max(0, container.scrollHeight - visibleHeight);
  targetScrollTop = Math.min(maxScrollTop, Math.max(0, targetScrollTop));

  if (Math.abs(targetScrollTop - container.scrollTop) < 1) {
    return;
  }

  container.scrollTo({
    top: targetScrollTop,
    behavior: "smooth",
  });
}