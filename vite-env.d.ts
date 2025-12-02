// Manual definitions to replace missing vite/client types

declare namespace NodeJS {
  interface ProcessEnv {
    readonly API_KEY: string;
    [key: string]: string | undefined;
  }
}

interface ImportMetaEnv {
  readonly API_KEY: string;
  [key: string]: string | boolean | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
