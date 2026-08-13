import { config } from "./config";

export interface HttpResponse<T> {
  data: T;
  status: number;
  statusText: string;
}

interface HttpGetOptions {
  params?: Record<string, string | number | boolean | null | undefined>;
  validateStatus?: (status: number) => boolean;
}

export class HttpRequestError<T = unknown> extends Error {
  readonly response?: HttpResponse<T>;
  readonly code?: string;

  constructor(
    message: string,
    options: { response?: HttpResponse<T>; code?: string; cause?: unknown } = {},
  ) {
    super(message);
    this.name = "HttpRequestError";
    this.response = options.response;
    this.code = options.code;
    if (options.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export function isHttpRequestError(error: unknown): error is HttpRequestError {
  return error instanceof HttpRequestError;
}

async function get<T>(url: string, options: HttpGetOptions = {}): Promise<HttpResponse<T>> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), config.apiTimeout);

  try {
    const requestUrl = new URL(url, `${config.apiBaseUrl}/`);
    for (const [key, value] of Object.entries(options.params || {})) {
      if (value !== null && value !== undefined) {
        requestUrl.searchParams.set(key, String(value));
      }
    }
    const response = await fetch(requestUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const raw = await response.text();
    let data: T;
    try {
      data = (raw ? JSON.parse(raw) : undefined) as T;
    } catch (cause) {
      throw new HttpRequestError<T>("Resposta inválida da API", {
        code: "ERR_BAD_RESPONSE",
        cause,
      });
    }

    const result: HttpResponse<T> = {
      data,
      status: response.status,
      statusText: response.statusText,
    };
    const accepted = options.validateStatus
      ? options.validateStatus(response.status)
      : response.ok;
    if (!accepted) {
      throw new HttpRequestError<T>(
        `Request failed with status code ${response.status}`,
        { response: result, code: "ERR_BAD_RESPONSE" },
      );
    }
    return result;
  } catch (error) {
    if (error instanceof HttpRequestError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new HttpRequestError("Tempo limite da API excedido", {
        code: "ECONNABORTED",
        cause: error,
      });
    }
    throw new HttpRequestError("Falha na requisição da API", {
      code: "ERR_NETWORK",
      cause: error,
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

/**
 * Contrato mínimo compatível com os endpoints existentes. O nome é preservado
 * para evitar uma migração ruidosa; todas as chamadas atuais são GET.
 */
export const axiosInstance = { get };
