import type { GetResponse } from '@/openapi/api/users/types'

/** One user row as returned by GET /api/users. */
export type User = GetResponse[number]
