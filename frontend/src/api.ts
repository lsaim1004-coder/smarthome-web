export type ApiError = { status: number; error: string; message: string }

export function isApiError(e: unknown): e is ApiError {
  return typeof e === 'object' && e !== null && 'status' in e && 'message' in e
}

/** 동일 출처 JSON API 호출. 실패하면 ApiError 를 throw 한다. */
export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init
  const res = await fetch(path, {
    credentials: 'same-origin',
    ...rest,
    headers: {
      Accept: 'application/json',
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(headers ?? {}),
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  })
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }
  if (!res.ok) {
    const body = (data ?? {}) as { error?: string; message?: string }
    const err: ApiError = {
      status: res.status,
      error: body.error ?? `HTTP_${res.status}`,
      message:
        body.message ??
        (res.status === 429 ? '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' : `요청에 실패했습니다. (${res.status})`),
    }
    throw err
  }
  return data as T
}

export function errorMessage(e: unknown): string {
  if (isApiError(e)) return e.message
  if (e instanceof Error) return e.message
  return '알 수 없는 오류가 발생했습니다.'
}
