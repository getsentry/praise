import { isPullRequestUrl } from '../lib/pr-url';

describe('isPullRequestUrl', () => {
  it('matches a bare PR page', () => {
    expect(isPullRequestUrl('https://github.com/owner/repo/pull/22')).toBe(true);
  });

  it('matches PR sub-pages', () => {
    expect(isPullRequestUrl('https://github.com/owner/repo/pull/22/files')).toBe(true);
    expect(isPullRequestUrl('https://github.com/owner/repo/pull/22/changes')).toBe(true);
    expect(isPullRequestUrl('https://github.com/owner/repo/pull/22/commits/abc')).toBe(true);
  });

  it('rejects the PR list page', () => {
    expect(isPullRequestUrl('https://github.com/owner/repo/pulls')).toBe(false);
  });

  it('rejects the repo home page', () => {
    expect(isPullRequestUrl('https://github.com/owner/repo')).toBe(false);
  });

  it('rejects a non-numeric PR id', () => {
    expect(isPullRequestUrl('https://github.com/owner/repo/pull/abc')).toBe(false);
  });

  it('rejects issues pages', () => {
    expect(isPullRequestUrl('https://github.com/owner/repo/issues/1')).toBe(false);
  });

  it('rejects non-github.com hosts', () => {
    expect(isPullRequestUrl('https://evil.example.com/owner/repo/pull/22')).toBe(false);
    expect(isPullRequestUrl('https://github.com.evil.com/owner/repo/pull/22')).toBe(false);
  });

  it('rejects an unparseable string', () => {
    expect(isPullRequestUrl('not a url')).toBe(false);
  });
});
