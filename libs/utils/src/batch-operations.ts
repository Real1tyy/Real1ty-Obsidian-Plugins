import { Notice } from "obsidian";

export interface BatchOperationOptions {
	closeAfter?: boolean;
	callOnComplete?: boolean;
}

export interface BatchOperationResult {
	successCount: number;
	errorCount: number;
}

export async function runBatchOperation<T>(
	items: T[],
	operationLabel: string,
	handler: (item: T) => Promise<void>,
	showResult: boolean = true
): Promise<BatchOperationResult> {
	let successCount = 0;
	let errorCount = 0;

	for (const item of items) {
		try {
			await handler(item);
			successCount++;
		} catch (error) {
			console.error(`${operationLabel}: error processing item:`, error);
			errorCount++;
		}
	}

	if (showResult) {
		showBatchOperationResult(operationLabel, successCount, errorCount);
	}

	return { successCount, errorCount };
}

export function showBatchOperationResult(
	operation: string,
	successCount: number,
	errorCount: number
): void {
	if (errorCount === 0) {
		new Notice(
			`${operation}: ${successCount} item${successCount === 1 ? "" : "s"} processed successfully`
		);
	} else {
		new Notice(
			`${operation}: ${successCount} succeeded, ${errorCount} failed. Check console for details.`
		);
	}
}
