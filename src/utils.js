/**
 * Remove leading zeros from a string
 * @param {String} value
 * @returns
 */
function removeLeadingZeros(value) {
	// Check if the value is "0" or only contains zeros, return "0"
	if (value === "0" || /^0+$/.test(value)) {
		return "0";
	}

	// Remove leading zeros and return the result
	return value.replace(/^0+/, "");
}


// Function to clamp values
function clamp(val, min, max) {
	return Math.max(min, Math.min(max, val));
}


// Function to compare two values
function compareValues(val1, val2) {
	if (typeof val1 !== typeof val2) return false;
	if (typeof val1 === 'object') {
		return JSON.stringify(val1) === JSON.stringify(val2);
	}
	return val1 === val2;
}


module.exports = {
	removeLeadingZeros,
	clamp,
	compareValues
};