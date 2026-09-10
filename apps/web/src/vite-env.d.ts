/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly VITE_DESKTOP_WIN_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
