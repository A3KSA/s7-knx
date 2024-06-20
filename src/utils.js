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

module.exports = {
    removeLeadingZeros,
};