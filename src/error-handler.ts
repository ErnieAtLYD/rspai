// src/error-handler.ts

import { Logger } from "./logger";

export class ErrorHandler {
	constructor(private logger: Logger) {}

	/**
     * Wrapper for async operations with error handling. 
     * 
     * @param operation - The function to execute
     * @param errorMessage - The message to display if an error occurs
     * @param showToUser - Whether to show the error to the user
     * @returns The result of the operation or null if an error occurs
     */
	async safeAsync<T>(
		operation: () => Promise<T>,
		errorMessage: string,
		showToUser = false
	): Promise<T | null> {
		try {
			return await operation();
		} catch (error) {
			this.logger.error(errorMessage, error, showToUser);
			return null;
		}
	}

	/**
     * Wrapper for sync operations with error handling. 
     * 
     * @param operation - The function to execute
     * @param errorMessage - The message to display if an error occurs
     * @param showToUser - Whether to show the error to the user
     * @returns The result of the operation or null if an error occurs
     */
	safe<T>(
		operation: () => T,
		errorMessage: string,
		showToUser = false
	): T | null {
		try {
			return operation();
		} catch (error) {
			this.logger.error(errorMessage, error, showToUser);
			return null;
		}
	}
}
