import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("produces a deployable static site", async () => {
  await access(new URL("../dist/index.html", import.meta.url));
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(html, /Daitora Vlog Box/);
  assert.match(html, /name="daitora-build"/);
  const files = await readdir(new URL("../dist/assets/", import.meta.url));
  assert.ok(files.some((name) => name.endsWith(".js")));
  assert.ok(files.some((name) => name.endsWith(".css")));
});

test("keeps the approved type scale and desktop responsive contracts", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  for (const token of ["--font-page-title:32px", "--font-section-title:22px", "--font-card-title:16px", "--font-body:14px", "--font-meta:12px"]) assert.ok(css.includes(token), token);
  assert.match(css, /@media\(max-width:1366px\)/);
  assert.match(css, /--content-max:1600px/);
  assert.match(css, /minmax\(0,1fr\)/);
});

test("exposes server-backed folder and all-files library views", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  for (const label of ["文件夹模式", "全部文件模式", "拍摄日期", "上传日期", "真实上传时间"]) assert.ok(page.includes(label), label);
  assert.ok(page.includes("loadLibraryAssets"));
  assert.ok(page.includes('useState("assets")'), "library is the visible default editor panel");
});

test("keeps the editor workflow minimal and package-bound", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  for (const label of ["待处理", "素材库 / 任务详情", "成品记录", "回传给："]) assert.ok(page.includes(label), label);
  assert.ok(page.includes("uploadFinishedProduct(session.token,selectedPackage.id"));
  for (const removed of ["司机管理", "剪辑统计", "00:58 · 108 MB"]) assert.ok(!page.includes(removed), removed);
  for (const adminLabel of ["账号管理", "操作记录", "存储与备份"]) assert.ok(page.includes(adminLabel), adminLabel);
  assert.match(page, /preload="metadata"/);
});
