import { isAxiosError } from 'axios'

type NestErrorBody = {
  message?: string | string[]
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as NestErrorBody | undefined
    const msg = data?.message
    if (typeof msg === 'string') {
      return msg
    }
    if (Array.isArray(msg)) {
      return msg.join(', ')
    }
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}
