"use client";
import { useEffect, useState } from "react";
import {
  downloadAsset,
  loadAssetPackages,
  login as apiLogin,
  previewAsset,
  uploadAsset,
  type DriverAssetPackage,
  type Session,
} from "./api";
type Mode = "driver" | "editor";
const versions = [
  {
    id: "A",
    title: "节奏明快版",
    duration: "00:42",
    note: "适合小红书 / 视频号",
    color: "#ff6b45",
  },
  {
    id: "B",
    title: "日常叙事版",
    duration: "00:58",
    note: "保留更多工作细节",
    color: "#2767e8",
  },
  {
    id: "C",
    title: "精简竖屏版",
    duration: "00:31",
    note: "适合短视频开场测试",
    color: "#7257d9",
  },
];
function BrandMark() {
  return <span className="brand-mark">D</span>;
}
function LoginScreen({ enter }: { enter: (session: Session) => void }) {
  const [user, setUser] = useState("admin");
  const [password, setPassword] = useState("Daitora1028");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function login(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      enter(await apiLogin(user, password));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "登录失败，请稍后重试");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand login-brand"><BrandMark/><div><strong>Daitora</strong><span>VLOG BOX</span></div></div>
        <div className="login-kicker">企业影像素材库</div>
        <h1>登录工作台</h1>
        <p>剪辑师与管理员使用网页端；司机日常上传建议使用微信小程序。</p>
        <form onSubmit={login}>
          <label>账号<input value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" /></label>
          <label>密码<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>
          {error && <div className="login-error">{error}</div>}
          <button className="login-submit" type="submit" disabled={busy}>{busy ? "正在验证…" : "登录工作台"}</button>
        </form>
        <small>系统会根据账号角色自动进入司机端、剪辑师端或管理端。</small>
      </section>
    </main>
  );
}
export default function Home() {
  const [session, setSession] = useState<Session | null>(() => {
    try {
      return JSON.parse(localStorage.getItem("daitora-session") || "null");
    } catch {
      return null;
    }
  });
  const mode: Mode = session?.user.role === "driver" ? "driver" : "editor";
  const [toast, setToast] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showRevision, setShowRevision] = useState(false);
  function notify(m: string) {
    setToast(m);
    window.setTimeout(() => setToast(null), 2600);
  }
  if (!session) return <LoginScreen enter={(next) => { localStorage.setItem("daitora-session", JSON.stringify(next)); setSession(next); }} />;
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <BrandMark />
          <div>
            <strong>Daitora</strong>
            <span>VLOG BOX</span>
          </div>
        </div>
        <div className="mode-switch"><button className="active">{mode === "driver" ? "司机端" : session.user.role === "admin" ? "管理端" : "剪辑师端"}</button></div>
        <div className="profile">
          <span className="avatar">{session.user.name[0]}</span>
          <div>
            <strong>{session.user.name}</strong>
            <button className="logout-button" onClick={() => { localStorage.removeItem("daitora-session"); setSession(null); }}>退出登录</button>
          </div>
        </div>
      </header>
      {mode === "driver" ? (
        <DriverView
          onUpload={() => setShowUpload(true)}
          onRevise={() => setShowRevision(true)}
          notify={notify}
        />
      ) : (
        <EditorView notify={notify} session={session} />
      )}{" "}
      {showUpload && (
        <UploadPanel
          close={() => setShowUpload(false)}
          done={() => {
            setShowUpload(false);
            notify("素材已放入统一素材夹，剪辑师将收到通知");
          }}
        />
      )}
      {showRevision && (
        <RevisionModal
          close={() => setShowRevision(false)}
          done={() => {
            setShowRevision(false);
            notify("修改要求已提交，剪辑师将收到通知");
          }}
        />
      )}
      {toast && (
        <div className="toast">
          <span>✓</span>
          {toast}
        </div>
      )}
    </main>
  );
}
function DriverView({
  onUpload,
  onRevise,
  notify,
}: {
  onUpload: () => void;
  onRevise: () => void;
  notify: (m: string) => void;
}) {
  const current = versions[1];
  return (
    <div className="driver-layout">
      <section className="driver-hero">
        <div className="eyebrow">
          <span className="live-dot" /> 今天 · 2026年8月15日
        </div>
        <h1>王师傅，今天拍了什么？</h1>
        <p>把视频传上来，剩下的交给剪辑师。</p>
        <div className="primary-actions">
          <button className="upload-action" onClick={onUpload}>
            <span className="action-icon">↑</span>
            <span>
              <strong>上传素材</strong>
              <small>直接放入公司统一素材夹</small>
            </span>
            <b>›</b>
          </button>
          <button
            className="download-action"
            onClick={() =>
              document
                .getElementById("versions")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            <span className="action-icon">↓</span>
            <span>
              <strong>查看成品</strong>
              <small>1 个最新成品等待确认</small>
            </span>
            <b>›</b>
          </button>
        </div>
      </section>
      <section className="status-strip">
        <div>
          <span className="status-number coral">8</span>
          <p>
            <strong>已上传素材</strong>
            <small>今天新增</small>
          </p>
        </div>
        <div>
          <span className="status-number blue">1</span>
          <p>
            <strong>成品待确认</strong>
            <small>当前最新版</small>
          </p>
        </div>
        <div>
          <span className="status-number green">7</span>
          <p>
            <strong>本月完成</strong>
            <small>已确认视频</small>
          </p>
        </div>
      </section>
      <section className="content-section" id="versions">
        <div className="section-heading">
          <div>
            <span className="kicker">成品夹 · 最新回传</span>
            <h2>你的最新成品</h2>
            <p>司机端只显示当前版本；历史版本由后台保存。</p>
          </div>
          <span className="pill pending">V1 · 待确认</span>
        </div>
        <article className="driver-finished">
          <VideoCover version={current} />
          <div>
            <span className="kicker">08-15 11:08 回传</span>
            <h3>大寅司机的一天</h3>
            <p>时长 {current.duration} · 竖屏 9:16 · 108 MB</p>
            <div>
              <button className="ghost-button" onClick={onRevise}>
                提出修改
              </button>
              <button
                className="solid-button"
                onClick={() => notify("成品已确认完成")}
              >
                确认完成
              </button>
            </div>
          </div>
        </article>
      </section>
      <nav className="mobile-nav">
        <button className="active">
          ⌂<span>首页</span>
        </button>
        <button>
          ◉<span>消息</span>
          <i />
        </button>
        <button>
          ♙<span>我的</span>
        </button>
      </nav>
    </div>
  );
}
function VideoCover({ version }: { version: (typeof versions)[number] }) {
  return (
    <div
      className={`video-cover cover-photo cover-${version.id.toLowerCase()}`}
      style={{ "--cover": version.color } as React.CSSProperties}
    >
      <span className="version-label">方案 {version.id}</span>
      <button aria-label={`播放方案${version.id}`}>▶</button>
      <time>{version.duration}</time>
    </div>
  );
}
function EditorView({ notify, session }: { notify: (m: string) => void; session: Session }) {
  const [panel, setPanel] = useState("assets");
  const [uploadOpen, setUploadOpen] = useState(false);
  const menu = (id: string, icon: string, label: string, count?: string) => (
    <button
      className={panel === id ? "active" : ""}
      onClick={() => setPanel(id)}
    >
      <span>{icon}</span>
      {label}
      {count && <b>{count}</b>}
    </button>
  );
  return (
    <div className="editor-layout">
      <aside className="sidebar">
        <div className="sidebar-label">文件空间</div>
        {menu("assets", "▦", "素材夹")}
        {menu("finished", "▱", "成品夹", "开发中")}
        <div className="sidebar-label lower">管理</div>
        {menu("drivers", "♙", "司机管理")}
        {menu("stats", "▥", "剪辑统计")}
        {menu("logs", "◌", "操作记录")}
        <div className="storage-card">
          <p>
            <span>存储空间</span>
            <strong>VPS</strong>
          </p>
          <div>
            <i />
          </div>
          <small>容量监控将在下一批接入</small>
        </div>
      </aside>
      <section className="editor-main">
        {panel === "assets" && (
          <AssetsPanel
            notify={notify}
            session={session}
          />
        )}
        {panel === "finished" && (
          <FinishedFolder
            onUpload={() => setUploadOpen(true)}
            notify={notify}
          />
        )}
        {panel === "drivers" && <DriversPanel notify={notify} />}
        {panel === "stats" && <StatsPanel />}
        {panel === "logs" && <LogsPanel />}
      </section>
      {uploadOpen && (
        <BatchVersionModal
          close={() => setUploadOpen(false)}
          done={() => {
            setUploadOpen(false);
            notify("最新成品已回传并通知王小明");
          }}
        />
      )}
    </div>
  );
}

function AssetsPanel({
  notify,
  session,
}: {
  notify: (m: string) => void;
  session: Session;
}) {
  const [packages, setPackages] = useState<DriverAssetPackage[]>([]);
  const [type, setType] = useState("全部");
  const [driverQuery, setDriverQuery] = useState("");
  const [sort, setSort] = useState<"time" | "type">("time");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [targetDriver, setTargetDriver] = useState("");
  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const result = await loadAssetPackages(session.token, sort);
      setPackages(result.items);
      setTargetDriver((current) => current || result.items[0]?.code || "");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "素材读取失败");
    } finally {
      setLoading(false);
    }
  }
  // Loading remote data is the synchronization performed by this effect.
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { void refresh(); }, [sort]);
  const visiblePackages = packages.filter((item) =>
    `${item.driver}${item.code}`.toLowerCase().includes(driverQuery.toLowerCase()),
  );
  const visible = visiblePackages.flatMap((item) =>
    item.files
      .filter((file) => type === "全部" || (type === "视频" ? file.media_type === "video" : file.media_type === "image"))
      .map((file) => ({ file, driver: item.driver, code: item.code })),
  );
  const totalBytes = packages.reduce((sum, item) => sum + item.sizeBytes, 0);
  const totalFiles = packages.reduce((sum, item) => sum + item.count, 0);
  async function handleUpload(file?: File) {
    if (!file || !targetDriver) return;
    try {
      notify(`正在上传：${file.name}`);
      await uploadAsset(session.token, file, targetDriver);
      notify(`上传完成：${file.name}`);
      await refresh();
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : "上传失败");
    }
  }
  return (
    <>
      <div className="editor-heading">
        <div>
          <span className="kicker">统一素材夹</span>
          <h1>所有司机上传的素材</h1>
          <p>司机是检索条件，不限制素材跨司机调用。</p>
        </div>
        <div className="web-upload-controls">
          <select value={targetDriver} onChange={(event) => setTargetDriver(event.target.value)} aria-label="选择素材所属司机">
            {packages.map((item) => <option key={item.code} value={item.code}>{item.driver} · {item.code}</option>)}
          </select>
          <label className="solid-button">＋ 上传素材<input type="file" accept="video/*,image/*" onChange={(event) => void handleUpload(event.target.files?.[0])} /></label>
        </div>
      </div>
      <div className="metric-grid">
        <Metric
          value={String(totalFiles)}
          label="素材总数"
          note={`${packages.length} 个司机素材包`}
          tone="coral"
        />
        <Metric value={String(packages.filter((item) => item.count > 0).length)} label="有素材司机" note="按司机固定一个包" tone="blue" />
        <Metric
          value={formatBytes(totalBytes)}
          label="素材占用"
          note="原文件未压缩"
          tone="amber"
        />
        <Metric value={loading ? "…" : "正常"} label="API 状态" note="数据来自 VPS" tone="green" />
      </div>
      <div className="folder-search">
        <div>
          <span>⌕</span>
          <input
            value={driverQuery}
            onChange={(e) => setDriverQuery(e.target.value)}
            placeholder="搜索司机姓名或编号，例如：王小明 / D023"
          />
          {driverQuery && <button onClick={() => setDriverQuery("")}>×</button>}
        </div>
        <p>
          {driverQuery
            ? `找到 ${visiblePackages.length} 个司机包、${visible.length} 个素材`
            : `当前显示 ${packages.length} 个司机素材包`}
        </p>
      </div>
      <div className="asset-panel">
        <div className="table-toolbar">
          <div>
            <h2>素材文件</h2>
            <p>点击缩略图可直接预览内容</p>
          </div>
          <div className="filters">
            {["全部", "视频", "图片"].map((x) => (
              <button
                key={x}
                className={type === x ? "active" : ""}
                onClick={() => setType(x)}
              >
                {x}
              </button>
            ))}
            <select value={sort} onChange={(event) => setSort(event.target.value as "time" | "type")} aria-label="素材排序">
              <option value="time">按上传时间</option>
              <option value="type">按文件类型</option>
            </select>
          </div>
        </div>
        {error && <div className="data-state error">{error}<button onClick={() => void refresh()}>重试</button></div>}
        {loading && <div className="data-state">正在读取 VPS 素材…</div>}
        <div className="asset-header">
          <span>预览 / 文件名</span>
          <span>上传司机</span>
          <span>类型</span>
          <span>大小</span>
          <span>上传时间</span>
          <span>操作</span>
        </div>
        {!loading && !error && visible.map(({ file, driver, code }) => (
          <div className="asset-row" key={file.id}>
            <div className="asset-file">
              <button
                className={`asset-thumb ${file.media_type === "video" ? "car" : "city"}`}
                onClick={() => void previewAsset(session.token, file).catch((reason) => notify(reason.message))}
              >
                <span>{file.media_type === "video" ? "▶" : "▧"}</span>
                <time>{file.media_type === "video" ? "视频" : "图片"}</time>
              </button>
              <div className="asset-title">
                <strong>{file.original_name}</strong>
                <small>
                  <i className="new" />真实文件
                </small>
              </div>
            </div>
            <div className="driver-cell">
              <span>{driver[0]}</span>
              <div>
                {driver}
                <small>{code}</small>
              </div>
            </div>
            <span
              className={`type-tag ${file.media_type === "video" ? "video" : "image"}`}
            >
              {file.media_type === "video" ? "视频" : file.media_type === "image" ? "图片" : "文件"}
            </span>
            <span>{formatBytes(file.size_bytes)}</span>
            <span>{formatTime(file.uploaded_at)}</span>
            <div className="asset-actions">
              <button onClick={() => void previewAsset(session.token, file).catch((reason) => notify(reason.message))}>
                预览
              </button>
              <button onClick={() => void downloadAsset(session.token, file).catch((reason) => notify(reason.message))}>↓</button>
            </div>
          </div>
        ))}
      </div>
      {!loading && !error && visible.length === 0 && <div className="data-state">当前筛选条件下还没有素材</div>}
    </>
  );
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 MB";
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  return `${(bytes / 1024 ** 2).toFixed(bytes < 10 * 1024 ** 2 ? 1 : 0)} MB`;
}

function formatTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function DriversPanel({ notify }: { notify: (m: string) => void }) {
  const rows = [
    ["王小明", "D023", "大阪营业所", "32 个", "08-15 10:42"],
    ["陈师傅", "D024", "京都营业所", "27 个", "08-15 09:18"],
    ["李师傅", "D025", "神户营业所", "18 个", "08-14 18:26"],
  ];
  return (
    <>
      <div className="editor-heading">
        <div>
          <span className="kicker">成员管理</span>
          <h1>司机账户</h1>
          <p>查看司机的上传数量与最近活动。</p>
        </div>
        <button
          className="solid-button"
          onClick={() => notify("新增司机窗口已打开（原型示意）")}
        >
          ＋ 新增司机
        </button>
      </div>
      <SimpleTable
        heads={["司机", "编号", "所属营业所", "素材数量", "最近上传"]}
        rows={rows}
      />
    </>
  );
}
function StatsPanel() {
  return (
    <>
      <div className="editor-heading">
        <div>
          <span className="kicker">工作统计</span>
          <h1>剪辑统计</h1>
          <p>一个成品由司机确认后计入完成数量。</p>
        </div>
      </div>
      <div className="metric-grid">
        <Metric value="28" label="本月完成" note="较上月 +6" tone="green" />
        <Metric value="21" label="一次通过" note="通过率 75%" tone="blue" />
        <Metric value="9" label="修改次数" note="平均 0.32 次" tone="amber" />
        <Metric value="18h" label="首次交稿" note="平均用时" tone="coral" />
      </div>
      <SimpleTable
        heads={["月份", "完成视频", "一次通过", "修改次数", "平均完成时间"]}
        rows={[
          ["2026年8月", "28", "21", "9", "26小时"],
          ["2026年7月", "22", "16", "11", "31小时"],
          ["2026年6月", "19", "13", "8", "29小时"],
        ]}
      />
    </>
  );
}
function LogsPanel() {
  return (
    <>
      <div className="editor-heading">
        <div>
          <span className="kicker">系统记录</span>
          <h1>操作记录</h1>
          <p>上传、预览、下载和成品回传都会保留记录。</p>
        </div>
      </div>
      <SimpleTable
        heads={["时间", "操作人", "动作", "文件", "结果"]}
        rows={[
          ["08-15 10:42", "王小明", "上传素材", "关西机场出发_01.MOV", "成功"],
          ["08-15 10:46", "剪辑师", "预览素材", "车辆清洁_02.MOV", "成功"],
          ["08-15 11:08", "剪辑师", "上传成品", "V2_日常叙事版.mp4", "成功"],
          ["08-15 11:15", "王小明", "选择版本", "方案 B", "已确认"],
        ]}
      />
    </>
  );
}
function SimpleTable({ heads, rows }: { heads: string[]; rows: string[][] }) {
  return (
    <div className="simple-table">
      <div>
        {heads.map((h) => (
          <strong key={h}>{h}</strong>
        ))}
      </div>
      {rows.map((row, i) => (
        <div key={i}>
          {row.map((cell, j) => (
            <span key={j}>{cell}</span>
          ))}
        </div>
      ))}
    </div>
  );
}
function FinishedFolder({
  onUpload,
  notify,
}: {
  onUpload: () => void;
  notify: (m: string) => void;
}) {
  const [query, setQuery] = useState("");
  const finished = [
    ...versions.map((v, i) => ({
      ...v,
      driver: "王小明",
      code: "D023",
      size: 82 + i * 14,
      date: "2026-08-15",
    })),
    {
      ...versions[0],
      id: "D",
      title: "京都早班成片",
      driver: "陈师傅",
      code: "D024",
      size: 126,
      date: "2026-08-14",
    },
    {
      ...versions[1],
      id: "E",
      title: "神户接送成片",
      driver: "李师傅",
      code: "D025",
      size: 104,
      date: "2026-08-13",
    },
  ];
  const shown = finished.filter((item) =>
    `${item.driver}${item.code}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="editor-heading">
        <div>
          <span className="kicker">统一成品夹</span>
          <h1>剪辑完成的视频</h1>
          <p>可以跨司机搜索、预览和调用已经完成的内容。</p>
        </div>
        <button className="solid-button" onClick={onUpload}>
          ＋ 上传多个成品
        </button>
      </div>
      <div className="folder-search">
        <div>
          <span>⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索司机姓名或编号，例如：陈师傅 / D024"
          />
          {query && <button onClick={() => setQuery("")}>×</button>}
        </div>
        <p>
          {query ? `找到 ${shown.length} 个对应成品` : `当前显示全部司机成品`}
        </p>
      </div>
      <div className="finished-grid">
        {shown.map((v, i) => (
          <article className="finished-card" key={v.id}>
            <VideoCover version={v} />
            <div>
              <h3>{v.title}</h3>
              <p>
                {v.driver} · {v.code} · {v.date} · {v.size} MB
              </p>
              <span className={`pill ${i === 1 ? "green" : "blue"}`}>
                {i === 1 ? "当前候选" : "可供调用"}
              </span>
              <button
                className="reuse-button"
                onClick={() => notify(`已选取${v.driver}的成品：${v.title}`)}
              >
                选取此成品
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
function Metric({
  value,
  label,
  note,
  tone,
}: {
  value: string;
  label: string;
  note: string;
  tone: string;
}) {
  return (
    <article className={`metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
      <i />
    </article>
  );
}
function UploadPanel({ close, done }: { close: () => void; done: () => void }) {
  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <section className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={close}>
          ×
        </button>
        <span className="kicker">公司统一素材夹</span>
        <h2>上传照片与视频</h2>
        <p>自动记录你的姓名、文件类型、大小和上传时间，不再创建日期素材包。</p>
        <div className="dropzone">
          <span>↑</span>
          <strong>点击选择或拖入文件</strong>
          <small>支持 MP4、MOV、JPG、PNG</small>
        </div>
        <div className="upload-files">
          <p>
            <span>关西机场出发_01.MOV</span>
            <strong>完成</strong>
          </p>
          <i>
            <b style={{ width: "100%" }} />
          </i>
          <p>
            <span>车辆清洁_02.MOV</span>
            <strong>72%</strong>
          </p>
          <i>
            <b style={{ width: "72%" }} />
          </i>
        </div>
        <button className="solid-button full" onClick={done}>
          上传到统一素材夹
        </button>
      </section>
    </div>
  );
}
function RevisionModal({
  close,
  done,
}: {
  close: () => void;
  done: () => void;
}) {
  const [issue, setIssue] = useState("删除镜头");
  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <section
        className="modal revision-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={close}>
          ×
        </button>
        <span className="kicker">当前成品 V1</span>
        <h2>提出修改要求</h2>
        <p>告诉剪辑师具体时间点和需要调整的内容。</p>
        <label className="field-label">问题类型</label>
        <div className="issue-types">
          {[
            "字幕修改",
            "更换音乐",
            "删除镜头",
            "画面打码",
            "视频太长",
            "其他",
          ].map((x) => (
            <button
              key={x}
              className={issue === x ? "active" : ""}
              onClick={() => setIssue(x)}
            >
              {x}
            </button>
          ))}
        </div>
        <div className="revision-fields">
          <label>
            <span>视频时间点</span>
            <input defaultValue="00:18" placeholder="例如 00:18" />
          </label>
          <label>
            <span>修改说明</span>
            <textarea defaultValue="这里出现了客人的正脸，请删除；结尾公司 Logo 再停留 2 秒。" />
          </label>
        </div>
        <div className="revision-tip">
          提交后，当前成品状态将变为“修改中”，剪辑师回传 V2 后会再次通知你。
        </div>
        <div className="modal-actions">
          <button className="ghost-button" onClick={close}>
            取消
          </button>
          <button className="solid-button" onClick={done}>
            提交修改要求
          </button>
        </div>
      </section>
    </div>
  );
}
function BatchVersionModal({
  close,
  done,
}: {
  close: () => void;
  done: () => void;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <section
        className="modal batch-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={close}>
          ×
        </button>
        <span className="kicker">统一成品夹</span>
        <h2>回传最新成品</h2>
        <p>每次只回传一个当前版本；新版本不会覆盖后台历史记录。</p>
        <div className="batch-person">
          <label>接收司机</label>
          <strong>王小明 · D023</strong>
        </div>
        <div className="batch-files">
          <div>
            <span className="file-icon">▶</span>
            <p>
              <strong>V1_大寅司机的一天.mp4</strong>
              <small>00:58 · 108 MB</small>
            </p>
            <label>当前版本</label>
            <button>×</button>
          </div>
        </div>
        <div className="modal-actions">
          <button className="ghost-button" onClick={close}>
            取消
          </button>
          <button className="solid-button" onClick={done}>
            回传并通知司机
          </button>
        </div>
      </section>
    </div>
  );
}
