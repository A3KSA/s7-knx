/**
 * @fileoverview
 * This script is used to read and write values from a KNX bus to a S7 PLC.
 * It uses the node-snap7 library to read and write values from the PLC.
 * It uses the knx library to read and write values from the KNX bus.
 * @author Zacharie Monnet
 * @version 1.0.0
 * @copyright
 */

const dotenv = require("dotenv");
dotenv.config();

const exitHook = require("async-exit-hook");

var snap7 = require("node-snap7");
var s7client = new snap7.S7Client();

// KNX
const knx = require("knx");
const DPTLib = require("knx/src/dptlib");

// DEBUG
const debugKNX = require("debug")("s7-knx:knx");
const debugS7 = require("debug")("s7-knx:s7");
const debugGA = require("debug")("s7-knx:ga");

const EventEmitter = require("events");

// CONSTANTS
const DB_NUMBER = Number(process.env.S7_DB);
const STRUCT_SIZE = 14;
const START_OFFSET = 2;

// VARIABLES
var dbSize = 0;
var connection = null;

let objects = [];

// KNX Group Address Object
class KNXGroupAddress extends EventEmitter {
	constructor(buffer, offset) {
		super();
		this._previousValue = null;

		// Unformatted GA
		this._previousGA = null;

		// Formatted GA
		this._previousGroupAddress = null;

		this.groupAddress = "0/0/0";
		this.offset = offset;
		this.dpt = "DPT1.001";
	}

	// function to translate the GA (groupAdress) to a KNX string like 0/00/000 because this.GA format is 0000000
	async setGA() {
		let strGA = this.GA.toString();
		let GA = strGA.padStart(7, "0");
		let GA1 = GA.slice(0, 2);
		let GA2 = GA.slice(2, 4);
		let GA3 = GA.slice(4, 7);
		GA1 = removeLeadingZeros(GA1);
		GA2 = removeLeadingZeros(GA2);
		GA3 = removeLeadingZeros(GA3);

		this.groupAddress = GA1 + "/" + GA2 + "/" + GA3;

		if (this._previousGroupAddress) {
			debugGA("Removing listener for " + this._previousGroupAddress + "…");
			this.removeListeners("GroupValue_Write_" + this._previousGroupAddress);
		}

		// If on the PLC side, the variable is WRITE ONLY, we don't need to setup a listener to send the value to the PLC
		if (!this.isWriteOnly) {
			this.setupListeners("GroupValue_Write_" + this.groupAddress);
		}


		this.dpt = "DPT" + this.Type + ".001";

		debugGA(
			"GA changed from " + this._previousGroupAddress + " to " + this.groupAddress
		);

		this._previousGroupAddress = this.groupAddress;
	}

	// Update the object with the given buffer
	async update(buffer) {
		this.GA = buffer.readUInt32BE(this.offset); // DWord - 4 bytes at offset 0
		this.Type = buffer.readInt16BE(this.offset + 4); // Int - 2 bytes at offset 4

		// Reading a byte and extracting bits for boolean values
		const boolByte = buffer.readUInt8(this.offset + 6);

		this.isReadOnly = !!(boolByte & 0x01); // Bool at bit 0
		this.isWriteOnly = !!(boolByte & 0x02); // Bool at bit 1
		this.send_request = !!(boolByte & 0x04); // Bool at bit 2
		this.send_ack = !!(boolByte & 0x08); // Bool at bit 3

		this.val_bool = !!(boolByte & 0x10); // Bool at bit 4


		this.val_int = buffer.readInt16BE(this.offset + 8); // Int - 2 bytes at offset 8
		this.val_real = buffer.readFloatBE(this.offset + 10); // Real - 4 bytes at offset 10
		// Total size for one entry: 14 bytes

		// Format the GA to a KNX string
		if (this.GA != this._previousGA) {
			this._previousGA = this.GA;

			await this.setGA();
		}

		// Send the value to the KNX bus if from the PLC side, the variable IS NOT READ ONLY
		if (!this.isReadOnly) {
			await this.sendToBus();
		}
	}

	async sendToPLC() {
		// switch to write to a different variable in function of the type value
		var buffer = null;
		var offset = 0;
		var myByte = 0;
		switch (this.Type) {
			case 1:
				debugS7(
					"KNX -> PLC : " +
					this.groupAddress +
					" = " +
					this.val_bool +
					" DB Offset : " +
					this.offset
				);
				// convert the boolean value to a buffer
				if (this.isReadOnly) myByte |= 1 << 0; // Set 1st bit - Read Only
				if (this.isWriteOnly) myByte |= 1 << 1; // Set 2nd bit - Write Only
				if (this.send_request) myByte |= 1 << 2; // Set 3rd bit - Send Request
				if (this.send_ack) myByte |= 1 << 3; // Set 4th bit - Send Acknowledge
				if (this.val_bool) myByte |= 1 << 4; // Set 5rd bit - Value (bool)

				buffer = Buffer.from([myByte]);
				offset = this.offset + 6;
				this._previousValue = this.val_bool;
				break;
			case 5:
				debugS7(
					"KNX -> PLC : " +
					this.groupAddress +
					" = " +
					this.val_int +
					" : " +
					this.offset
				);
				// convert the int value to a buffer, if it's a real value, it will be rounded
				buffer = Buffer.alloc(2);
				buffer.writeInt16BE(this.val_int);
				offset = this.offset + 8;
				this._previousValue = this.val_int;
				break;
			case 9:
				debugS7(
					"KNX -> PLC : " +
					this.groupAddress +
					" = " +
					this.val_real +
					" : " +
					this.offset
				);
				// convert the real value to a buffer
				buffer = Buffer.alloc(4);
				buffer.writeFloatBE(this.val_real);
				offset = this.offset + 10;
				this._previousValue = this.val_real;
				break;
			default:
				debugS7("Type not supported at " + this.offset + " : " + this.Type);
				break;
		}

		if (buffer !== null) {
			try {
				await this.writeToPLC(offset, buffer);
			} catch (error) {
				console.error(error);
			}
		}
	}

	// Write the buffer to the PLC
	async writeToPLC(offset, buffer) {
		return new Promise((resolve, reject) => {
			s7client.DBWrite(DB_NUMBER, offset, buffer.length, buffer, function (err) {
				if (err) {
					debugS7(" >> DBWrite failed. Code #" + err + " - " +
						s7client.ErrorText(err)
					);
					reject(err);
				} else {
					resolve();
				}

			});
		});
	}

	// Write the value to the KNX bus
	async writeToBUS(value) {
		debugKNX("PLC -> KNX : " + this.groupAddress + " : " + value);
		connection.write(this.groupAddress, value, this.dpt);
	}

	// Return the byte with its acutal value and the acknoledge bit set to 1
	async acknowledge() {
		try {
			var buffer = null;
			var offset = 0;
			var myByte = 0;
			this.send_ack = true;

			if (this.isReadOnly) myByte |= 1 << 0; // Set 1st bit
			if (this.isWriteOnly) myByte |= 1 << 1; // Set 2nd bit
			if (this.send_request) myByte |= 1 << 2; // Set 3rd bit
			if (this.send_ack) myByte |= 1 << 3; // Set 4th bit 
			if (this.val_bool) myByte |= 1 << 4; // Set 5rd bit

			buffer = Buffer.from([myByte]);
			offset = this.offset + 6;

			await this.writeToPLC(offset, buffer);
		} catch (error) {
			console.error(error);
		}

	}


	// Read the value from the PLC and send it to the KNX bus if it's different from the current value
	// The check of _previousValue is to avoid sending the value to the KNX bus at startup
	async sendToBus() {
		var value;
		// switch to write to a different variable in function of the type value
		switch (this.Type) {
			case 1:
				value = this.val_bool;
				break;

			case 5:
				if (this.val_int > 100) {
					this.val_int = 100;
				}
				if (this.val_int < 0) {
					this.val_int = 0;
				}
				value = this.val_int;
				break;

			case 9:
				value = this.val_real;

				break;

			default:
				debugS7("Type not supported at " + this.offset + " : " + this.Type);
				break;
		}

		if (this._previousValue == null) {
			this._previousValue = value;
			return;
		}

		if (value == this._previousValue && !this.send_request) {
			return;
		}

		if (value == this._previousValue && this.send_request == true && this.send_ack == true) {
			return;
		}

		

		try {
			await this.writeToBUS(value);
			this._previousValue = value;
		} catch (error) {
			console.error(error);
		}
		
		// If there was a request from the PLC, we need to acknowledge it
		if (this.send_request == true) {
			try {
				await this.acknowledge();
			} catch (error) {
				console.error(error);
			}
		}

		return;
	}

	/**
	 * Register the listeners for the given event name
	 * @param {String} eventName
	 */
	setupListeners(eventName) {
		connection.on(eventName, (...args) => this.eventHandler(...args));
	}

	/**
	 * eventHandler for the KNX event listener
	 * @param {String} src KNX Device Address
	 * @param {String} value
	 */
	eventHandler(src, value) {
		var convertedValue = this.convertFromDPT(value);
		switch (this.Type) {
			case 1:
				this.val_bool = convertedValue;
				break;
			case 5:
				this.val_int = convertedValue;
				break;
			case 9:
				this.val_real = convertedValue;
				break;
			default:
				debugKNX("Type not supported");
				break;
		}

		this.sendToPLC();
	}

	/**
	 * Remove the listeners for the given event name
	 * @param {String} eventName
	 */
	removeListeners(eventName) {
		connection.removeListener(eventName, this.eventHandler.bind(this));
	}

	/**
	 * Convert the raw value to a readable value
	 * @param {Buffer} value
	 * @param {String} dpt
	 * @returns {String} value
	 */
	convertFromDPT(value) {
		let resolvedDpt = DPTLib.resolve(this.dpt);
		let valBuff = DPTLib.fromBuffer(value, resolvedDpt);
		return valBuff;
	}
}

/**
 *
 * @param {Buffer} buffer
 * @param {Integer} objectSize
 * @returns
 */
async function mapBufferToObjects(buffer, objectSize) {
	var i = 0;
	for (
		let offset = START_OFFSET; offset < buffer.length; offset += objectSize
	) {
		// create a new object if it doesn't exist
		if (objects[i] == null) {
			objects[i] = new KNXGroupAddress(buffer, offset);
		}

		await objects[i].update(buffer);
		i++;
	}
	return objects;
}

/**
 * Setup the S7 connection
 * @returns {Promise<void>}
 * @throws {Error} If the connection fails
 *
 */
async function setupS7() {
	s7client.ConnectTo(process.env.S7_IP, 0, 1, function (err) {
		if (err)
			return debugS7(
				" >> Connection failed. Code #" + err + " - " + s7client.ErrorText(err)
			);

		s7client.DBRead(DB_NUMBER, 0, 2, function (err, res) {
			if (err)
				return debugS7(
					" >> DBGet failed. Code #" + err + " - " + s7client.ErrorText(err)
				);
			const buffer = res;
			dbSize = buffer.readUInt16BE(0);
			debugS7("DB Size : " + dbSize);

			readDB();
		});
	});
}


/**
 * Setup the KNX connection
 * @param {Int} retryDelay
 * @returns {Promise<void>}
 * @throws {Error} If the connection fails
 */
function setupKNX() {
	return new Promise((resolve, reject) => {
		debugKNX("Initializing KNX connection");
		debugKNX(process.env.KNX_IP);
		debugKNX(process.env.KNX_PORT);
		debugKNX(process.env.KNX_MANUAL_CONNECT);
		debugKNX(process.env.KNX_MIN_DELAY);
		debugKNX(process.env.KNX_ADDRESS);

		connection = knx.Connection({
			ipAddr: process.env.KNX_IP, // KNX IP gateway address
			ipPort: process.env.KNX_PORT, // default KNX IP port
			handlers: {
				connected: () => {
					debugKNX("Connected to KNX IP gateway");
					resolve(); // Resolve the promise when connected
				},
				error: (connstatus) => {
					debugKNX(`KNX connection error: ${connstatus}`);
					reject(connstatus); // Reject the promise on error
				},
				disconnected: async () => {
					debugKNX(
						"Disconnected from KNX IP gateway"
					);
				},
				event: function (evt, src, dest, value) {
					debugKNX(
						"event: %s, src: %j, dest: %j, value: %j",
						evt,
						src,
						dest,
						value
					);
				},
			},
			// Other configurations
		});
	});
}

/**
 * Read the DB from the PLC and update the objects
 * @returns {Promise<void>}
 * @throws {Error} If the connection fails
 */
async function readDB() {
	s7client.DBRead(DB_NUMBER, 0, dbSize, async function (err, res) {
		if (err)
			return debugS7(
				" >> DBGet failed. Code #" + err + " - " + s7client.ErrorText(err)
			);

		const buffer = res;
		const objectSize = STRUCT_SIZE;
		await mapBufferToObjects(buffer, objectSize);

		//debugS7(mappedObjects);

		setTimeout(readDB, 100);
	});
}

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

/**
 * Main function
 */
async function main() {
	try {
		await setupKNX(); // Wait for KNX connection to be established
		await setupS7(); // Proceed with setupS7 only after KNX is connected

		exitHook((cb) => {
			console.log("Disconnecting from KNX…");
			connection.Disconnect(() => {
				console.log("Disconnected from KNX");
				cb();
			});
		});
	} catch (error) {
		console.error("Error in setup:", error);
		// Handle any setup errors here
	}
}

main();