// User-friendly error handling utility

export interface ParsedError {
  message: string;
  isRetryable: boolean;
  isHtmlError: boolean;
}

/**
 * Parses edge function errors and returns user-friendly messages
 */
export const parseEdgeFunctionError = (error: any): ParsedError => {
  const errorMessage = typeof error === 'string' ? error : error?.message || error?.error || '';
  const errorDetails = error?.details || '';
  
  // Check if error contains HTML (usually Cloudflare error pages)
  const isHtmlError = 
    errorDetails.includes('<!DOCTYPE html>') || 
    errorDetails.includes('<html') ||
    errorMessage.includes('<!DOCTYPE html>') ||
    errorMessage.includes('<html');
  
  // Check for timeout/connection errors
  const isTimeoutError = 
    errorMessage.includes('timeout') ||
    errorMessage.includes('Timeout') ||
    errorMessage.includes('abort') ||
    errorMessage.includes('AbortError') ||
    errorMessage.includes('Connection terminated') ||
    errorMessage.includes('connection timeout');

  // Check for common transient errors
  const isTransientError = 
    isTimeoutError ||
    errorMessage.includes('500') ||
    errorMessage.includes('502') ||
    errorMessage.includes('503') ||
    errorMessage.includes('504') ||
    errorMessage.includes('Internal server error') ||
    errorMessage.includes('ECONNRESET') ||
    errorMessage.includes('ETIMEDOUT') ||
    errorMessage.includes('network') ||
    errorMessage.includes('Failed to fetch');

  // Handle timeout errors specifically
  if (isTimeoutError) {
    return {
      message: 'Connection timed out. The server is slow - please try again.',
      isRetryable: true,
      isHtmlError: false,
    };
  }

  // Parse specific error types
  if (isHtmlError || isTransientError) {
    return {
      message: 'Service temporarily unavailable. Please try again in a moment.',
      isRetryable: true,
      isHtmlError: true,
    };
  }

  // Rate limit errors
  if (errorMessage.includes('Rate limit') || errorMessage.includes('429')) {
    return {
      message: 'Too many requests. Please wait a moment before trying again.',
      isRetryable: true,
      isHtmlError: false,
    };
  }

  // Authentication errors
  if (errorMessage.includes('401') || errorMessage.includes('Unauthorized') || errorMessage.includes('Invalid token')) {
    return {
      message: 'Authentication failed. Please refresh the page and try again.',
      isRetryable: false,
      isHtmlError: false,
    };
  }

  // Not found errors
  if (errorMessage.includes('404') || errorMessage.includes('not found')) {
    return {
      message: 'The requested resource was not found.',
      isRetryable: false,
      isHtmlError: false,
    };
  }

  // Database errors
  if (errorMessage.includes('Database error') || errorMessage.includes('PGRST')) {
    return {
      message: 'Database error. Please try again later.',
      isRetryable: true,
      isHtmlError: false,
    };
  }

  // Default case
  return {
    message: errorMessage || 'An unexpected error occurred. Please try again.',
    isRetryable: true,
    isHtmlError: false,
  };
};

/**
 * Get toast-friendly error message from any error
 */
export const getErrorMessage = (error: any): string => {
  return parseEdgeFunctionError(error).message;
};
