"use client";
import { useMemo, useState } from "react";
type Mode = "driver" | "editor";
const assets = [
  {
    id: 1,
    name: "关西机场出发_01.MOV",
    driver: "王小明",
    code: "D023",
    type: "视频",
    size: "286 MB",
    time: "08-15 10:42",
    duration: "00:14",
    tone: "airport",
    status: "新上传",
  },
  {
    id: 2,
    name: "车辆清洁_02.MOV",
    driver: "王小明",
    code: "D023",
    type: "视频",
    size: "418 MB",
    time: "08-15 10:39",
    duration: "00:21",
    tone: "car",
    status: "新上传",
  },
  {
    id: 3,
    name: "大阪城_司机视角.jpg",
    driver: "陈师傅",
    code: "D024",
    type: "图片",
    size: "8.4 MB",
    time: "08-15 09:18",
    duration: "JPG",
    tone: "city",
    status: "已查看",
  },
  {
    id: 4,
    name: "机场等待区_03.MP4",
    driver: "李师傅",
    code: "D025",
    type: "视频",
    size: "172 MB",
    time: "08-14 18:26",
    duration: "00:09",
    tone: "terminal",
    status: "已下载",
  },
  {
    id: 5,
    name: "营业所点呼_04.MOV",
    driver: "陈师傅",
    code: "D024",
    type: "视频",
    size: "351 MB",
    time: "08-14 17:51",
    duration: "00:18",
    tone: "office",
    status: "已查看",
  },
  {
    id: 6,
    name: "车内整备完成.jpg",
    driver: "王小明",
    code: "D023",
    type: "图片",
    size: "6.7 MB",
    time: "08-14 16:33",
    duration: "JPG",
    tone: "interior",
    status: "已下载",
  },
];
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
function LoginScreen({ enter }: { enter: (mode: Mode) => void }) {
  const [user, setUser] = useState("admin");
  const [password, setPassword] = useState("Daitora1028");
  const [error, setError] = useState("");
  function login(event: React.FormEvent) {
    event.preventDefault();
    if (user === "admin" && password === "Daitora1028") enter("editor");
    else setError("账号或密码不正确");
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
          <button className="login-submit" type="submit">进入剪辑工作台</button>
        </form>
        <button className="driver-demo" onClick={() => enter("driver")}>查看司机端演示</button>
        <small>演示账号：admin　密码：Daitora1028</small>
      </section>
    </main>
  );
}
export default function Home() {
  const [authenticated, setAuthenticated] = useState(false);
  const [mode, setMode] = useState<Mode>("driver");
  const [toast, setToast] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showRevision, setShowRevision] = useState(false);
  function notify(m: string) {
    setToast(m);
    window.setTimeout(() => setToast(null), 2600);
  }
  if (!authenticated) return <LoginScreen enter={(next) => { setMode(next); setAuthenticated(true); }} />;
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
        <div className="mode-switch">
          <button
            className={mode === "driver" ? "active" : ""}
            onClick={() => setMode("driver")}
          >
            司机端
          </button>
          <button
            className={mode === "editor" ? "active" : ""}
            onClick={() => setMode("editor")}
          >
            剪辑师端
          </button>
        </div>
        <div className="profile">
          <span className="avatar">{mode === "driver" ? "王" : "剪"}</span>
          <div>
            <strong>{mode === "driver" ? "王小明" : "剪辑工作台"}</strong>
            <span>{mode === "driver" ? "司机 D023" : "唯一剪辑账户"}</span>
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
        <EditorView notify={notify} />
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
function EditorView({ notify }: { notify: (m: string) => void }) {
  const [panel, setPanel] = useState("assets");
  const [type, setType] = useState("全部");
  const [assetDriver, setAssetDriver] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const visible = useMemo(
    () =>
      assets.filter(
        (a) =>
          (type === "全部" || a.type === type) &&
          `${a.driver}${a.code}`
            .toLowerCase()
            .includes(assetDriver.toLowerCase()),
      ),
    [type, assetDriver],
  );
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
        {menu("assets", "▦", "素材夹", "86")}
        {menu("finished", "▱", "成品夹", "28")}
        <div className="sidebar-label lower">管理</div>
        {menu("drivers", "♙", "司机管理")}
        {menu("stats", "▥", "剪辑统计")}
        {menu("logs", "◌", "操作记录")}
        <div className="storage-card">
          <p>
            <span>存储空间</span>
            <strong>28%</strong>
          </p>
          <div>
            <i />
          </div>
          <small>已使用 284 GB / 1 TB</small>
        </div>
      </aside>
      <section className="editor-main">
        {panel === "assets" && (
          <AssetsPanel
            visible={visible}
            type={type}
            setType={setType}
            driverQuery={assetDriver}
            setDriverQuery={setAssetDriver}
            notify={notify}
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
  visible,
  type,
  setType,
  driverQuery,
  setDriverQuery,
  notify,
}: {
  visible: typeof assets;
  type: string;
  setType: (v: string) => void;
  driverQuery: string;
  setDriverQuery: (v: string) => void;
  notify: (m: string) => void;
}) {
  return (
    <>
      <div className="editor-heading">
        <div>
          <span className="kicker">统一素材夹</span>
          <h1>所有司机上传的素材</h1>
          <p>司机是检索条件，不限制素材跨司机调用。</p>
        </div>
        <button
          className="solid-button"
          onClick={() => notify("已开始打包下载所选素材")}
        >
          下载所选
        </button>
      </div>
      <div className="metric-grid">
        <Metric
          value="86"
          label="素材总数"
          note="视频 68 · 图片 18"
          tone="coral"
        />
        <Metric value="14" label="今天新增" note="来自 5 名司机" tone="blue" />
        <Metric
          value="24.8"
          label="占用空间 GB"
          note="原文件未压缩"
          tone="amber"
        />
        <Metric value="6" label="未查看" note="最新上传内容" tone="green" />
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
            ? `找到 ${visible.length} 个对应素材`
            : `当前显示全部司机素材`}
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
          </div>
        </div>
        <div className="asset-header">
          <span>预览 / 文件名</span>
          <span>上传司机</span>
          <span>类型</span>
          <span>大小</span>
          <span>上传时间</span>
          <span>操作</span>
        </div>
        {visible.map((a) => (
          <div className="asset-row" key={a.id}>
            <div className="asset-file">
              <button
                className={`asset-thumb ${a.tone}`}
                onClick={() => notify(`正在预览：${a.name}`)}
              >
                <span>{a.type === "视频" ? "▶" : "▧"}</span>
                <time>{a.duration}</time>
              </button>
              <div className="asset-title">
                <strong>{a.name}</strong>
                <small>
                  <i className={a.status === "新上传" ? "new" : ""} />
                  {a.status}
                </small>
              </div>
            </div>
            <div className="driver-cell">
              <span>{a.driver[0]}</span>
              <div>
                {a.driver}
                <small>{a.code}</small>
              </div>
            </div>
            <span
              className={`type-tag ${a.type === "视频" ? "video" : "image"}`}
            >
              {a.type}
            </span>
            <span>{a.size}</span>
            <span>{a.time}</span>
            <div className="asset-actions">
              <button onClick={() => notify(`正在预览：${a.name}`)}>
                预览
              </button>
              <button onClick={() => notify(`开始下载：${a.name}`)}>↓</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
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
