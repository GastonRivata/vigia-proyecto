/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string;
  readonly VITE_BACKEND_URL: string;
  // Agregá acá cualquier otra variable que uses en VIGIA
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}