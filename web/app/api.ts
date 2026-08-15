export const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "https://api-vlog.daitora-jp.com/v1";

export type User = {
  id: string;
  name: string;
  role: "driver" | "editor" | "admin";
};

export type Session = { token: string; user: User };

export type AssetFile = {
  id: number;
  original_name: string;
  media_type: "video" | "image" | "file";
  mime_type: string;
  size_bytes: number;
  uploaded_at: string;
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

export function loadAssetPackages(token: string, sort: "time" | "type") {
  return request<{ items: DriverAssetPackage[] }>(
    `/driver-asset-packages?sort=${sort}`,
    {},
    token,
  );
}

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
  const response = await fetch(`${API_BASE}/assets/${file.id}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`预览失败（${response.status}）`);
  const url = URL.createObjectURL(await response.blob());
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
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
