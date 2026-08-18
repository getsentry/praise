import { readFileSync } from "node:fs";
import { join } from "node:path";

export type FixtureName = "review-dialog" | "diff-comment";

/**
 * Replaces the document with a captured GitHub page.
 *
 * `documentElement.innerHTML` rather than `document.write`, which refined-github
 * uses: `write` needs an open parser, and re-running it across tests in one
 * jsdom document is unreliable. This also keeps `document` identity stable, so
 * modules holding a reference to it stay valid.
 */
export function loadFixture(name: FixtureName): void {
  const html = readFileSync(
    join(__dirname, "../../../test/fixtures", `${name}.html`),
    "utf8",
  );

  const body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html);
  document.documentElement.innerHTML = `<head></head><body>${body ? body[1] : html}</body>`;
}
