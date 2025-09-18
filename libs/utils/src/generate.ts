export interface TimestampData {
	startDate: string;
	zettelId: number;
}

export const generateZettelId = (): number => {
	const currentTimestamp = new Date();
	const padWithZero = (number: number) => String(number).padStart(2, "0");
	return Number(
		`${currentTimestamp.getFullYear()}${padWithZero(currentTimestamp.getMonth() + 1)}${padWithZero(currentTimestamp.getDate())}${padWithZero(currentTimestamp.getHours())}${padWithZero(currentTimestamp.getMinutes())}${padWithZero(currentTimestamp.getSeconds())}`
	);
};

export const generateTimestamps = (): TimestampData => {
	const padWithZero = (number: number): string => String(number).padStart(2, "0");
	const currentDate = new Date();

	const formattedStartDate: string = `${currentDate.getFullYear()}-${padWithZero(currentDate.getMonth() + 1)}-${padWithZero(currentDate.getDate())}`;
	const uniqueZettelId: number = generateZettelId();

	return { startDate: formattedStartDate, zettelId: uniqueZettelId };
};
