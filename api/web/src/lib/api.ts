export interface PackageInfo {
  language: string;
  language_version: string;
  installed: boolean;
}

export interface RuntimeInfo {
  language: string;
  version: string;
}

export interface ExecStage {
  stdout: string;
  stderr: string;
  output?: string;
  code: number | null;
  signal: string | null;
  message: string | null;
  status: string | null;
  time: string | null;
  cpu_time?: number | null;
  memory: string | null;
  output_size?: string | null;
}

export interface ExecResult {
  language: string;
  version: string;
  run: ExecStage;
  compile?: ExecStage;
}

export interface JobRow {
  id: string;
  username: string | null;
  language: string;
  version: string;
  compile_exit: number | null;
  compile_time: number | null;
  compile_memory: number | null;
  compile_status: string | null;
  run_exit: number | null;
  run_time: number | null;
  run_memory: number | null;
  run_status: string | null;
  created_at: string;
}

export interface JobDetail extends JobRow {
  code: string | null;
  compile_stdout: string | null;
  compile_stderr: string | null;
  run_stdout: string | null;
  run_stderr: string | null;
}

export interface UserInfo {
  id: number;
  username: string;
  role: string;
  created_at: string;
}

export function getToken() {
  return localStorage.getItem('auth_token');
}

export function authHeaders(): HeadersInit {
  return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getToken() };
}

export class ApiError extends Error {}

async function unwrap(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.message || `Xatolik (${res.status})`);
  return data;
}

export async function apiGet(path: string) {
  const res = await fetch(path, { headers: authHeaders() });
  if (res.status === 401) {
    localStorage.clear();
    window.location.href = '/login';
    throw new ApiError('Token yaroqsiz');
  }
  return unwrap(res);
}

export async function apiSend(path: string, method: string, body?: unknown) {
  const res = await fetch(path, {
    method,
    headers: authHeaders(),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return unwrap(res);
}

export async function fetchMe(): Promise<{ username: string; role: string }> {
  const res = await fetch('/auth/me', { headers: authHeaders() });
  if (!res.ok) throw new ApiError('Autentifikatsiya xatosi');
  return res.json();
}
