/**
 * Argument parsing for the probe CLI.
 *
 * Positional and order-independent -- the two things a caller passes are a
 * scenario name and a PR URL, and they are never confusable: only one of them
 * starts with `http`.
 */

export const DEFAULT_URL = 'https://github.com/getsentry/praise/pull/22';

export const SCENARIOS = ['review', 'diff-comment', 'soft-nav-review'];

export function parseArgs(argv) {
  let scenario;
  let url;

  for (const argument of argv) {
    if (argument.startsWith('http')) {
      url = argument;
    } else {
      scenario = argument;
    }
  }

  const chosen = scenario ?? 'review';
  if (!SCENARIOS.includes(chosen)) {
    return {
      scenario: chosen,
      url: url ?? DEFAULT_URL,
      error: `Unknown scenario "${chosen}". Expected one of: ${SCENARIOS.join(', ')}.`,
    };
  }

  return { scenario: chosen, url: url ?? DEFAULT_URL };
}
