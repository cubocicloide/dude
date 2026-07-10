import type { GetResponse } from '@/openapi/api/users/types'

/** One user row, unwrapped from the paginated GET /api/users/ response. */
export type User = GetResponse['results'][number]
