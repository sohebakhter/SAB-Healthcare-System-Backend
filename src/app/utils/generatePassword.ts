import crypto from "crypto";

export const generatePassword = (length = 12): string => {
	if (length < 8) {
		throw new Error("Password must be at least 8 characters long");
	}

	const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	const lower = "abcdefghijklmnopqrstuvwxyz";
	const number = "0123456789";
	const special = "!@#$%^&*";

	const allChars = upper + lower + number + special;

	const chars = [
		upper[crypto.randomInt(upper.length)],
		lower[crypto.randomInt(lower.length)],
		number[crypto.randomInt(number.length)],
		special[crypto.randomInt(special.length)],
	];

	while (chars.length < length) {
		chars.push(allChars[crypto.randomInt(allChars.length)]);
	}

	return chars.sort(() => crypto.randomInt(2) - 1).join("");
};
