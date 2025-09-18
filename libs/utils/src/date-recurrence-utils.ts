import type { DateTime } from "luxon";

export type RecurrenceType = "daily" | "weekly" | "bi-weekly" | "monthly" | "bi-monthly" | "yearly";

export type Weekday =
	| "sunday"
	| "monday"
	| "tuesday"
	| "wednesday"
	| "thursday"
	| "friday"
	| "saturday";

export const WEEKDAY_TO_NUMBER: Record<Weekday, number> = {
	sunday: 0,
	monday: 1,
	tuesday: 2,
	wednesday: 3,
	thursday: 4,
	friday: 5,
	saturday: 6,
};

/**
 * Calculates the next occurrence date based on recurrence type and optional weekdays
 */
export function getNextOccurrence(
	currentDate: DateTime,
	recurrenceType: RecurrenceType,
	weekdays?: Weekday[]
): DateTime {
	switch (recurrenceType) {
		case "daily":
			return currentDate.plus({ days: 1 });
		case "weekly":
			if (weekdays && weekdays.length > 0) {
				return getNextWeekdayOccurrence(currentDate, weekdays);
			}
			return currentDate.plus({ weeks: 1 });
		case "bi-weekly":
			if (weekdays && weekdays.length > 0) {
				return getNextBiWeeklyOccurrence(currentDate, weekdays);
			}
			return currentDate.plus({ weeks: 2 });
		case "monthly":
			return currentDate.plus({ months: 1 });
		case "bi-monthly":
			return currentDate.plus({ months: 2 });
		case "yearly":
			return currentDate.plus({ years: 1 });
		default:
			return currentDate.plus({ days: 1 });
	}
}

/**
 * Checks if a given date matches any of the specified weekdays
 */
export function isDateOnWeekdays(date: DateTime, weekdays: Weekday[]): boolean {
	const dateWeekday = date.weekday;
	const luxonWeekdays = weekdays.map((day) => {
		const dayNumber = WEEKDAY_TO_NUMBER[day];
		return dayNumber === 0 ? 7 : dayNumber; // Convert Sunday from 0 to 7 for Luxon
	});

	return luxonWeekdays.includes(dateWeekday);
}

/**
 * Finds the next occurrence on specified weekdays
 */
export function getNextWeekdayOccurrence(currentDate: DateTime, weekdays: Weekday[]): DateTime {
	const currentWeekday = currentDate.weekday;
	const luxonWeekdays = weekdays.map((day) => {
		const dayNumber = WEEKDAY_TO_NUMBER[day];
		return dayNumber === 0 ? 7 : dayNumber; // Convert Sunday from 0 to 7 for Luxon
	});

	// Find next weekday in the current week (after today)
	const nextWeekday = luxonWeekdays.find((day) => day > currentWeekday);
	if (nextWeekday) {
		return currentDate.set({ weekday: nextWeekday as 1 | 2 | 3 | 4 | 5 | 6 | 7 });
	}

	// No more weekdays this week, go to first weekday of next week
	const firstWeekday = Math.min(...luxonWeekdays);
	return currentDate.plus({ weeks: 1 }).set({ weekday: firstWeekday as 1 | 2 | 3 | 4 | 5 | 6 | 7 });
}

/**
 * Finds the next bi-weekly occurrence on specified weekdays
 */
export function getNextBiWeeklyOccurrence(currentDate: DateTime, weekdays: Weekday[]): DateTime {
	const nextWeekly = getNextWeekdayOccurrence(currentDate, weekdays);
	// Add one more week to make it bi-weekly
	return nextWeekly.plus({ weeks: 1 });
}

export function* iterateOccurrencesInRange(
	startDate: DateTime,
	rrules: { type: RecurrenceType; weekdays?: Weekday[] },
	rangeStart: DateTime,
	rangeEnd: DateTime
): Generator<DateTime, void, unknown> {
	let currentDate = startDate >= rangeStart ? startDate : rangeStart;

	while (currentDate <= rangeEnd) {
		// Check if current date should have an event
		let shouldAddEvent = false;

		if (rrules.type === "daily") {
			shouldAddEvent = true;
		} else if (rrules.type === "weekly" || rrules.type === "bi-weekly") {
			if (rrules.weekdays && rrules.weekdays.length > 0) {
				shouldAddEvent = isDateOnWeekdays(currentDate, rrules.weekdays);
			} else {
				shouldAddEvent = true;
			}
		} else {
			shouldAddEvent = true;
		}

		if (shouldAddEvent) {
			yield currentDate;
		}

		const nextDate = getNextOccurrence(currentDate, rrules.type, rrules.weekdays);

		if (nextDate <= rangeEnd) {
			currentDate = nextDate;
		} else {
			break;
		}
	}
}

/**
 * Calculates a DateTime for a specific date with optional time
 */
export function calculateInstanceDateTime(instanceDate: DateTime, timeString?: string): DateTime {
	if (!timeString) {
		return instanceDate.startOf("day");
	}

	const [hours, minutes] = timeString.split(":").map(Number);
	return instanceDate.set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });
}

export function calculateRecurringInstanceDateTime(
	nextInstanceDateTime: DateTime,
	nodeRecuringEventDateTime: DateTime,
	recurrenceType: RecurrenceType,
	allDay?: boolean
): DateTime {
	switch (recurrenceType) {
		case "daily":
		case "weekly":
		case "bi-weekly": {
			if (allDay) {
				return nextInstanceDateTime.startOf("day");
			}
			return nextInstanceDateTime.set({
				hour: nodeRecuringEventDateTime.hour,
				minute: nodeRecuringEventDateTime.minute,
				second: 0,
				millisecond: 0,
			});
		}

		case "monthly":
		case "bi-monthly": {
			if (allDay) {
				// Inherit day from original, set time to 00:00
				return nextInstanceDateTime.set({ day: nodeRecuringEventDateTime.day }).startOf("day");
			}

			// Inherit day + time from original
			return nodeRecuringEventDateTime.set({
				year: nextInstanceDateTime.year,
				month: nextInstanceDateTime.month,
			});
		}

		case "yearly": {
			if (allDay) {
				return nextInstanceDateTime
					.set({
						month: nodeRecuringEventDateTime.month,
						day: nodeRecuringEventDateTime.day,
					})
					.startOf("day");
			}

			return nodeRecuringEventDateTime.set({
				year: nextInstanceDateTime.year,
			});
		}

		default:
			return nextInstanceDateTime.startOf("day");
	}
}
