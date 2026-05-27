/**
 * Convert an array of objects to CSV string.
 * @param {Array<object>} rows - Array of objects with consistent keys
 * @returns {string} CSV content with header row
 */
export function toCsv(rows) {
  if (!rows || rows.length === 0) return '';

  const headers = Object.keys(rows[0]);
  const escape = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerRow = headers.map(escape).join(',');
  const dataRows = rows.map((row) => headers.map((h) => escape(row[h])).join(','));
  return [headerRow, ...dataRows].join('\n');
}
