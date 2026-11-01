import type { PostgrestError } from "@supabase/supabase-js";

export class DataError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

/** Unwraps a Supabase response, throwing on error. Rows are typed at this boundary. */
export function rows<T>(res: { data: unknown; error: PostgrestError | null }): T[] {
  if (res.error) throw new DataError(res.error.message, res.error.code);
  return (res.data ?? []) as T[];
}

export function one<T>(res: { data: unknown; error: PostgrestError | null }): T | null {
  if (res.error) throw new DataError(res.error.message, res.error.code);
  return (res.data ?? null) as T | null;
}
