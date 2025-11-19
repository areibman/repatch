/**
 * Result type for API operations
 * Enables explicit error handling and type-safe results
 */
export type Result<T> = 
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Helper to create a success result
 */
export function success<T>(data: T): Result<T> {
  return { success: true, data };
}

/**
 * Helper to create an error result
 */
export function error<T>(message: string): Result<T> {
  return { success: false, error: message };
}

/**
 * Helper to wrap async operations with error handling
 */
export async function wrapAsync<T>(
  fn: () => Promise<T>,
  errorMessage?: string
): Promise<Result<T>> {
  try {
    const data = await fn();
    return success(data);
  } catch (err) {
    const message = errorMessage || 
      (err instanceof Error ? err.message : 'Unknown error');
    return error(message);
  }
}
