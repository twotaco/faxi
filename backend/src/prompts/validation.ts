import { z } from 'zod';
import { loggingService } from '../services/loggingService.js';
import { promptManager } from './index.js';
import { promptMonitoringService } from '../services/promptMonitoringService.js';

/**
 * Schema Validation Error
 * 
 * Custom error class for schema validation failures.
 * Includes detailed information about the validation failure for debugging.
 */
export class SchemaValidationError extends Error {
  public readonly useCase: string;
  public readonly validationErrors: z.ZodError;
  public readonly rawOutput: any;
  public readonly attemptNumber: number;

  constructor(
    useCase: string,
    validationErrors: z.ZodError,
    rawOutput: any,
    attemptNumber: number = 1
  ) {
    super(`Schema validation failed for ${useCase} (attempt ${attemptNumber})`);
    this.name = 'SchemaValidationError';
    this.useCase = useCase;
    this.validationErrors = validationErrors;
    this.rawOutput = rawOutput;
    this.attemptNumber = attemptNumber;

    // Maintain proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SchemaValidationError);
    }
  }

  /**
   * Get a human-readable summary of validation errors
   */
  getErrorSummary(): string {
    const errors = this.validationErrors.errors.map(err => {
      const path = err.path.join('.');
      return `  - ${path || 'root'}: ${err.message}`;
    });

    return `Validation failed for ${this.useCase}:\n${errors.join('\n')}`;
  }

  /**
   * Get validation errors as a structured object
   */
  getStructuredErrors(): Array<{ path: string; message: string; code: string }> {
    return this.validationErrors.errors.map(err => ({
      path: err.path.join('.'),
      message: err.message,
      code: err.code
    }));
  }
}

/**
 * Validated Response Result
 */
export interface ValidatedResponse<T = any> {
  success: boolean;
  data?: T;
  error?: SchemaValidationError;
  attemptNumber: number;
  retried: boolean;
}

/**
 * Retry Configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  retryOnParseError: boolean;
  retryOnValidationError: boolean;
  logErrors: boolean;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  retryOnParseError: true,
  retryOnValidationError: true,
  logErrors: true
};

/**
 * Handle LLM Response with Validation and Retry Logic
 * 
 * This function validates LLM output against the schema for a use case.
 * If validation fails, it can retry with clarification prompts.
 * 
 * @param useCase - The use case identifier
 * @param rawOutput - The raw output from the LLM (string or object)
 * @param retryCallback - Optional callback to retry with clarification
 * @param config - Retry configuration
 * @param manager - Optional PromptManager instance (defaults to global)
 * @returns Validated response with data or error
 */
export async function handleLLMResponse<T = any>(
  useCase: string,
  rawOutput: any,
  retryCallback?: (error: SchemaValidationError) => Promise<any>,
  config: Partial<RetryConfig> = {},
  manager?: typeof promptManager,
  userId?: string,
  faxJobId?: string
): Promise<ValidatedResponse<T>> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let attemptNumber = 1;
  let lastError: SchemaValidationError | undefined;
  const startTime = Date.now();

  while (attemptNumber <= finalConfig.maxAttempts) {
    try {
      // Attempt to validate the output
      const validationStart = Date.now();
      const result = await validateOutput<T>(useCase, rawOutput, attemptNumber, manager);
      const validationDuration = Date.now() - validationStart;

      // Record validation performance
      promptMonitoringService.recordPerformance({
        useCase,
        operation: 'validation',
        durationMs: validationDuration,
        timestamp: new Date(),
        userId,
        faxJobId
      });

      if (result.success) {
        // Record successful validation
        promptMonitoringService.recordValidation({
          useCase,
          success: true,
          attemptNumber,
          timestamp: new Date(),
          userId,
          faxJobId
        });

        // Log success if this was a retry
        if (attemptNumber > 1 && finalConfig.logErrors) {
          loggingService.info('Schema validation succeeded after retry', {
            useCase,
            attemptNumber,
            totalAttempts: attemptNumber
          });
        }

        return {
          success: true,
          data: result.data,
          attemptNumber,
          retried: attemptNumber > 1
        };
      }

      // Validation failed
      lastError = result.error!;

      // Record failed validation
      promptMonitoringService.recordValidation({
        useCase,
        success: false,
        attemptNumber,
        validationErrors: lastError.getStructuredErrors().map(e => e.message),
        timestamp: new Date(),
        userId,
        faxJobId
      });

      // Record error metric
      promptMonitoringService.recordError({
        useCase,
        errorType: 'validation_failure',
        errorMessage: lastError.getErrorSummary(),
        retryCount: attemptNumber,
        resolved: false,
        timestamp: new Date(),
        userId,
        faxJobId
      });

      // Log the error
      if (finalConfig.logErrors) {
        loggingService.error(
          'Schema validation failed',
          lastError,
          {
            useCase,
            attemptNumber,
            maxAttempts: finalConfig.maxAttempts
          },
          {
            errorSummary: lastError.getErrorSummary(),
            structuredErrors: lastError.getStructuredErrors(),
            rawOutput: typeof rawOutput === 'string' 
              ? rawOutput.substring(0, 500) 
              : JSON.stringify(rawOutput).substring(0, 500)
          }
        );
      }

      // Check if we should retry
      const shouldRetry = attemptNumber < finalConfig.maxAttempts && retryCallback;
      
      if (!shouldRetry) {
        break;
      }

      // Attempt retry with clarification
      loggingService.info('Attempting retry with clarification', {
        useCase,
        attemptNumber: attemptNumber + 1,
        maxAttempts: finalConfig.maxAttempts
      });

      rawOutput = await retryCallback(lastError);
      attemptNumber++;

    } catch (error) {
      // Unexpected error during validation
      loggingService.error(
        'Unexpected error during validation',
        error as Error,
        {
          useCase,
          attemptNumber
        }
      );

      // Create a generic validation error
      lastError = new SchemaValidationError(
        useCase,
        new z.ZodError([{
          code: 'custom',
          path: [],
          message: `Unexpected error: ${(error as Error).message}`
        }]),
        rawOutput,
        attemptNumber
      );

      // Record error
      promptMonitoringService.recordError({
        useCase,
        errorType: 'validation_failure',
        errorMessage: (error as Error).message,
        retryCount: attemptNumber,
        resolved: false,
        timestamp: new Date(),
        userId,
        faxJobId
      });

      break;
    }
  }

  // Record total duration
  const totalDuration = Date.now() - startTime;
  promptMonitoringService.recordPerformance({
    useCase,
    operation: 'total',
    durationMs: totalDuration,
    timestamp: new Date(),
    userId,
    faxJobId
  });

  // All attempts failed
  return {
    success: false,
    error: lastError,
    attemptNumber,
    retried: attemptNumber > 1
  };
}

/**
 * Validate output against schema
 * 
 * Internal function that performs the actual validation.
 * 
 * @param useCase - The use case identifier
 * @param output - The output to validate
 * @param attemptNumber - Current attempt number
 * @param manager - Optional PromptManager instance
 * @returns Validation result
 */
async function validateOutput<T = any>(
  useCase: string,
  output: any,
  attemptNumber: number,
  manager?: typeof promptManager
): Promise<ValidatedResponse<T>> {
  try {
    // Get the template for this use case
    const pm = manager || promptManager;
    const template = pm.get(useCase);

    // Parse JSON if output is a string
    let parsed = output;
    if (typeof output === 'string') {
      try {
        parsed = JSON.parse(output);
      } catch (parseError) {
        // JSON parse error
        const zodError = new z.ZodError([{
          code: 'custom',
          path: [],
          message: `Invalid JSON: ${(parseError as Error).message}`
        }]);

        return {
          success: false,
          error: new SchemaValidationError(useCase, zodError, output, attemptNumber),
          attemptNumber,
          retried: attemptNumber > 1
        };
      }
    }

    // Validate against Zod schema
    const validated = template.zodSchema.parse(parsed) as T;

    return {
      success: true,
      data: validated,
      attemptNumber,
      retried: attemptNumber > 1
    };

  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: new SchemaValidationError(useCase, error, output, attemptNumber),
        attemptNumber,
        retried: attemptNumber > 1
      };
    }

    // Unexpected error
    throw error;
  }
}

/**
 * Create a clarification prompt based on validation errors
 * 
 * Helper function to generate a clarification message for the LLM
 * when validation fails.
 * 
 * @param error - The schema validation error
 * @returns Clarification message
 */
export function createClarificationPrompt(error: SchemaValidationError): string {
  const errors = error.getStructuredErrors();
  
  let clarification = 'Your previous response did not match the expected schema. Please correct the following issues:\n\n';
  
  errors.forEach((err, index) => {
    clarification += `${index + 1}. `;
    if (err.path) {
      clarification += `Field "${err.path}": ${err.message}\n`;
    } else {
      clarification += `${err.message}\n`;
    }
  });

  clarification += '\nPlease provide a corrected response that matches the schema exactly.';

  return clarification;
}

/**
 * Retry with format correction
 * 
 * Attempts to fix common JSON formatting issues before retrying validation.
 * 
 * @param useCase - The use case identifier
 * @param rawOutput - The raw output that failed to parse
 * @returns Corrected output (parsed object) or original string if correction fails
 */
export function retryWithFormatCorrection(useCase: string, rawOutput: string): any {
  loggingService.info('Attempting format correction', { useCase });

  // Try multiple correction strategies
  const strategies = [
    // Strategy 1: Extract JSON from markdown code blocks
    () => {
      const jsonMatch = rawOutput.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (jsonMatch) {
        loggingService.debug('Found JSON in markdown code block');
        return JSON.parse(jsonMatch[1]);
      }
      return null;
    },
    
    // Strategy 2: Extract JSON object from text
    () => {
      const objectMatch = rawOutput.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        loggingService.debug('Found JSON object in text');
        return JSON.parse(objectMatch[0]);
      }
      return null;
    },
    
    // Strategy 3: Fix common formatting issues
    () => {
      let corrected = rawOutput
        .replace(/'/g, '"')  // Replace single quotes with double quotes
        .replace(/,\s*}/g, '}')  // Remove trailing commas in objects
        .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
        .trim();
      
      return JSON.parse(corrected);
    }
  ];

  // Try each strategy in order
  for (const strategy of strategies) {
    try {
      const result = strategy();
      if (result !== null) {
        return result;
      }
    } catch (error) {
      // Continue to next strategy
      continue;
    }
  }

  // All strategies failed
  loggingService.warn('Format correction failed', {
    useCase,
    rawOutput: rawOutput.substring(0, 200)
  });

  // Return original if correction fails
  return rawOutput;
}

/**
 * Log validation metrics
 * 
 * Helper function to log validation success/failure metrics for monitoring.
 * 
 * @param useCase - The use case identifier
 * @param success - Whether validation succeeded
 * @param attemptNumber - Number of attempts made
 * @param duration - Duration in milliseconds
 */
export function logValidationMetrics(
  useCase: string,
  success: boolean,
  attemptNumber: number,
  duration: number
): void {
  loggingService.info('Validation metrics', {
    useCase,
    success,
    attemptNumber,
    duration,
    retried: attemptNumber > 1
  });
}
