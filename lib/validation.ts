/**
 * Validation utilities for runtime type checking
 */

import { ProcessingStatusSchema } from "./schemas/patch-note.schema";
import type { ProcessingStatus } from "./schemas/patch-note.schema";

/**
 * Validates and returns a ProcessingStatus, or throws if invalid
 */
export function validateProcessingStatus(
  status: unknown
): ProcessingStatus {
  return ProcessingStatusSchema.parse(status);
}

/**
 * Safely validates a ProcessingStatus, returning a result object
 */
export function safeValidateProcessingStatus(
  status: unknown
): { success: true; data: ProcessingStatus } | { success: false; error: unknown } {
  try {
    const data = ProcessingStatusSchema.parse(status);
    return { success: true, data };
  } catch (error) {
    return { success: false, error };
  }
}

/**
 * Type guard to check if a value is a valid ProcessingStatus
 */
export function isProcessingStatus(status: unknown): status is ProcessingStatus {
  return ProcessingStatusSchema.safeParse(status).success;
}
