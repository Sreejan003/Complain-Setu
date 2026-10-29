/** Omit unselected filters without dropping meaningful false/zero values. */
export function queryString(params: Record<string, unknown> = {}) {
  return new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null).map(([key, value]) => [key, String(value)])).toString();
}
