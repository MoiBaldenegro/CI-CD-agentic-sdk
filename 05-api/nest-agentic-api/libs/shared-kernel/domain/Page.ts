/** One page of a listing, as the repositories return it. */
export interface Page<T> {
  items: T[];
  /** Matching items in every page. */
  total: number;
  page: number;
  limit: number;
}

/** Which page to read: `page` starts at 1. */
export interface PageRequest {
  page: number;
  limit: number;
}

/** Largest page a listing returns, whatever the caller asks for. */
export const MAX_PAGE_LIMIT = 100;

/** A page request with whole numbers in range (page ≥ 1, 1 ≤ limit ≤ 100). */
export function pageRequest(page: number, limit: number): PageRequest {
  return {
    page: Math.max(Math.trunc(page) || 1, 1),
    limit: Math.min(Math.max(Math.trunc(limit) || 1, 1), MAX_PAGE_LIMIT),
  };
}

/** Rows to skip to reach the page. */
export function pageOffset(request: PageRequest): number {
  return (request.page - 1) * request.limit;
}

/** The page of an in-memory list (for test doubles). */
export function pageOf<T>(items: T[], request: PageRequest): Page<T> {
  const offset = pageOffset(request);
  return {
    items: items.slice(offset, offset + request.limit),
    total: items.length,
    page: request.page,
    limit: request.limit,
  };
}
