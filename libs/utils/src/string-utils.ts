export const capitalize = (str: string): string => {
	if (!str) return str;
	return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export const generateDuplicatedTitle = (originalTitle: string): string => {
	// Check if title already has a counter pattern like " (2)", " - Copy", etc.
	const counterMatch = originalTitle.match(/^(.*?)(?:\s*\((\d+)\)|\s*-?\s*Copy(?:\s*(\d+))?)$/);

	if (counterMatch) {
		const baseName = counterMatch[1];
		const existingCounter = counterMatch[2] || counterMatch[3];
		const nextCounter = existingCounter ? parseInt(existingCounter, 10) + 1 : 2;
		return `${baseName} (${nextCounter})`;
	} else {
		return `${originalTitle} (2)`;
	}
};

export const pluralize = (count: number): string => {
	return count === 1 ? "" : "s";
};

export const getWeekDirection = (weeks: number): "next" | "previous" => {
	return weeks > 0 ? "next" : "previous";
};
