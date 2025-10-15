export class EmailProviderError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "EmailProviderError";
    this.code = code;
  }
}

export class EmailProviderConfigurationError extends EmailProviderError {
  constructor(message: string) {
    super(message, "CONFIGURATION_ERROR");
    this.name = "EmailProviderConfigurationError";
  }
}

export class EmailProviderFeatureNotSupportedError extends EmailProviderError {
  feature: string;

  constructor(feature: string, message?: string) {
    super(message ?? `Feature not supported: ${feature}`, "FEATURE_NOT_SUPPORTED");
    this.feature = feature;
    this.name = "EmailProviderFeatureNotSupportedError";
  }
}
