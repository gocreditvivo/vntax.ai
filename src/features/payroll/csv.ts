/**
 * Encode one CSV field for spreadsheet review.
 *
 * Quoting commas is not enough: Excel and similar programs evaluate cells
 * beginning with =, +, -, or @ as formulas. Business and worker names are
 * user-controlled, so string values with a formula prefix are forced to text
 * with a leading apostrophe. Numeric values remain numeric, including
 * legitimate negative numbers.
 */
export function csvCell(value: unknown): string {
  let text = String(value ?? '');
  if (
    typeof value === 'string' &&
    (/^[\t\r\n]/.test(text) || /^\s*[=+\-@]/.test(text))
  ) {
    text = `'${text}`;
  }
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
