export interface FieldError {
  field: string
  message: string
}

/** Error raised for any failed API call; carries the server's problem details when available. */
export class ApiError extends Error {
  readonly status: number
  readonly title: string
  readonly fieldErrors: FieldError[]
  readonly body: Record<string, unknown> | null

  constructor(status: number, title: string, detail: string, fieldErrors: FieldError[] = [], body: Record<string, unknown> | null = null) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.title = title
    this.fieldErrors = fieldErrors
    this.body = body
  }

  get isNetworkError(): boolean {
    return this.status === 0
  }

  /** The most useful single-line message for the user. */
  get userMessage(): string {
    if (this.fieldErrors.length > 0) {
      return this.fieldErrors[0].message
    }
    return this.message
  }
}

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

export async function request<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch(BASE + path, {
      method,
      headers: body === undefined ? { Accept: 'application/json' } : { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    throw new ApiError(0, 'Server unreachable', 'Cannot reach the Harmony Lab server. Check that the backend is running.')
  }
  if (response.status === 204) {
    return undefined as T
  }
  const text = await response.text()
  let parsed: unknown = null
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = null
    }
  }
  if (!response.ok) {
    const problem = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>
    const fieldErrors = Array.isArray(problem.errors) ? (problem.errors as FieldError[]) : []
    const title = typeof problem.title === 'string' ? problem.title : `Request failed (${response.status})`
    const detail = typeof problem.detail === 'string' ? problem.detail : defaultMessage(response.status)
    throw new ApiError(response.status, title, detail, fieldErrors, problem)
  }
  return parsed as T
}

function defaultMessage(status: number): string {
  if (status >= 500) return 'The server had a problem completing the request. Please try again.'
  if (status === 404) return 'The requested resource was not found.'
  return 'The request could not be completed.'
}

export function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.userMessage
  if (error instanceof Error) return error.message
  return 'Unexpected error'
}
