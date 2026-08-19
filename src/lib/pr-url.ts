const pullRequestPath = /^\/[^/]+\/[^/]+\/pull\/\d+(\/.*)?$/;

/**
 * Content scripts now inject on all of github.com (see manifest.json), so
 * activation has to be gated at runtime on the actual PR path instead.
 */
export function isPullRequestUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  return parsed.hostname === 'github.com' && pullRequestPath.test(parsed.pathname);
}
