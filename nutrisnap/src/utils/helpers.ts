// Shared helper utilities

/**
 * Safely parse a macro value from AI analysis results.
 * Handles string values like "20g" or "~500" by extracting digits.
 */
export function parseMacro(val: any): number {
  if (!val) return 0;
  const num = parseFloat(String(val).replace(/[^\d.]/g, ''));
  return isNaN(num) ? 0 : num;
}
