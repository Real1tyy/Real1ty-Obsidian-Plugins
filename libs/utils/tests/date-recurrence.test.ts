import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import {
	calculateInstanceDateTime,
	calculateRecurringInstanceDateTime,
	getNextBiWeeklyOccurrence,
	getNextOccurrence,
	getNextWeekdayOccurrence,
	isDateOnWeekdays,
	iterateOccurrencesInRange,
	type Weekday,
} from "../src/date-recurrence";

describe("date-recurrence", () => {
	describe("isDateOnWeekdays", () => {
		it("should correctly identify if a date is on specified weekdays", () => {
			const monday = DateTime.fromISO("2025-10-20"); // Monday
			const friday = DateTime.fromISO("2025-10-24"); // Friday
			const sunday = DateTime.fromISO("2025-10-26"); // Sunday

			expect(isDateOnWeekdays(monday, ["monday", "wednesday", "friday"])).toBe(true);
			expect(isDateOnWeekdays(friday, ["monday", "wednesday", "friday"])).toBe(true);
			expect(isDateOnWeekdays(sunday, ["monday", "wednesday", "friday"])).toBe(false);
			expect(isDateOnWeekdays(sunday, ["sunday"])).toBe(true);
		});
	});

	describe("getNextWeekdayOccurrence", () => {
		it("should find next weekday in current week", () => {
			const wednesday = DateTime.fromISO("2025-10-22"); // Wednesday Oct 22
			const weekdays: Weekday[] = ["friday", "saturday", "sunday"];

			const next = getNextWeekdayOccurrence(wednesday, weekdays);
			expect(next.weekday).toBe(5); // Friday
			expect(next.toISODate()).toBe("2025-10-24"); // Friday Oct 24
		});

		it("should wrap to next week if no more weekdays in current week", () => {
			const saturday = DateTime.fromISO("2025-10-25"); // Saturday Oct 25
			const weekdays: Weekday[] = ["monday", "wednesday", "friday"];

			const next = getNextWeekdayOccurrence(saturday, weekdays);
			expect(next.weekday).toBe(1); // Monday
			expect(next.toISODate()).toBe("2025-10-27"); // Monday Oct 27 (next week)
		});

		it("should handle sunday correctly", () => {
			const monday = DateTime.fromISO("2025-10-20"); // Monday
			const weekdays: Weekday[] = ["friday", "sunday"];

			const next = getNextWeekdayOccurrence(monday, weekdays);
			expect(next.weekday).toBe(5); // Friday
			expect(next.toISODate()).toBe("2025-10-24");
		});
	});

	describe("getNextBiWeeklyOccurrence", () => {
		it("should skip one week after finding next weekday", () => {
			const monday = DateTime.fromISO("2025-10-20"); // Monday
			const weekdays: Weekday[] = ["wednesday", "friday"];

			const next = getNextBiWeeklyOccurrence(monday, weekdays);
			// Should find Wednesday (Oct 22), then add 1 week = Nov 5
			expect(next.toISODate()).toBe("2025-10-29");
		});
	});

	describe("getNextOccurrence", () => {
		it("should handle daily recurrence", () => {
			const date = DateTime.fromISO("2025-10-20");
			const next = getNextOccurrence(date, "daily");
			expect(next.toISODate()).toBe("2025-10-21");
		});

		it("should handle weekly recurrence without weekdays", () => {
			const date = DateTime.fromISO("2025-10-20");
			const next = getNextOccurrence(date, "weekly");
			expect(next.toISODate()).toBe("2025-10-27");
		});

		it("should handle monthly recurrence", () => {
			const date = DateTime.fromISO("2025-10-20");
			const next = getNextOccurrence(date, "monthly");
			expect(next.toISODate()).toBe("2025-11-20");
		});

		it("should handle yearly recurrence", () => {
			const date = DateTime.fromISO("2025-10-20");
			const next = getNextOccurrence(date, "yearly");
			expect(next.toISODate()).toBe("2026-10-20");
		});
	});

	describe("iterateOccurrencesInRange - BUG REPRODUCTION", () => {
		it("should generate all weekday occurrences in the same week for weekly recurrence", () => {
			// Start on Wednesday Oct 22, 2025
			const startDate = DateTime.fromISO("2025-10-22T08:30:00Z");
			const weekdays: Weekday[] = ["friday", "saturday", "sunday"];

			// Range: from Monday Oct 20 to Sunday Nov 2
			const rangeStart = DateTime.fromISO("2025-10-20");
			const rangeEnd = DateTime.fromISO("2025-11-02");

			const occurrences = Array.from(
				iterateOccurrencesInRange(startDate, { type: "weekly", weekdays }, rangeStart, rangeEnd)
			);

			const dates = occurrences.map((d) => d.toISODate());

			// EXPECTED: Should generate events for:
			// Week 1 (Oct 20-26): Friday Oct 24, Saturday Oct 25, Sunday Oct 26
			// Week 2 (Oct 27-Nov 2): Friday Oct 31, Saturday Nov 1, Sunday Nov 2
			expect(dates).toContain("2025-10-24"); // Friday week 1
			expect(dates).toContain("2025-10-25"); // Saturday week 1
			expect(dates).toContain("2025-10-26"); // Sunday week 1
			expect(dates).toContain("2025-10-31"); // Friday week 2
			expect(dates).toContain("2025-11-01"); // Saturday week 2
			expect(dates).toContain("2025-11-02"); // Sunday week 2

			expect(dates.length).toBe(6); // Should have 6 occurrences total
		});

		it("should generate weekly occurrences starting from Monday with Friday, Saturday, Sunday", () => {
			// Today is Monday Oct 20, 2025
			const today = DateTime.fromISO("2025-10-20T10:00:00Z");
			const weekdays: Weekday[] = ["friday", "saturday", "sunday"];

			// Range: from today to end of next week
			const rangeStart = today;
			const rangeEnd = DateTime.fromISO("2025-11-02");

			const occurrences = Array.from(
				iterateOccurrencesInRange(today, { type: "weekly", weekdays }, rangeStart, rangeEnd)
			);

			const dates = occurrences.map((d) => d.toISODate());

			// EXPECTED: Should include ALL matching weekdays going forward
			// This week: Friday Oct 24, Saturday Oct 25, Sunday Oct 26
			// Next week: Friday Oct 31, Saturday Nov 1, Sunday Nov 2
			expect(dates).toEqual([
				"2025-10-24", // Friday this week
				"2025-10-25", // Saturday this week
				"2025-10-26", // Sunday this week
				"2025-10-31", // Friday next week
				"2025-11-01", // Saturday next week
				"2025-11-02", // Sunday next week
			]);
		});

		it("should handle weekly recurrence with single weekday", () => {
			const startDate = DateTime.fromISO("2025-10-20");
			const weekdays: Weekday[] = ["wednesday"];

			const rangeStart = DateTime.fromISO("2025-10-20");
			const rangeEnd = DateTime.fromISO("2025-11-10");

			const occurrences = Array.from(
				iterateOccurrencesInRange(startDate, { type: "weekly", weekdays }, rangeStart, rangeEnd)
			);

			const dates = occurrences.map((d) => d.toISODate());

			expect(dates).toEqual([
				"2025-10-22", // Wed Oct 22
				"2025-10-29", // Wed Oct 29
				"2025-11-05", // Wed Nov 5
			]);
		});

		it("should handle bi-weekly recurrence with multiple weekdays", () => {
			const startDate = DateTime.fromISO("2025-10-20"); // Monday
			const weekdays: Weekday[] = ["tuesday", "thursday"];

			const rangeStart = DateTime.fromISO("2025-10-20");
			const rangeEnd = DateTime.fromISO("2025-11-15");

			const occurrences = Array.from(
				iterateOccurrencesInRange(startDate, { type: "bi-weekly", weekdays }, rangeStart, rangeEnd)
			);

			const dates = occurrences.map((d) => d.toISODate());

			// EXPECTED: Bi-weekly means every 2 weeks
			// Week 1 (Oct 20-26): Tuesday Oct 21, Thursday Oct 23
			// Week 2 (Oct 27-Nov 2): Skip
			// Week 3 (Nov 3-9): Tuesday Nov 4, Thursday Nov 6
			// Week 4 (Nov 10-16): Skip
			expect(dates).toContain("2025-10-21"); // Tue week 1
			expect(dates).toContain("2025-10-23"); // Thu week 1
			expect(dates).toContain("2025-11-04"); // Tue week 3
			expect(dates).toContain("2025-11-06"); // Thu week 3
		});

		it("should handle daily recurrence", () => {
			const startDate = DateTime.fromISO("2025-10-20");
			const rangeStart = DateTime.fromISO("2025-10-20");
			const rangeEnd = DateTime.fromISO("2025-10-25");

			const occurrences = Array.from(
				iterateOccurrencesInRange(startDate, { type: "daily" }, rangeStart, rangeEnd)
			);

			expect(occurrences.length).toBe(6); // Oct 20-25 inclusive
		});

		it("should handle monthly recurrence", () => {
			const startDate = DateTime.fromISO("2025-10-15");
			const rangeStart = DateTime.fromISO("2025-10-15");
			const rangeEnd = DateTime.fromISO("2025-12-31");

			const occurrences = Array.from(
				iterateOccurrencesInRange(startDate, { type: "monthly" }, rangeStart, rangeEnd)
			);

			const dates = occurrences.map((d) => d.toISODate());
			expect(dates).toEqual(["2025-10-15", "2025-11-15", "2025-12-15"]);
		});
	});

	describe("calculateInstanceDateTime", () => {
		it("should handle date with time", () => {
			const date = DateTime.fromISO("2025-10-20");
			const result = calculateInstanceDateTime(date, "14:30");

			expect(result.hour).toBe(14);
			expect(result.minute).toBe(30);
			expect(result.toISODate()).toBe("2025-10-20");
		});

		it("should handle date without time", () => {
			const date = DateTime.fromISO("2025-10-20T10:00:00");
			const result = calculateInstanceDateTime(date);

			expect(result.hour).toBe(0);
			expect(result.minute).toBe(0);
			expect(result.toISODate()).toBe("2025-10-20");
		});
	});

	describe("calculateRecurringInstanceDateTime", () => {
		it("should preserve time for daily recurrence", () => {
			const nextInstance = DateTime.fromISO("2025-10-21");
			const originalEvent = DateTime.fromISO("2025-10-20T14:30:00");

			const result = calculateRecurringInstanceDateTime(
				nextInstance,
				originalEvent,
				"daily",
				false
			);

			expect(result.hour).toBe(14);
			expect(result.minute).toBe(30);
			expect(result.toISODate()).toBe("2025-10-21");
		});

		it("should preserve day and time for monthly recurrence", () => {
			const nextInstance = DateTime.fromISO("2025-11-01");
			const originalEvent = DateTime.fromISO("2025-10-15T09:00:00");

			const result = calculateRecurringInstanceDateTime(
				nextInstance,
				originalEvent,
				"monthly",
				false
			);

			expect(result.day).toBe(15);
			expect(result.hour).toBe(9);
			expect(result.minute).toBe(0);
			expect(result.toISODate()).toBe("2025-11-15");
		});

		it("should handle all-day events", () => {
			const nextInstance = DateTime.fromISO("2025-10-21");
			const originalEvent = DateTime.fromISO("2025-10-20T14:30:00");

			const result = calculateRecurringInstanceDateTime(nextInstance, originalEvent, "daily", true);

			expect(result.hour).toBe(0);
			expect(result.minute).toBe(0);
			expect(result.toISODate()).toBe("2025-10-21");
		});

		it("should preserve month and day for yearly recurrence", () => {
			const nextInstance = DateTime.fromISO("2026-01-01");
			const originalEvent = DateTime.fromISO("2025-10-20T10:00:00");

			const result = calculateRecurringInstanceDateTime(
				nextInstance,
				originalEvent,
				"yearly",
				false
			);

			expect(result.month).toBe(10);
			expect(result.day).toBe(20);
			expect(result.hour).toBe(10);
			expect(result.toISODate()).toBe("2026-10-20");
		});
	});
});
