/**
 * Incremental-locale support.
 *
 * English and Vietnamese are COMPLETE dictionaries: `Dict` is derived from
 * `en`, and `vi: Dict` means a missing key fails the build. That guarantee is
 * deliberate and stays.
 *
 * Spanish is being translated incrementally. Holding it to the same rule would
 * mean either blocking launch until every string is translated, or shipping
 * placeholder text. Instead `es` is a DeepPartial merged over `en` at module
 * load, so any untranslated key falls back to English rather than rendering
 * blank or crashing.
 *
 * When Spanish reaches parity, change its type to `Dict` and delete the merge.
 */

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly (infer U)[]
    ? readonly U[]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Returns a complete dictionary: `base` with `override` applied where present.
 * Arrays are replaced wholesale, never merged element-wise — a partially
 * translated list is worse than an English one.
 */
export function mergeDict<T>(base: T, override: DeepPartial<T>): T {
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };

  for (const key of Object.keys(override as Record<string, unknown>)) {
    const o = (override as Record<string, unknown>)[key];
    const b = out[key];
    if (o === undefined) continue;
    out[key] = isPlainObject(o) && isPlainObject(b) ? mergeDict(b, o) : o;
  }

  return out as T;
}

/** Reports translation coverage, so "how done is Spanish?" has a real answer. */
export function coverage<T>(base: T, override: DeepPartial<T>): number {
  let total = 0;
  let done = 0;

  const walk = (b: unknown, o: unknown): void => {
    if (!isPlainObject(b)) {
      total += 1;
      if (o !== undefined) done += 1;
      return;
    }
    for (const k of Object.keys(b)) {
      walk(b[k], isPlainObject(o) ? o[k] : undefined);
    }
  };

  walk(base, override);
  return total === 0 ? 1 : done / total;
}
