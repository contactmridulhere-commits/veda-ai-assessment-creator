import type {
  AssignmentRecord,
  CreateAssignmentInput,
} from './types';

const API = process.env.NEXT_PUBLIC_API_URL ?? '';

/**
 * Small fetch wrapper that keeps error shapes consistent and resolves the
 * base URL from env. We don't pull in axios — fetch + a 10-line helper is
 * cleaner and one less dependency to update.
 */
async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.error ?? ''; } catch { /* noop */ }
    throw new Error(detail || `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export interface CreateResponse {
  ok: true;
  assignmentId: string;
  jobId: string;
  wsTopic: string;
  status: 'queued';
}

export const api = {
  createAssignment(input: CreateAssignmentInput) {
    return http<CreateResponse>('/api/assignments', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  listAssignments() {
    return http<{ ok: true; count: number; assignments: AssignmentRecord[] }>(
      '/api/assignments',
    );
  },
  getAssignment(id: string) {
    return http<{ ok: true; assignment: AssignmentRecord }>(
      `/api/assignments/${id}`,
    );
  },
  getByJobId(jobId: string) {
    return http<{ ok: true; assignment: AssignmentRecord }>(
      `/api/assignments/by-job/${jobId}`,
    );
  },
  regenerate(id: string) {
    return http<CreateResponse>(`/api/assignments/${id}/regenerate`, {
      method: 'POST',
    });
  },
  async uploadFile(file: File) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`${API}/api/assignments/upload`, {
      method: 'POST',
      body: fd,
    });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    return res.json() as Promise<{
      filename: string;
      size: number;
      chars: number;
      text: string;
    }>;
  },
};
