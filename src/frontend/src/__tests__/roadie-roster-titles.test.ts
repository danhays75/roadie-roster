import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Cover for the accepted "Roadie Roster" title change on the static shell
 * files. The header title text is covered by the component suite; these tests
 * assert the browser tab title, the PWA manifest name/short_name and the
 * apple-mobile-web-app-title, which live in `index.html` and
 * `manifest.webmanifest` and are not reachable through a rendered component.
 */

// Vitest runs with the frontend package as the working directory, so the
// static shell files resolve from there.
const frontendRoot = process.cwd();

function readFrontendFile(relativePath: string): string {
  return readFileSync(resolve(frontendRoot, relativePath), "utf8");
}

describe("browser tab and PWA titles", () => {
  it("sets the browser tab title to Roadie Roster", () => {
    const html = readFrontendFile("index.html");
    const match = html.match(/<title>([^<]*)<\/title>/);
    expect(match?.[1]).toBe("Roadie Roster");
  });

  it("sets the apple-mobile-web-app-title to Roadie Roster", () => {
    const html = readFrontendFile("index.html");
    const match = html.match(
      /<meta\s+name="apple-mobile-web-app-title"\s+content="([^"]*)"/,
    );
    expect(match?.[1]).toBe("Roadie Roster");
  });

  it("sets the PWA manifest name and short_name to Roadie Roster", () => {
    const manifest = JSON.parse(
      readFrontendFile("public/manifest.webmanifest"),
    ) as { name?: string; short_name?: string };
    expect(manifest.name).toBe("Roadie Roster");
    expect(manifest.short_name).toBe("Roadie Roster");
  });
});
