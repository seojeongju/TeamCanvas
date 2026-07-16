import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import App from "./App.tsx";
import { initViewportGuards } from "./lib/viewport";
import { initPwaInstallListener } from "./lib/pwaInstallStore";

initViewportGuards();
initPwaInstallListener();

async function disableLegacyServiceWorkers() {
  if (!("serviceWorker" in navigator)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch (error) {
    console.warn("Failed to unregister service workers", error);
  }

  if (!("caches" in window)) return;

  try {
    const cacheKeys = await caches.keys();
    await Promise.all(
      cacheKeys
        .filter((key) =>
          key.includes("workbox") ||
          key.includes("precache") ||
          key.includes("api-cache") ||
          key.includes("api-data-cache"),
        )
        .map((key) => caches.delete(key)),
    );
  } catch (error) {
    console.warn("Failed to clear legacy caches", error);
  }
}

void disableLegacyServiceWorkers();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
