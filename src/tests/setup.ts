import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

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
