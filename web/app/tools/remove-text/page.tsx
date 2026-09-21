"use client";

import { useRef, useState } from "react";

function formatSize(bytes: number) {
  if (!bytes) return "0 MB";
  const mb = bytes / 1024 / 1024;
  if (mb < 1000) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

export default function RemoveTextPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "ready" | "waiting">("idle");

  function chooseFile(next?: File) {
    if (!next) return;
    setFile(next);
    setStatus("ready");
  }

  return (
    <main className="remove-text-page">
      <header className="remove-text-topbar">
        <a className="remove-text-brand" href="/">
          <span className="brand-mark">D</span>
          <span>
            <strong>Daitora</strong>
            <small>VLOG BOX</small>
          </span>
        </a>
        <div className="remove-text-tool-name">
          <span>AI VIDEO TOOL</span>
          <strong>视频去文字</strong>
        </div>
        <a className="remove-text-back" href="/">返回工作台</a>
      </header>

      <section className="remove-text-hero">
        <div className="remove-text-copy">
          <span className="remove-text-kicker">AI VIDEO CLEANUP</span>
          <h1>上传视频，生成无字母版</h1>
          <p>
            自动识别画面中的字幕与文字，完成后直接下载处理结果。
            当前页面先完成前端流程，AI 服务接入后即可正式处理。
          </p>
        </div>

        <div className="remove-text-flow">
          <div className="active">
            <span>1</span>
            <strong>上传视频</strong>
          </div>
          <i />
          <div className={status === "waiting" ? "active" : ""}>
            <span>2</span>
            <strong>AI 处理</strong>
          </div>
          <i />
          <div>
            <span>3</span>
            <strong>下载成品</strong>
          </div>
        </div>
      </section>

      <section className="remove-text-workspace">
        <article className="remove-text-upload-card">
          <div className="remove-text-section-title">
            <div>
              <span>STEP 01</span>
              <h2>选择视频</h2>
            </div>
            <small>MP4 / MOV</small>
          </div>

          <button
            type="button"
            className={`remove-text-dropzone ${file ? "has-file" : ""}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              chooseFile(event.dataTransfer.files?.[0]);
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept="video/mp4,video/quicktime,.mp4,.mov"
              onChange={(event) => chooseFile(event.target.files?.[0])}
            />

            {!file ? (
              <>
                <span className="remove-text-upload-icon">↑</span>
                <strong>点击选择，或把视频拖到这里</strong>
                <small>建议先使用 3 分钟以内的视频进行测试</small>
              </>
            ) : (
              <div className="remove-text-selected-file">
                <span className="remove-text-video-icon">▶</span>
                <div>
                  <strong>{file.name}</strong>
                  <small>{formatSize(file.size)} · 已准备上传</small>
                </div>
                <b>更换</b>
              </div>
            )}
          </button>

          <div className="remove-text-mode">
            <div>
              <span className="remove-text-mode-icon">AI</span>
              <div>
                <strong>自动识别文字</strong>
                <small>自动检测字幕、标题与画面文字</small>
              </div>
            </div>
            <span className="remove-text-mode-tag">默认</span>
          </div>

          <button
            type="button"
            className="remove-text-start"
            disabled={!file}
            onClick={() => setStatus("waiting")}
          >
            <span>✦</span>
            {status === "waiting" ? "等待接入 AI 处理服务" : "开始去除文字"}
          </button>
        </article>

        <aside className="remove-text-result-card">
          <div className="remove-text-section-title">
            <div>
              <span>STEP 02</span>
              <h2>处理结果</h2>
            </div>
            <small className={status === "waiting" ? "waiting" : ""}>
              {status === "waiting" ? "接口待接入" : "等待任务"}
            </small>
          </div>

          <div className={`remove-text-result-preview ${status === "waiting" ? "waiting" : ""}`}>
            <span className="remove-text-result-icon">
              {status === "waiting" ? "…" : "▶"}
            </span>
            <strong>
              {status === "waiting"
                ? "页面流程已经准备完成"
                : "处理后的无字视频会显示在这里"}
            </strong>
            <small>
              {status === "waiting"
                ? "下一步接入 VSR / STTN 后即可开始真实处理"
                : "完成处理后可直接预览与下载"}
            </small>
          </div>

          <div className="remove-text-result-meta">
            <div>
              <span>原视频</span>
              <strong>{file ? file.name : "—"}</strong>
            </div>
            <div>
              <span>处理模式</span>
              <strong>自动识别文字</strong>
            </div>
            <div>
              <span>输出</span>
              <strong>MP4 · 保留原音频</strong>
            </div>
          </div>

          <button type="button" className="remove-text-download" disabled>
            <span>↓</span>
            下载无字视频
          </button>
        </aside>
      </section>

      <section className="remove-text-note">
        <span>i</span>
        <p>
          当前仅完成页面与交互骨架，不会真正上传视频。
          接入 GPU 处理服务后，上传、进度、预览和下载将沿用这个页面完成。
        </p>
      </section>
    </main>
  );
}
