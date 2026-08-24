"use client";
import { useCallback, useEffect, useState } from "react";
import {
  downloadAsset,
  downloadFinishedProduct,
  downloadPackage,
  loadLibraryAssets,
  loadLatestFinishedProduct,
  loadAssetPreviewUrl,
  loadMaterialPackages,
  loadMe,
  loadFinishedProducts,
  loadRevisions,
  loadUploadUsers,
  loadAdminOverview,
  loadAdminAccounts,
  createAdminAccount,
  updateAdminAccount,
  resetAdminPassword,
  revokeAdminSessions,
  loadAdminAnomalies,
  loadAdminStorage,
  loadAuditLogs,
  uploadFinishedProduct,
  transitionPackage,
  login as apiLogin,
  updateProfile,
  type LibraryAsset,
  type FinishedProduct,
  type Session,
  type MaterialPackage,
  type AdminAccount,
  type AdminOverview,
  type AdminAnomaly,
  type AdminStorage,
} from "./api";
type Mode = "driver" | "editor";
type Cover = { id: string; title: string; duration: string; note: string; color: string };
function BrandMark() {
  return <span className="brand-mark">D</span>;
}
function LoginScreen({ enter }: { enter: (session: Session) => void }) {
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
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
        <p>剪辑师与管理员使用网页端；日常素材上传建议使用微信小程序。</p>
        <form onSubmit={login}>
          <label>账号<input placeholder="输入用户名" value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" /></label>
          <label>密码<input placeholder="输入密码" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>
          {error && <div className="login-error">{error}</div>}
          <button className="login-submit" type="submit" disabled={busy}>{busy ? "正在验证…" : "登录工作台"}</button>
        </form>
        <small>系统会根据账号权限自动进入对应工作台。</small>
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
  const [showProfile, setShowProfile] = useState(false);
  const notify = useCallback((m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 2600);
  }, []);
  useEffect(() => {
    if (!session?.token) return;
    loadMe(session.token).then(user => {
      setSession(current => {
        if (!current) return current;
        const next = { ...current, user };
        localStorage.setItem("daitora-session", JSON.stringify(next));
        return next;
      });
    }).catch(() => {
      localStorage.removeItem("daitora-session");
      setSession(null);
    });
  }, [session?.token]);
  useEffect(() => {
    if (!session) return;
    const target = session.user.role === "admin" ? "/admin" : "/";
    if (window.location.pathname !== target) window.history.replaceState({}, "", target);
  }, [session]);
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
        <div className="mode-switch"><button className="active">{mode === "driver" ? "素材中心" : session.user.role === "admin" ? "管理端" : "剪辑工作台"}</button></div>
        <div className="profile">
          <span className="avatar">{session.user.name[0]}</span>
          <div>
            <strong>{session.user.name}</strong>
            {mode === "driver" && <button className="logout-button" onClick={() => setShowProfile(true)}>我的资料</button>}
            <button className="logout-button" onClick={() => { localStorage.removeItem("daitora-session"); setSession(null); }}>退出登录</button>
          </div>
        </div>
      </header>
      {session.user.role === "admin" ? (
        <AdminView session={session} notify={notify} />
      ) : mode === "driver" ? (
        <DriverView
          session={session}
          onProfile={() => setShowProfile(true)}
          notify={notify}
        />
      ) : (
        <EditorView notify={notify} session={session} />
      )}{" "}
      {showProfile && (
        <ProfileModal
          session={session}
          close={() => setShowProfile(false)}
          saved={(user) => {
            const next = { ...session, user };
            localStorage.setItem("daitora-session", JSON.stringify(next));
            setSession(next);
            setShowProfile(false);
            notify("姓名已更新");
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
type AdminPanel = "overview" | "accounts" | "content" | "anomalies" | "logs" | "storage";
function AdminView({session,notify}:{session:Session;notify:(message:string)=>void}) {
  const [panel,setPanel]=useState<AdminPanel>("overview");
  const labels:Array<[AdminPanel,string]>=[["overview","概览"],["accounts","账号管理"],["content","素材与成品"],["anomalies","异常任务"],["logs","操作记录"],["storage","存储与备份"]];
  return <div className="admin-layout"><aside className="admin-sidebar"><div><span className="kicker">ADMIN</span><h2>管理端</h2></div>{labels.map(([key,label])=><button key={key} className={panel===key?"active":""} onClick={()=>setPanel(key)}>{label}</button>)}</aside><section className="admin-main">
    {panel==="overview"&&<AdminOverviewPanel token={session.token} notify={notify}/>}
    {panel==="accounts"&&<AdminAccountsPanel session={session} notify={notify}/>}
    {panel==="content"&&<AdminContentPanel token={session.token} notify={notify}/>}
    {panel==="anomalies"&&<AdminAnomaliesPanel token={session.token} notify={notify}/>}
    {panel==="logs"&&<AdminLogsPanel token={session.token} notify={notify}/>}
    {panel==="storage"&&<AdminStoragePanel token={session.token} notify={notify}/>}
  </section></div>;
}
function AdminHeading({title,note,action}:{title:string;note:string;action?:React.ReactNode}){return <div className="admin-heading"><div><span className="kicker">Daitora Vlog Box</span><h1>{title}</h1><p>{note}</p></div>{action}</div>}
function AdminOverviewPanel({token,notify}:{token:string;notify:(m:string)=>void}){
  const [data,setData]=useState<AdminOverview|null>(null);const [error,setError]=useState("");
  useEffect(()=>{loadAdminOverview(token).then(setData).catch(e=>{setError(e.message);notify(e.message)})},[token,notify]);
  return <><AdminHeading title="概览" note="仅显示来自生产数据库的实时口径。"/>{error&&<div className="data-state error">{error}</div>}{!data?<div className="data-state">正在读取…</div>:<div className="admin-summary"><div><span>账号</span><strong>{data.activeAccounts}/{data.accounts}</strong></div><div><span>素材包</span><strong>{data.packages}</strong></div><div><span>素材文件</span><strong>{data.assets}</strong></div><div><span>成品</span><strong>{data.products}</strong></div><div><span>上传异常</span><strong>{data.uploadExceptions}</strong></div></div>}</>;
}
function AdminAccountsPanel({session,notify}:{session:Session;notify:(m:string)=>void}){
  const [items,setItems]=useState<AdminAccount[]>([]);const [query,setQuery]=useState("");const [role,setRole]=useState("");const [status,setStatus]=useState("");const [loading,setLoading]=useState(true);
  const refresh=useCallback(async()=>{setLoading(true);try{const result=await loadAdminAccounts(session.token,{...(query?{query}:{}),...(role?{role}:{}),...(status?{status}:{})});setItems(result.items)}catch(e){notify(e instanceof Error?e.message:"账号读取失败")}finally{setLoading(false)}},[session.token,query,role,status,notify]);
  useEffect(()=>{loadAdminAccounts(session.token,{...(query?{query}:{}),...(role?{role}:{}),...(status?{status}:{})}).then(result=>setItems(result.items)).catch(e=>notify(e.message)).finally(()=>setLoading(false))},[session.token,query,role,status,notify]);
  async function create(){const account=window.prompt("输入新账号");if(!account)return;const displayName=window.prompt("输入显示名称");if(!displayName)return;const choices=session.user.isSuperAdmin?"UPLOADER / EDITOR / ADMIN":"UPLOADER / EDITOR";const selected=window.prompt(`输入角色：${choices}`,"UPLOADER")?.toUpperCase();if(!selected)return;if(!window.confirm(`确认创建 ${account}（${selected}）？`))return;try{const result=await createAdminAccount(session.token,{account,displayName,role:selected});window.alert(`临时密码（仅显示一次）：${result.temporaryPassword}`);await refresh()}catch(e){notify(e instanceof Error?e.message:"创建失败")}}
  async function rename(item:AdminAccount){const displayName=window.prompt("输入新的显示名称",item.displayName);if(!displayName||displayName===item.displayName)return;if(!window.confirm(`确认修改 ${item.account} 的显示名称？`))return;try{await updateAdminAccount(session.token,item.id,{displayName});await refresh()}catch(e){notify(e instanceof Error?e.message:"修改失败")}}
  async function toggle(item:AdminAccount){if(!window.confirm(`确认${item.active?"停用":"启用"}账号 ${item.account}？历史数据不会删除。`))return;try{await updateAdminAccount(session.token,item.id,{active:!item.active});await refresh()}catch(e){notify(e instanceof Error?e.message:"状态修改失败")}}
  async function reset(item:AdminAccount){if(!window.confirm(`确认重置 ${item.account} 的密码并撤销现有会话？`))return;try{const result=await resetAdminPassword(session.token,item.id);window.alert(`临时密码（仅显示一次）：${result.temporaryPassword}`);await refresh()}catch(e){notify(e instanceof Error?e.message:"重置失败")}}
  async function revoke(item:AdminAccount){if(!window.confirm(`确认强制退出 ${item.account}？`))return;try{const result=await revokeAdminSessions(session.token,item.id);notify(`已撤销 ${result.revokedSessions} 个会话`)}catch(e){notify(e instanceof Error?e.message:"撤销失败")}}
  return <><AdminHeading title="账号管理" note="停用账号不会删除其素材、成品或历史归属。" action={<button className="solid-button" onClick={()=>void create()}>新增账号</button>}/><div className="admin-filters"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索账号或显示名"/><select value={role} onChange={e=>setRole(e.target.value)}><option value="">全部角色</option><option value="UPLOADER">上传用户</option><option value="EDITOR">剪辑师</option><option value="ADMIN">管理员</option></select><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">全部状态</option><option value="active">启用</option><option value="disabled">停用</option></select></div>{loading?<div className="data-state">正在读取账号…</div>:<div className="admin-table"><div className="admin-table-head"><span>账号 / 显示名</span><span>角色</span><span>状态</span><span>最后登录</span><span>素材 / 成品</span><span>操作</span></div>{items.map(item=><div className="admin-table-row" key={item.id}><span><strong>{item.displayName}</strong><small>{item.account}</small></span><span>{item.isSuperAdmin?"超级管理员":item.role==="UPLOADER"?"上传用户":item.role==="EDITOR"?"剪辑师":"管理员"}</span><span>{item.active?"启用":"停用"}{item.mustChangePassword&&<small>首次登录需改密</small>}</span><span>{formatTime(item.lastLoginAt)}</span><span>{item.assetCount} / {item.productCount}</span><span className="admin-row-actions"><button onClick={()=>void rename(item)}>改名</button><button onClick={()=>void toggle(item)}>{item.active?"停用":"启用"}</button><button onClick={()=>void reset(item)}>重置密码</button><button onClick={()=>void revoke(item)}>强制退出</button></span></div>)}</div>}</>;
}
function AdminContentPanel({token,notify}:{token:string;notify:(m:string)=>void}){
  const [packages,setPackages]=useState<MaterialPackage[]>([]);const [products,setProducts]=useState<FinishedProduct[]>([]);const [query,setQuery]=useState("");
  useEffect(()=>{Promise.all([loadMaterialPackages(token,{query,sort:"newest",page_size:"100"}),loadFinishedProducts(token,query)]).then(([p,f])=>{setPackages(p.items);setProducts(f.items)}).catch(e=>notify(e.message))},[token,query,notify]);
  return <><AdminHeading title="素材与成品" note="默认只读；素材包、上传账号与成品绑定关系来自服务器。"/><div className="admin-filters"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索账号或素材包"/></div><h2 className="admin-section-title">素材包</h2><div className="admin-table"><div className="admin-table-head compact"><span>素材包</span><span>上传账号</span><span>状态</span><span>文件</span></div>{packages.map(item=><div className="admin-table-row compact" key={item.id}><span><strong>{item.title}</strong><small>{item.effectiveDate}</small></span><span>{item.driver}<small>{item.driverCode}</small></span><span>{item.status}</span><span>{item.fileCount}</span></div>)}</div><h2 className="admin-section-title">成品</h2><div className="admin-table"><div className="admin-table-head compact"><span>成品</span><span>所属素材包</span><span>接收账号</span><span>版本</span></div>{products.map(item=><div className="admin-table-row compact" key={item.id}><span>{item.title}</span><span>{item.packageTitle||"—"}</span><span>{item.driver}<small>{item.driverCode}</small></span><span>V{item.versionNumber||1}</span></div>)}</div></>;
}
function AdminAnomaliesPanel({token,notify}:{token:string;notify:(m:string)=>void}){const [items,setItems]=useState<AdminAnomaly[]>([]);const [unowned,setUnowned]=useState(0);useEffect(()=>{loadAdminAnomalies(token).then(r=>{setItems(r.items);setUnowned(r.unownedAssets)}).catch(e=>notify(e.message))},[token,notify]);return <><AdminHeading title="异常任务" note="只列出需要人工关注的真实任务；恢复操作将在确认根因后进行。"/><div className="data-state">无归属文件：{unowned}</div><div className="admin-table"><div className="admin-table-head compact"><span>任务</span><span>账号</span><span>异常</span><span>更新时间</span></div>{items.map(item=><div className="admin-table-row compact" key={item.id}><span>{item.title}</span><span>{item.display_name}<small>{item.account}</small></span><span>{item.anomaly}</span><span>{formatTime(item.updated_at)}</span></div>)}</div>{!items.length&&<div className="data-state">当前没有异常任务。</div>}</>}
function AdminLogsPanel({token,notify}:{token:string;notify:(m:string)=>void}){const [items,setItems]=useState<Array<{id:number;action:string;object_type:string;object_id:number|null;detail:string;created_at:string;account:string;actor:string;result?:string;ip_address?:string}>>([]);const [query,setQuery]=useState("");useEffect(()=>{loadAuditLogs(token,query).then(r=>setItems(r.items)).catch(e=>notify(e.message))},[token,query,notify]);return <><AdminHeading title="操作记录" note="登录、账号管理、上传下载和工作流操作均来自审计表。"/><div className="admin-filters"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索操作者或详情"/></div><div className="admin-table"><div className="admin-table-head compact"><span>时间</span><span>操作者</span><span>动作</span><span>对象 / 结果</span></div>{items.map(item=><div className="admin-table-row compact" key={item.id}><span>{formatTime(item.created_at)}</span><span>{item.actor}<small>{item.account}</small></span><span>{item.action}</span><span>{item.object_type} #{item.object_id||"—"}<small>{item.result||"success"} · {item.detail||"—"}</small></span></div>)}</div></>}
function AdminStoragePanel({token,notify}:{token:string;notify:(m:string)=>void}){const [data,setData]=useState<AdminStorage|null>(null);useEffect(()=>{loadAdminStorage(token).then(setData).catch(e=>notify(e.message))},[token,notify]);return <><AdminHeading title="存储与备份" note="容量来自服务器磁盘；没有备份记录时明确显示未记录。"/>{!data?<div className="data-state">正在读取…</div>:<><div className={`storage-meter ${data.thresholdLevel}`}><strong>{data.usedPercent}%</strong><span>已用 {formatBytes(data.usedBytes)} / {formatBytes(data.totalBytes)} · 剩余 {formatBytes(data.freeBytes)}</span></div><h2 className="admin-section-title">按账号占用</h2><div className="admin-table"><div className="admin-table-head compact"><span>显示名</span><span>账号</span><span>占用</span><span></span></div>{data.byAccount.map(item=><div className="admin-table-row compact" key={item.account}><span>{item.display_name}</span><span>{item.account}</span><span>{formatBytes(item.size_bytes)}</span><span></span></div>)}</div><div className="backup-state"><strong>最近备份</strong>{data.latestBackup?<span>{data.latestBackup.status} · {formatTime(data.latestBackup.finished_at||data.latestBackup.started_at)}</span>:<span>系统尚未记录可验证的备份运行结果</span>}</div></>}</>}
function DriverView({
  session,
  onProfile,
  notify,
}: {
  session: Session;
  onProfile: () => void;
  notify: (m: string) => void;
}) {
  const [product, setProduct] = useState<FinishedProduct | null>(null);
  const [productLoading, setProductLoading] = useState(true);
  useEffect(() => {
    loadLatestFinishedProduct(session.token)
      .then((result) => setProduct(result.item))
      .catch((reason) => notify(reason instanceof Error ? reason.message : "成品读取失败"))
      .finally(() => setProductLoading(false));
  }, [session.token, notify]);
  return (
    <div className="driver-layout">
      <section className="driver-hero">
        <div className="eyebrow">
          <span className="live-dot" /> 今日素材
        </div>
        <h1>{session.user.name}，今天拍了什么？</h1>
        <p>把视频传上来，剩下的交给剪辑师。</p>
        <div className="primary-actions">
          <button className="upload-action" onClick={() => notify("请在微信小程序中上传原始素材") }>
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
              <small>{product ? "1 个最新成品等待确认" : "暂无新成品"}</small>
            </span>
            <b>›</b>
          </button>
        </div>
      </section>
      <section className="content-section" id="versions">
        <div className="section-heading">
          <div>
            <span className="kicker">成品夹 · 最新回传</span>
            <h2>你的最新成品</h2>
            <p>当前账号只显示最新版本；历史版本由后台保存。</p>
          </div>
          {product && <span className="pill pending">V{product.versionNumber || 1} · 待确认</span>}
        </div>
        {productLoading && <div className="data-state">正在读取最新成品…</div>}
        {!productLoading && !product && <div className="finished-empty"><strong>暂时没有新成品</strong><span>剪辑师回传后会显示在这里。</span></div>}
        {product && <article className="driver-finished">
          <VideoCover version={{ id: String(product.id), title: product.title, duration: "视频", note: product.originalName, color: "#2767e8" }} />
          <div>
            <span className="kicker">最新回传</span>
            <h3>{product.title}</h3>
            <p>{product.originalName} · {(product.sizeBytes / 1024 / 1024).toFixed(1)} MB</p>
            <div>
              <button className="ghost-button" onClick={() => notify("请在微信小程序中提交时间点和修改内容") }>
                提出修改
              </button>
              <button
                className="solid-button"
                onClick={() => void downloadFinishedProduct(session.token, product).catch((reason) => notify(reason.message))}
              >
                下载成品
              </button>
            </div>
          </div>
        </article>}
      </section>
      <nav className="mobile-nav"><button onClick={onProfile}>♙<span>我的资料</span></button></nav>
    </div>
  );
}

function ProfileModal({ session, close, saved }: { session: Session; close: () => void; saved: (user: Session["user"]) => void }) {
  const [name, setName] = useState(session.user.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    try {
      saved(await updateProfile(session.token, name));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存失败");
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop"><form className="modal" onSubmit={submit}>
      <button className="modal-close" type="button" onClick={close}>×</button>
      <span className="kicker">我的资料</span><h2>修改姓名</h2>
      <label className="field-label">用户名</label>
      <input value={session.user.id} disabled />
      <label className="field-label">显示姓名</label>
      <input value={name} onChange={(event) => setName(event.target.value)} maxLength={30} placeholder="输入姓名" />
      {error && <div className="data-state error">{error}</div>}
      <div className="modal-actions"><button className="ghost-button" type="button" onClick={close}>取消</button><button className="solid-button" disabled={busy}>{busy ? "保存中…" : "保存资料"}</button></div>
    </form></div>
  );
}
function VideoCover({ version }: { version: Cover }) {
  return (
    <div
      className="video-cover finished-product-cover"
      style={{ "--cover": version.color } as React.CSSProperties}
    >
      <span className="version-label">成品</span>
      <span className="finished-product-play" aria-hidden="true">▶</span>
      <strong>{version.title}</strong>
      <time>{version.duration}</time>
    </div>
  );
}
function EditorView({ notify, session }: { notify: (m: string) => void; session: Session }) {
  const [panel, setPanel] = useState("assets");
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
        <div className="sidebar-label">剪辑工作</div>
        {menu("assets", "▦", "待处理")}
        {menu("materials", "▤", "素材库 / 任务详情")}
        {menu("finished", "▱", "成品记录")}
      </aside>
      <section className="editor-main">
        {panel === "assets" && (
          <TaskBoard notify={notify} session={session} />
        )}
        {panel === "materials" && <AssetsPanel notify={notify} session={session} />}
        {panel === "finished" && (
          <FinishedFolder
            notify={notify}
            session={session}
          />
        )}
      </section>
    </div>
  );
}

const statusText: Record<string,string>={PENDING_EDIT:"待剪辑",EDITING:"剪辑中",REVISION_REQUESTED:"待修改",REVISING:"修改中",PENDING_REVIEW:"待用户确认",COMPLETED:"已完成"};
function TaskBoard({notify,session}:{notify:(m:string)=>void;session:Session}) {
  const [items,setItems]=useState<MaterialPackage[]>([]); const [status,setStatus]=useState(""); const [query,setQuery]=useState(""); const [loading,setLoading]=useState(true);
  async function refresh(){setLoading(true);try{const p=await loadMaterialPackages(session.token,{...(status?{status}:{}),...(query?{query}:{}),page_size:"100"});setItems(p.items.filter(item=>["PENDING_EDIT","EDITING","REVISION_REQUESTED","REVISING","PENDING_REVIEW"].includes(item.status)))}catch(e){notify(e instanceof Error?e.message:"任务读取失败")}finally{setLoading(false)}}
  // Remote task data is synchronized whenever filters change.
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(()=>{void refresh()},[status,query]);
  async function act(id:number,action:"start-editing"|"start-revision"){try{await transitionPackage(session.token,id,action);notify("任务状态已更新");await refresh()}catch(e){notify(e instanceof Error?e.message:"操作失败")}}
  async function upload(item:MaterialPackage,file?:File){if(!file)return;notify(`回传给：${item.driverCode}`);try{const result=await uploadFinishedProduct(session.token,item.id,file,item.title);notify(`回传成功：${result.ownerAccount} · V${result.versionNumber}`);await refresh()}catch(e){notify(e instanceof Error?e.message:"成品回传失败")}}
  return <><div className="editor-heading"><div><span className="kicker">待处理</span><h1>剪辑任务</h1><p>按素材包处理下载、剪辑、修改和确认。</p></div></div><div className="folder-search"><div><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索上传账号或素材包"/></div><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">待处理全部</option>{Object.entries(statusText).filter(([v])=>["PENDING_EDIT","EDITING","REVISION_REQUESTED","REVISING","PENDING_REVIEW"].includes(v)).map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></div><div className="asset-panel"><div className="table-toolbar"><div><h2>任务队列</h2><p>{loading?"正在读取…":`${items.length} 个任务`}</p></div></div>{!loading&&items.map(item=><div className="asset-row task-row" key={item.id}><div className="asset-title"><strong>{item.title}</strong><small>上传账号 {item.driverCode} · 拍摄日期 {item.shootDate}</small></div><div>{item.fileCount} 个文件</div><div>{formatBytes(item.sizeBytes)}</div><div>{formatTime(item.submittedAt||item.createdAt)}</div><div><span className="status-badge">{statusText[item.status]||item.status}</span></div><div className="row-actions">{item.status==="PENDING_EDIT"&&<button onClick={()=>void act(item.id,"start-editing")}>开始剪辑</button>}{item.status==="REVISION_REQUESTED"&&<button onClick={()=>void act(item.id,"start-revision")}>开始修改</button>}{["EDITING","REVISING"].includes(item.status)&&<label className="solid-button return-product">回传给：{item.driverCode}<input type="file" accept="video/*" onChange={e=>void upload(item,e.target.files?.[0])}/></label>}</div></div>)}{!loading&&!items.length&&<div className="data-state">当前没有待处理任务</div>}</div></>
}

function AssetsPanel({notify,session}:{notify:(m:string)=>void;session:Session}) {
  const [mode,setMode]=useState<"folders"|"files">("folders");
  const [users,setUsers]=useState<Array<{account:string;display_name:string;package_count:number;asset_count:number}>>([]);
  const [user,setUser]=useState(""); const [packages,setPackages]=useState<MaterialPackage[]>([]); const [packageId,setPackageId]=useState("");
  const [assets,setAssets]=useState<LibraryAsset[]>([]);
  const [filters,setFilters]=useState({date_from:"",date_to:"",theme:"",location:"",media_type:"",orientation:"",tag:"",status:"",query:"",sort:"newest"});
  const [loading,setLoading]=useState(true); const [error,setError]=useState("");
  const [preview,setPreview]=useState<LibraryAsset|null>(null);
  const selectedPackage=packages.find(item=>String(item.id)===packageId);
  useEffect(()=>{loadUploadUsers(session.token).then(r=>setUsers(r.items)).catch(e=>notify(e instanceof Error?e.message:"用户读取失败"))},[session.token,notify]);
  useEffect(()=>{loadMaterialPackages(session.token,{...(user?{driver_id:user}:{}),sort:"newest",page_size:"100"}).then(r=>setPackages(r.items)).catch(e=>notify(e instanceof Error?e.message:"素材包读取失败"))},[session.token,user,notify]);
  const queryAssets=useCallback(async()=>{try{const params={...Object.fromEntries(Object.entries(filters).filter(([,v])=>v)),...(mode==="folders"&&packageId?{package_id:packageId}:{}),...(mode==="files"&&user?{driver_id:user}:{})};const result=await loadLibraryAssets(session.token,params);setError("");setAssets(result.items)}catch(e){setError(e instanceof Error?e.message:"素材读取失败")}finally{setLoading(false)}},[filters,mode,packageId,user,session.token]);
  // Remote query synchronization; state updates occur only after the request settles.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>{void queryAssets()},[queryAssets]);
  function changeFilter(name:string,value:string){setFilters(current=>({...current,[name]:value}))}
  const assetFile=(asset:LibraryAsset)=>({id:asset.id,original_name:asset.original_name,media_type:asset.media_type,mime_type:asset.mime_type,size_bytes:asset.size_bytes,uploaded_at:asset.uploaded_at});
  async function packageAction(action:"start-editing"|"start-revision"){if(!selectedPackage)return;try{await transitionPackage(session.token,selectedPackage.id,action);notify("任务状态已更新")}catch(e){notify(e instanceof Error?e.message:"操作失败")}}
  async function returnProduct(file?:File){if(!file||!selectedPackage)return;notify(`回传给：${selectedPackage.driverCode}`);try{const result=await uploadFinishedProduct(session.token,selectedPackage.id,file,selectedPackage.title);notify(`回传成功：${result.ownerAccount} · V${result.versionNumber}`)}catch(e){notify(e instanceof Error?e.message:"回传失败")}}
  return <>
    <div className="editor-heading"><div><span className="kicker">企业素材库</span><h1>素材库</h1><p>分清上传账号、素材包日期与文件真实上传时间。</p></div><div className="mode-switch library-modes"><button className={mode==="folders"?"active":""} onClick={()=>setMode("folders")}>文件夹模式</button><button className={mode==="files"?"active":""} onClick={()=>setMode("files")}>全部文件模式</button></div></div>
    <div className="library-users"><button className={!user?"active":""} onClick={()=>{setUser("");setPackageId("")}}>全部用户</button>{users.map(item=><button key={item.account} className={user===item.account?"active":""} onClick={()=>{setUser(item.account);setPackageId("")}}><strong>{item.display_name}</strong><span>{item.account} · {item.package_count} 包 · {item.asset_count} 文件</span></button>)}</div>
    {mode==="folders"&&<div className="package-browser"><div className="table-toolbar"><div><h2>{user?"选择素材包":"选择上传账号"}</h2><p>进入具体素材包后下载、预览或回传成品。</p></div></div>{user&&packages.map(item=><button key={item.id} className={`package-folder ${packageId===String(item.id)?"active":""}`} onClick={()=>setPackageId(String(item.id))}><span className="date-tile blue"><strong>{item.effectiveDate?.slice(5)||"—"}</strong><small>{item.dateSource==="shoot_date"?"拍摄日期":"上传日期"}</small></span><span><strong>{item.title}</strong><small>上传账号 {item.driverCode} · {item.theme} · {item.fileCount} 个文件</small></span></button>)}</div>}
    {mode==="files"&&<div className="folder-search"><div><span>⌕</span><input value={filters.query} onChange={e=>changeFilter("query",e.target.value)} placeholder="搜索上传账号、素材包或文件"/></div></div>}
    <div className="asset-panel library-asset-panel"><div className="table-toolbar"><div><h2>{mode==="folders"?(packageId?selectedPackage?.title:"请选择素材包"):"全部文件"}</h2><p>{assets.length} 个文件{selectedPackage?` · 回传给：${selectedPackage.driverCode}`:""}</p></div>{selectedPackage&&<div className="row-actions"><button onClick={()=>void downloadPackage(session.token,selectedPackage.id,selectedPackage.title).catch(e=>notify(e.message))}>下载全部</button>{selectedPackage.status==="PENDING_EDIT"&&<button onClick={()=>void packageAction("start-editing")}>开始剪辑</button>}{["EDITING","REVISING"].includes(selectedPackage.status)&&<label className="solid-button return-product">回传给：{selectedPackage.driverCode}<input type="file" accept="video/*" onChange={e=>void returnProduct(e.target.files?.[0])}/></label>}</div>}</div>{error&&<div className="data-state error">{error}<button onClick={()=>void queryAssets()}>重试</button></div>}{loading&&<div className="data-state">正在读取素材…</div>}<div className="asset-header"><span>预览 / 文件名 / 备注</span><span>上传账号</span><span>类型</span><span>大小</span><span>上传时间</span><span>操作</span></div>{((mode==="folders"&&packageId)||mode==="files")&&assets.map(asset=><div className="asset-row" key={asset.id}><div className="asset-file"><AssetThumbnail token={session.token} asset={asset} onOpen={()=>setPreview(asset)}/><div className="asset-title"><strong title={asset.original_name}>{asset.original_name}</strong><small>{asset.memo_text||"无文字备注"}</small></div></div><div className="driver-cell"><span>{asset.user_account[0]}</span><div>{asset.user_name}<small>{asset.user_account}</small></div></div><span className={`type-tag ${asset.media_type}`}>{asset.media_type==="video"?"视频":asset.media_type==="image"?"图片":"文件"}</span><span>{formatBytes(asset.size_bytes)}</span><span>{formatTime(asset.uploaded_at)}</span><div className="asset-actions"><button onClick={()=>setPreview(asset)}>预览</button><button onClick={()=>void downloadAsset(session.token,assetFile(asset)).catch(e=>notify(e.message))}>下载</button></div></div>)}</div>
    {preview&&<AssetPreviewDialog token={session.token} asset={preview} onClose={()=>setPreview(null)}/>}
  </>
}

function AssetThumbnail({token,asset,onOpen}:{token:string;asset:LibraryAsset;onOpen:()=>void}) {
  const [url,setUrl]=useState(""); const [failed,setFailed]=useState(false);
  useEffect(()=>{if(!["image","video"].includes(asset.media_type))return;let active=true;let objectUrl="";void loadAssetPreviewUrl(token,asset.id).then(value=>{objectUrl=value;if(active){setFailed(false);setUrl(value)}else URL.revokeObjectURL(value)}).catch(()=>{if(active)setFailed(true)});return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl)}},[asset.id,asset.media_type,token]);
  const media=url?(asset.media_type==="video"?<video src={url} muted preload="metadata" playsInline/>:<img src={url} alt="" loading="lazy"/>):null;
  return <button type="button" className={`library-thumb ${asset.media_type}`} onClick={onOpen} aria-label={`预览 ${asset.original_name}`}>{media?<>{media}<span className="library-hover-preview">{asset.media_type==="video"?<video src={url} muted preload="metadata" playsInline/>:<img src={url} alt=""/>}</span></>:<span className="library-thumb-fallback">{failed?"预览失败":asset.media_type==="file"?"文件":"正在加载"}</span>}{asset.media_type==="video"&&<i className="video-play">▶</i>}<em>{asset.media_type==="video"?"视频":asset.media_type==="image"?"图片":"文件"}</em></button>;
}

function AssetPreviewDialog({token,asset,onClose}:{token:string;asset:LibraryAsset;onClose:()=>void}) {
  const [url,setUrl]=useState(""); const [error,setError]=useState(""); const [zoom,setZoom]=useState(1);
  useEffect(()=>{let active=true;let objectUrl="";void loadAssetPreviewUrl(token,asset.id).then(value=>{objectUrl=value;if(active)setUrl(value);else URL.revokeObjectURL(value)}).catch(e=>{if(active)setError(e instanceof Error?e.message:"预览失败")});return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl)}},[asset.id,token]);
  useEffect(()=>{const close=(event:KeyboardEvent)=>{if(event.key==="Escape")onClose()};window.addEventListener("keydown",close);return()=>window.removeEventListener("keydown",close)},[onClose]);
  return <div className="preview-backdrop" role="presentation" onMouseDown={event=>{if(event.currentTarget===event.target)onClose()}}><section className="preview-dialog" role="dialog" aria-modal="true" aria-label={`预览 ${asset.original_name}`}><header><div><strong>{asset.original_name}</strong><small>{asset.user_name} · {formatBytes(asset.size_bytes)} · {formatTime(asset.uploaded_at)}</small></div><button type="button" onClick={onClose} aria-label="关闭预览">×</button></header><div className="preview-stage">{error?<div className="data-state error">{error}</div>:!url?<div className="preview-loading">正在加载预览…</div>:asset.media_type==="video"?<video src={url} controls autoPlay playsInline><track kind="captions" srcLang="zh" label="暂无字幕"/></video>:asset.media_type==="image"?<img src={url} alt={asset.original_name} style={{transform:`scale(${zoom})`}}/>:<div className="preview-loading">此文件不支持在线预览，请下载后查看。</div>}</div>{asset.media_type==="image"&&url&&<footer><button onClick={()=>setZoom(value=>Math.max(.5,value-.25))}>缩小</button><span>{Math.round(zoom*100)}%</span><button onClick={()=>setZoom(value=>Math.min(3,value+.25))}>放大</button><button onClick={()=>setZoom(1)}>还原</button></footer>}</section></div>;
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

function FinishedFolder({
  notify,
  session,
}: {
  notify: (m: string) => void;
  session: Session;
}) {
  const [query, setQuery] = useState("");
  const [shown,setShown]=useState<FinishedProduct[]>([]); const [loading,setLoading]=useState(true);
  const [feedback,setFeedback]=useState<Array<{id:number;productTitle:string;driverCode:string;message:string;createdAt:string;status:string;reply:string|null}>>([]);
  useEffect(()=>{Promise.all([loadFinishedProducts(session.token,query),loadRevisions(session.token)]).then(([products,revisions])=>{setShown(products.items);setFeedback(revisions.items)}).catch(e=>notify(e instanceof Error?e.message:"成品读取失败")).finally(()=>setLoading(false))},[session.token,query,notify]);
  return (
    <>
      <div className="editor-heading">
        <div>
          <span className="kicker">统一成品夹</span>
          <h1>剪辑完成的视频</h1>
          <p>可以跨用户搜索、预览和调用已经完成的内容。</p>
        </div>
      </div>
      <div className="folder-search">
        <div>
          <span>⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索用户名或素材账号"
          />
          {query && <button onClick={() => setQuery("")}>×</button>}
        </div>
        <p>
          {query ? `找到 ${shown.length} 个对应成品` : `当前显示全部用户成品`}
        </p>
      </div>
      <div className="finished-grid">
        {shown.map((v) => (
          <article className="finished-card" key={v.id}>
            <VideoCover version={{id:String(v.id),title:v.title,duration:`V${(v as FinishedProduct & {versionNumber?:number}).versionNumber||1}`,note:v.originalName,color:"#2767e8"}} />
            <div>
              <h3>{v.title}</h3>
              <p>
                {v.driverCode} · {v.packageTitle||"历史素材包"} · {formatTime(v.uploadedAt)} · {formatBytes(v.sizeBytes)}
              </p>
              <span className={`pill ${v.isCurrent?"green":"blue"}`}>{v.isCurrent?"当前成品":`历史版本 V${v.versionNumber||1}`}</span>
              <button
                className="reuse-button"
                onClick={() => void downloadFinishedProduct(session.token,v).catch(e=>notify(e.message))}
              >
                下载成品
              </button>
            </div>
          </article>
        ))}
        {!loading&&shown.length === 0 && (
          <div className="finished-empty">
            <strong>{query ? "没有找到对应成品" : "成品文件夹还是空的"}</strong>
            <span>
              {query
                ? "请更换用户名或素材账号后再试。"
                : "剪辑师上传成品后，会在这里显示封面、用户、时间和文件大小。"}
            </span>
          </div>
        )}
        {loading&&<div className="data-state">正在读取成品…</div>}
      </div>
      <div className="simple-table"><div><strong>成品</strong><strong>上传账号</strong><strong>修改意见</strong><strong>状态</strong><strong>回复</strong></div>{feedback.map(item=><div key={item.id}><span>{item.productTitle}</span><span>{item.driverCode}</span><span>{item.message}</span><span>{item.status}</span><span>{item.reply||"—"}</span></div>)}</div>
    </>
  );
}
