/**
 * Parse pagination query params.
 * @param {object} query - The query object from Fastify request
 * @returns {{ skip: number, take: number, page: number, pageSize: number }}
 */
export function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize || '20', 10)));
  const skip = (page - 1) * pageSize;
  return { skip, take: pageSize, page, pageSize };
}

/**
 * Build pagination meta object.
 * @param {number} total - Total number of items
 * @param {number} page - Current page
 * @param {number} pageSize - Items per page
 * @returns {{ total: number, page: number, pageSize: number, totalPages: number }}
 */
export function buildMeta(total, page, pageSize) {
  return {
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}
