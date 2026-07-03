/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string
  readonly VITE_REACT_QUERY_DEVTOOLS: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
