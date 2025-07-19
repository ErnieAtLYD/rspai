// src/services/Logger.ts

import { ErrorHandlingService } from "./ErrorHandlingService";

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogEvent = 'initialized' | 'disposed' | 'configured' | 'error' | 'initialize started' | 'dispose started' | 'configure started' | 'initialize completed' | 'dispose completed' | 'configure completed';

export interface LogContext {
	[key: string]: unknown;
}

export type LogErrorContext = string | LogContext;

export class Logger {
	private serviceName: string;
	private errorHandler?: ErrorHandlingService;

	constructor(serviceName: string, errorHandler?: ErrorHandlingService) {
		this.serviceName = serviceName;
		this.errorHandler = errorHandler;
	}

	/**
	 * Update the error handler reference (useful for late binding during service initialization)
	 * @param errorHandler - The ErrorHandlingService instance
	 * @returns A promise that resolves when the error handler is set
	 * @throws If the ErrorHandlingService fails to handle the error
	 * @throws If the error is not an Error object
	 */
	setErrorHandler(errorHandler: ErrorHandlingService): void {
		this.errorHandler = errorHandler;
	}

	/**
	 * Log a debug message
	 * @param message - The message to log
	 * @param context - The context of the log
	 * @returns A promise that resolves when the log is logged
	 * @throws If the ErrorHandlingService fails to handle the error
	 * @throws If the error is not an Error object
	 */
	debug(message: string, context?: LogContext): void {
		this.log('debug', message, context);
	}

	/**
	 * Log an info message
	 * @param message - The message to log
	 * @param context - The context of the log
	 * @returns A promise that resolves when the log is logged
	 * @throws If the ErrorHandlingService fails to handle the error
	 * @throws If the error is not an Error object
	 */
	info(message: string, context?: LogContext): void {
		this.log('info', message, context);
	}

	/**
	 * Log a warning message
	 * @param message - The message to log
	 * @param context - The context of the log
	 * @returns A promise that resolves when the log is logged
	 * @throws If the ErrorHandlingService fails to handle the error
	 * @throws If the error is not an Error object
	 */
	warn(message: string, context?: LogContext): void {
		this.log('warn', message, context);
	}

	/**
	 * Log an error message and optionally use ErrorHandlingService for structured error handling
	 * @param message - The error message to log
	 * @param error - The error object to log
	 * @param context - The context of the error
	 * @returns A promise that resolves when the error is logged
	 * @throws If the ErrorHandlingService fails to handle the error
	 * @throws If the error is not an Error object
	 */
	async error(message: string, error?: Error, context?: LogErrorContext): Promise<void> {
		// Always log to console first
		const prefix = `[${this.serviceName}]`;
		if (error) {
			console.error(`${prefix} ERROR: ${message}`, error.message, context || '');
		} else {
			console.error(`${prefix} ERROR: ${message}`, context || '');
		}

		// Use ErrorHandlingService if available and we have an actual Error object
		if (this.errorHandler && error) {
			try {
				const errorContext = typeof context === 'string' 
					? {
						operation: message,
						component: this.serviceName,
						metadata: { message: context },
						timestamp: Date.now()
					}
					: {
						operation: message,
						component: this.serviceName,
						metadata: context || {},
						timestamp: Date.now()
					};
				await this.errorHandler.handleError(error, errorContext);
			} catch (handlerError) {
				console.error(`${prefix} ErrorHandler failed:`, handlerError);
			}
		}
	}

	/**
	 * Log lifecycle events (initialization, disposal, configuration changes)
	 * @param event - The lifecycle event to log
	 * @param details - Additional details about the event
	 * @returns A promise that resolves when the lifecycle event is logged
	 * @throws If the ErrorHandlingService fails to handle the error
	 * @throws If the error is not an Error object
	 */
	lifecycle(event: LogEvent, details?: string): void {
		const message = details ? `${event} - ${details}` : event;
		this.info(message);
	}

	/**
	 * Core logging method that handles console output with consistent formatting
	 * @param level - The log level
	 * @param message - The message to log
	 * @param context - The context of the log
	 * @returns A promise that resolves when the log is logged
	 * @throws If the ErrorHandlingService fails to handle the error
	 * @throws If the error is not an Error object
	 */
	private log(level: LogLevel, message: string, context?: LogContext): void {
		const prefix = `[${this.serviceName}]`;
		const contextStr = context ? JSON.stringify(context) : '';

		switch (level) {
			case 'debug':
				console.debug(`${prefix} DEBUG: ${message}`, contextStr);
				break;
			case 'info':
				console.log(`${prefix} ${message}`, contextStr);
				break;
			case 'warn':
				console.warn(`${prefix} WARN: ${message}`, contextStr);
				break;
			case 'error':
				console.error(`${prefix} ERROR: ${message}`, contextStr);
				break;
		}
	}

	/**
	 * Create a child logger for a sub-component
	 * @param subComponent - The sub-component name
	 * @returns A new Logger instance
	 * @throws If the ErrorHandlingService fails to handle the error
	 * @throws If the error is not an Error object
	 */
	child(subComponent: string): Logger {
		return new Logger(`${this.serviceName}:${subComponent}`, this.errorHandler);
	}
}

/**
 * Factory function to create loggers with consistent naming
 * @param serviceName - The name of the service
 * @param errorHandler - The ErrorHandlingService instance
 * @returns A new Logger instance
 * @throws If the ErrorHandlingService fails to handle the error
 * @throws If the error is not an Error object
 */
export function createLogger(serviceName: string, errorHandler?: ErrorHandlingService): Logger {
	return new Logger(serviceName, errorHandler);
}

/**
 * Utility function for services that need consistent lifecycle logging
 * @param logger - The Logger instance
 * @param phase - The lifecycle phase
 * @param serviceName - The name of the service
 * @param operation - The operation to log
 * @param context - The context of the operation
 * @returns A promise that resolves when the lifecycle event is logged
 * @throws If the ErrorHandlingService fails to handle the error
 * @throws If the error is not an Error object
 */
export async function logServiceLifecycle(
	logger: Logger,
	phase: 'initialize' | 'dispose' | 'configure',
	serviceName: string,
	operation: () => Promise<void> | void,
	context?: LogContext
): Promise<void> {
	try {
		logger.lifecycle(`${phase} started`, serviceName);
		await operation();
		logger.lifecycle(`${phase} completed`, serviceName);
	} catch (error) {
		await logger.error(`${phase} failed`, error as Error, context);
		throw error;
	}
}