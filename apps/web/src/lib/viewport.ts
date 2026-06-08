const VIEWPORT_CONTENT =
  "width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, viewport-fit=cover";

/** OAuth 등 외부 리다이렉트 후 모바일 브라우저 뷰포트가 축소되는 현상 완화 */
export function ensureMobileViewport(): void {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "viewport";
    document.head.appendChild(meta);
  }
  if (meta.content !== VIEWPORT_CONTENT) {
    meta.content = VIEWPORT_CONTENT;
  }
}

export function initViewportGuards(): void {
  ensureMobileViewport();
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) ensureMobileViewport();
  });
  window.addEventListener("orientationchange", () => {
    window.setTimeout(ensureMobileViewport, 100);
  });
}
