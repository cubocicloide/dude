/** Base path for all API requests (proxied by Vite dev server and Docker). */
export const API_BASE_URL = '/api'

/** Application title sourced from the Vite environment. */
export const APP_TITLE = import.meta.env.VITE_APP_TITLE as string

/** BCP 47 locale tag used for date/number formatting across the app. */
export const DEFAULT_LOCALE = 'en-US'

/** Default page size for paginated tables and lists. */
export const DEFAULT_PAGE_SIZE = 20
