export const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "https://api-vlog.daitora-jp.com/v1";

export type User = {
  id: string;
  name: string;
  role: "driver" | "editor" | "admin";
  isSuperAdmin?: boolean;
  mustChangePassword?: boolean;
};

export type Session = { token: string; user: User };

export type AssetFile = {
  id: number;
  original_name: string;
  media_type: "video" | "image" | "file";
  mime_type: string;
  size_bytes: number;
  uploaded_at: string;
  memo_text?: string;
  has_voice_memo?: number | boolean;
  memo_voice_size?: number | null;
  memo_updated_at?: string | null;
};

export type DriverAssetPackage = {
  id: string;
  driver: string;
  code: string;
  count: number;
  sizeBytes: number;
  latestUpload: string | null;
  files: AssetFile[];
};

export type FinishedProduct = {
  id: number;
  packageId?: number;
  packageTitle?: string;
  driverCode: string;
  driver: string;
  title: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  status: string;
  versionNumber?: number;
  versionNote?: string;
  isCurrent?: boolean;
  isFinal?: boolean;
  downloadUrl: string;
};

export type MaterialPackage = { id:number;driverCode:string;driver:string;title:string;shootDate:string;effectiveDate:string;dateSource:"shoot_date"|"uploaded_at";theme:string;location:string;tags:string[];usage:string;status:string;createdAt:string;submittedAt:string|null;updatedAt:string;fileCount:number;videoCount:number;imageCount:number;sizeBytes:number };
export type Dashboard = { pendingEdit:number;editing:number;revisionRequested:number;pendingReview:number;completedThisMonth:number;overdue24h:number };
export type UploadUser = {account:string;display_name:string;active:number;package_count:number;asset_count:number;size_bytes:number;last_activity:string|null};
export type AuditLog = {id:number;action:string;object_type:string;object_id:number|null;detail:string;created_at:string;account:string;actor:string};
export type Revision = {id:number;productId:number;productTitle:string;driverCode:string;driver:string;message:string;createdAt:string;reply:string|null;repliedAt:string|null;status:string};
export type LibraryAsset = {id:number;package_id:number;original_name:string;media_type:"video"|"image"|"file";mime_type:string;size_bytes:number;uploaded_at:string;upload_status:string;memo_text:string;duration_seconds:number|null;width:number|null;height:number|null;orientation:string;user_account:string;user_name:string;package_title:string;theme:string;location:string;tags:string;usage:string;package_status:string;shoot_date:string;effective_date:string;date_source:"shoot_date"|"uploaded_at"};
export type LibraryStats = {userCount:number;packageCount:number;fileCount:number};
export type AdminOverview = {accounts:number;activeAccounts:number;packages:number;assets:number;products:number;uploadExceptions:number};
export type AdminAccount = {id:number;account:string;displayName:string;role:"UPLOADER"|"EDITOR"|"ADMIN";active:boolean;isSuperAdmin:boolean;mustChangePassword:boolean;createdAt:string;lastLoginAt:string|null;assetCount:number;productCount:number};
export type AdminAnomaly = {id:number;title:string;status:string;updated_at:string;account:string;display_name:string;anomaly:string};
export type AdminStorage = {totalBytes:number;usedBytes:number;freeBytes:number;usedPercent:number;thresholdLevel:string;byAccount:Array<{account:string;display_name:string;size_bytes:number}>;largeFiles:Array<{id:number;original_name:string;size_bytes:number;uploaded_at:string;account:string}>;latestBackup:null|{started_at:string;finished_at:string|null;status:string;location:string|null;size_bytes:number|null;detail:string|null}};

async function request<T>(path: string, init: RequestInit = {}, token?: string) {
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!response.ok) {
    let message = `请求失败（${response.status}）`;
    try {
      const body = await response.json();
      if (body.detail) message = body.detail;
    } catch {
      // Keep the status-based message when the response is not JSON.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export function login(account: string, password: string) {
  return request<Session>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ account, password }),
  });
}

export function loadMe(token: string) {
  return request<User>("/me", {}, token);
}

export function updateProfile(token: string, name: string) {
  return request<User>("/me/profile", {
    method: "POST",
    body: JSON.stringify({ name }),
  }, token);
}

export function loadAssetPackages(token: string, sort: "time" | "type") {
  return request<{ items: DriverAssetPackage[] }>(
    `/driver-asset-packages?sort=${sort}`,
    {},
    token,
  );
}

export function loadMaterialPackages(token:string, filters:Record<string,string>={}) { const q=new URLSearchParams(filters).toString(); return request<{items:MaterialPackage[]}>(`/material-packages${q?`?${q}`:""}`,{},token); }
export function loadDashboard(token:string) { return request<Dashboard>("/dashboard",{},token); }
export function transitionPackage(token:string,id:number,action:"start-editing"|"start-revision") { return request<{id:number;status:string}>(`/material-packages/${id}/${action}`,{method:"POST"},token); }
export function loadUploadUsers(token:string,query="") { return request<{items:UploadUser[]}>(`/drivers${query?`?query=${encodeURIComponent(query)}`:""}`,{},token); }
export function loadAuditLogs(token:string,query="") { return request<{items:AuditLog[];total:number}>(`/audit-logs${query?`?query=${encodeURIComponent(query)}`:""}`,{},token); }
export function loadRevisions(token:string,status="") { return request<{items:Revision[]}>(`/revisions${status?`?status=${encodeURIComponent(status)}`:""}`,{},token); }
export function replyRevision(token:string,id:number,message:string) { return request<Revision>(`/revisions/${id}/reply`,{method:"POST",body:JSON.stringify({message})},token); }
export function loadFinishedProducts(token:string,query="") { return request<{items:FinishedProduct[];total:number}>(`/finished-products${query?`?query=${encodeURIComponent(query)}`:""}`,{},token); }
export function uploadFinishedProduct(token:string,packageId:number,file:File,title:string) { const body=new FormData();body.append("package_id",String(packageId));body.append("file",file);body.append("title",title);return request<{id:number;packageId:number;versionNumber:number;ownerAccount:string;title:string}>("/finished-products/upload",{method:"POST",body},token); }
export function loadLibraryAssets(token:string,filters:Record<string,string>={}) { const q=new URLSearchParams(filters).toString();return request<{items:LibraryAsset[];total:number;page:number;pageSize:number}>(`/assets${q?`?${q}`:""}`,{},token); }
export function loadLibraryStats(token:string,driverId="") { return request<LibraryStats>(`/library/stats${driverId?`?driver_id=${encodeURIComponent(driverId)}`:""}`,{},token); }
export function loadAdminOverview(token:string){return request<AdminOverview>("/admin/overview",{},token)}
export function loadAdminAccounts(token:string,filters:Record<string,string>={}){const q=new URLSearchParams(filters).toString();return request<{items:AdminAccount[];total:number}>(`/admin/accounts${q?`?${q}`:""}`,{},token)}
export function createAdminAccount(token:string,body:{account:string;displayName:string;role:string}){return request<{account:AdminAccount;temporaryPassword:string}>("/admin/accounts",{method:"POST",body:JSON.stringify(body)},token)}
export function updateAdminAccount(token:string,id:number,body:{displayName?:string;active?:boolean;role?:string}){return request<AdminAccount>(`/admin/accounts/${id}`,{method:"PATCH",body:JSON.stringify(body)},token)}
export function resetAdminPassword(token:string,id:number){return request<{account:string;temporaryPassword:string;mustChangePassword:boolean}>(`/admin/accounts/${id}/reset-password`,{method:"POST",body:JSON.stringify({})},token)}
export function revokeAdminSessions(token:string,id:number){return request<{account:string;revokedSessions:number}>(`/admin/accounts/${id}/revoke-sessions`,{method:"POST"},token)}
export function loadAdminAnomalies(token:string){return request<{items:AdminAnomaly[];unownedAssets:number}>("/admin/anomalies",{},token)}
export function loadAdminStorage(token:string){return request<AdminStorage>("/admin/storage",{},token)}
export async function downloadPackage(token:string,id:number,title:string) { const response=await fetch(`${API_BASE}/material-packages/${id}/download`,{headers:{Authorization:`Bearer ${token}`}}); if(!response.ok) throw new Error(`素材包下载失败（${response.status}）`); const url=URL.createObjectURL(await response.blob()); const a=document.createElement("a");a.href=url;a.download=`${title}.zip`;a.click();URL.revokeObjectURL(url); }

export async function downloadAsset(token: string, file: AssetFile) {
  const response = await fetch(`${API_BASE}/assets/${file.id}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`下载失败（${response.status}）`);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.original_name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function previewAsset(token: string, file: AssetFile) {
  const url = await loadAssetPreviewUrl(token, file.id);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function loadAssetPreviewUrl(token: string, assetId: number) {
  const response = await fetch(`${API_BASE}/assets/${assetId}/preview`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`预览失败（${response.status}）`);
  return URL.createObjectURL(await response.blob());
}

export async function uploadAsset(
  token: string,
  file: File,
  driverCode?: string,
) {
  const body = new FormData();
  body.append("file", file);
  if (driverCode) body.append("driver_code", driverCode);
  return request<AssetFile>("/assets/upload", { method: "POST", body }, token);
}

export function loadLatestFinishedProduct(token: string) {
  return request<{ item: FinishedProduct | null }>("/me/latest-finished-product", {}, token);
}

export async function downloadFinishedProduct(token: string, product: FinishedProduct) {
  const response = await fetch(`${API_BASE}/finished-products/${product.id}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`下载失败（${response.status}）`);
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = product.originalName;
  anchor.click();
  URL.revokeObjectURL(url);
}
