export type EmailProviderErrorCode =
  | "MISSING_CONFIGURATION"
  | "UNSUPPORTED_OPERATION"
  | "REQUEST_FAILED";

export class EmailProviderError extends Error {
  constructor(
    message: string,
    public code: EmailProviderErrorCode,
    options?: { cause?: unknown }
  ) {
    super(message);
    this.name = "EmailProviderError";
    if (options?.cause) {
      // @ts-expect-error cause is not widely available in older TS libs
      this.cause = options.cause;
    }
  }
}
