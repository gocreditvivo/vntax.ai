import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

function createMemoryStorage(): Storage {
  const entries = new Map<string, string>();

  return {
    get length() {
      return entries.size;
    },
    clear() {
      entries.clear();
    },
    getItem(key) {
      return entries.get(String(key)) ?? null;
    },
    key(index) {
      return Array.from(entries.keys())[index] ?? null;
    },
    removeItem(key) {
      entries.delete(String(key));
    },
    setItem(key, value) {
      entries.set(String(key), String(value));
    },
  };
}

function ensureBrowserStorage(name: 'localStorage' | 'sessionStorage') {
  let storage: Storage | undefined;

  try {
    storage = window[name];
  } catch {
    storage = undefined;
  }

  if (!storage || typeof storage.clear !== 'function') {
    Object.defineProperty(window, name, {
      configurable: true,
      value: createMemoryStorage(),
    });
  }
}

// Node 26 exposes experimental storage globals that can shadow jsdom with an
// undefined value unless --localstorage-file is provided. Keep browser tests
// deterministic without changing production storage behaviour.
ensureBrowserStorage('localStorage');
ensureBrowserStorage('sessionStorage');

/**
 * Unmounts anything rendered by a test once it finishes.
 *
 * Testing Library registers this automatically only when Vitest runs with
 * `globals: true`, which this project does not. Without it, every render stays
 * in the document for the rest of the file, so `getByLabelText('Email')` starts
 * matching a form from three tests ago and queries fail with "found multiple
 * elements" — or worse, silently assert against stale markup.
 */
afterEach(() => {
  cleanup();
});
