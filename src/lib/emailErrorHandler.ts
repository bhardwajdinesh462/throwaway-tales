// Centralized email error handling with specific error codes and user-friendly messages

export interface EmailError {
  message: string;
  code: string;
  isRetryable: boolean;
  details?: string;
}

export const parseEmailCreationError = (error: any): EmailError => {
  const errorMessage = error?.message || error?.toString() || '';
  const errorCode = error?.code || '';
  
  // PostgreSQL unique constraint violation
  if (errorCode === '23505' || errorMessage.includes('duplicate key') || errorMessage.includes('already exists')) {
    return {
      message: 'This email address already exists. Try a different username.',
      code: 'DUPLICATE_EMAIL',
      isRetryable: false,
      details: 'The username you chose is already taken. Please try a different one.',
    };
  }
  
  // RLS policy violation
  if (errorCode === '42501' || errorMessage.includes('RLS') || errorMessage.includes('policy')) {
    return {
      message: 'Permission denied. Please refresh the page and try again.',
      code: 'PERMISSION_DENIED',
      isRetryable: true,
      details: 'There was an authorization issue. Refreshing usually fixes this.',
    };
  }
  
  // Rate limit exceeded
  if (errorMessage.toLowerCase().includes('rate limit') || errorMessage.includes('too many requests')) {
    return {
      message: 'Rate limit exceeded. Please wait before creating more emails.',
      code: 'RATE_LIMIT',
      isRetryable: true,
      details: 'You\'ve made too many requests. Please wait a few minutes.',
    };
  }
  
  // Daily limit reached
  if (errorMessage.includes('daily') && errorMessage.includes('limit')) {
    return {
      message: 'Daily email creation limit reached. Please try again tomorrow.',
      code: 'DAILY_LIMIT',
      isRetryable: false,
      details: 'You\'ve reached your daily limit. Sign up for a premium account for more.',
    };
  }
  
  // Blocked word in username
  if (errorMessage.includes('blocked') || errorMessage.includes('prohibited')) {
    return {
      message: 'Username contains a blocked word. Please choose a different username.',
      code: 'BLOCKED_WORD',
      isRetryable: false,
      details: 'The username contains a word that is not allowed.',
    };
  }
  
  // Username too short
  if (errorMessage.includes('min') && (errorMessage.includes('char') || errorMessage.includes('length'))) {
    return {
      message: 'Username must be at least 3 characters long.',
      code: 'USERNAME_TOO_SHORT',
      isRetryable: false,
      details: 'Please enter a longer username.',
    };
  }
  
  // Domain not found or inactive
  if (errorMessage.includes('domain') && (errorMessage.includes('not found') || errorMessage.includes('inactive'))) {
    return {
      message: 'Selected domain is unavailable. Please choose a different domain.',
      code: 'DOMAIN_UNAVAILABLE',
      isRetryable: false,
      details: 'The domain you selected is not available. Try another one.',
    };
  }
  
  // Guest access disabled
  if (errorMessage.includes('guest') && errorMessage.includes('disabled')) {
    return {
      message: 'Guest email creation is disabled. Please sign in to continue.',
      code: 'GUEST_DISABLED',
      isRetryable: false,
      details: 'Guest access has been disabled by the administrator.',
    };
  }
  
  // Network/connection errors
  if (errorMessage.includes('network') || errorMessage.includes('fetch') || 
      errorMessage.includes('ECONNREFUSED') || errorMessage.includes('timeout')) {
    return {
      message: 'Connection error. Please check your internet and try again.',
      code: 'NETWORK_ERROR',
      isRetryable: true,
      details: 'Unable to connect to the server. Check your internet connection.',
    };
  }
  
  // PGRST (PostgREST) errors
  if (errorCode.startsWith('PGRST') || errorMessage.includes('PGRST')) {
    return {
      message: 'Database temporarily unavailable. Please try again in a moment.',
      code: 'DATABASE_ERROR',
      isRetryable: true,
      details: 'There was a temporary database issue.',
    };
  }
  
  // Validation errors
  if (errorMessage.includes('invalid') || errorMessage.includes('validation')) {
    return {
      message: 'Invalid input. Please check your username format.',
      code: 'VALIDATION_ERROR',
      isRetryable: false,
      details: 'Username can only contain letters, numbers, dots, hyphens, and underscores.',
    };
  }
  
  // Email not found (for fetching)
  if (errorMessage.includes('not found') || errorCode === '404') {
    return {
      message: 'Email not found. It may have expired.',
      code: 'EMAIL_NOT_FOUND',
      isRetryable: false,
      details: 'The temporary email address no longer exists.',
    };
  }
  
  // Service unavailable
  if (errorCode === '503' || errorMessage.includes('service unavailable')) {
    return {
      message: 'Service temporarily unavailable. Please try again later.',
      code: 'SERVICE_UNAVAILABLE',
      isRetryable: true,
      details: 'The service is temporarily down for maintenance.',
    };
  }
  
  // Default/unknown error - include the actual error message for debugging
  return {
    message: `Failed to create email: ${errorMessage.slice(0, 100)}`,
    code: 'UNKNOWN_ERROR',
    isRetryable: true,
    details: 'An unexpected error occurred. Please try again.',
  };
};

export const getEmailErrorMessage = (error: any): string => {
  return parseEmailCreationError(error).message;
};
