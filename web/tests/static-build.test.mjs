import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("produces a deployable static site", async () => {
  await access(new URL("../dist/index.html", import.meta.url));
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(html, /Daitora Vlog Box/);
  const files = await readdir(new URL("../dist/assets/", import.meta.url));
  assert.ok(files.some((name) => name.endsWith(".js")));
  assert.ok(files.some((name) => name.endsWith(".css")));
});
