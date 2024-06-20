const {removeLeadingZeros, clamp, compareValues} = require('./utils');
const EventEmitter = require("events");
const debugGA = require("debug")("s7-knx:ga");
const debugS7 = require("debug")("s7-knx:s7");
const debugQueue = require("debug")("s7-knx:queue");
const debugKNX = require("debug")("s7-knx:knx");
const DPTLib = require("knx/src/dptlib");
const knxConnection = require("./knx");
const queue = require("./queue");
const plcConnection = require("./s7/connection");
const { structUDTType } = require("./CONSTANTS");


// KNX Group Address Object
class KNXGroupAddress extends EventEmitter {
	constructor(offset) {
		super();
		this._previousValue = null;

		// Unformatted GA
		this._previousGA = null;

		// Formatted GA
		this._previousGroupAddress = null;

		this.groupAddress = "0/0/0";
		this.offset = offset;
		this.dpt = "DPT1.001";
		this.byte = [];

	}

    toPlainObject() {
        return {
            groupAddress: this.groupAddress,
            offset: this.offset,
            dpt: this.dpt,
            val_bool: this.val_bool,
            val_int: this.val_int,
            val_real: this.val_real,
            isReadOnly: this.isReadOnly,
            isWriteOnly: this.isWriteOnly,
            send_request: this.send_request,
            send_ack: this.send_ack,
            sendByChange: this.sendByChange,
            Type: this.type,
			byte : this.byte
        }
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

		try {
			if (this._previousGroupAddress) {
				debugGA("Removing listener for " + this._previousGroupAddress + "…");
				this.removeListeners("GroupValue_Write_" + this._previousGroupAddress);
			}
		} catch (error) {
			throw new Error(error, this._previousGroupAddress)
		}

		// If on the PLC side, the variable is WRITE ONLY, we don't need to setup a listener to send the value to the PLC
		if (!this.isWriteOnly) {
			this.setupListeners("GroupValue_Write_" + this.groupAddress);
		}


		this.dpt = "DPT" + this.type + ".001";

		debugGA(
			"GA changed from " + this._previousGroupAddress + " to " + this.groupAddress + " with DPT " + this.dpt + " and type " + this.type 
		);

		this._previousGroupAddress = this.groupAddress;
	}

	// Update the object with the given buffer
	async update(buffer) {
		const structOffset = 0;
		this.GA = buffer.readUInt32BE(structOffset); // DWord - 4 bytes at offset 0
		this.type = buffer.readInt16BE(structOffset + 4); // Int - 2 bytes at offset 4

		// Reading a byte and extracting bits for boolean values
		const boolByte = buffer.readUInt8(structOffset + 6);

		this.isReadOnly = !!(boolByte & 0x01); // Bool at bit 0
		this.isWriteOnly = !!(boolByte & 0x02); // Bool at bit 1
		this.send_request = !!(boolByte & 0x04); // Bool at bit 2
		this.send_ack = !!(boolByte & 0x08); // Bool at bit 3
		this.sendByChange = false // For future use - If the value is sent when it changes

		if (structUDTType[this.type].type == "Generic") {
		this.val_bool = !!(boolByte & 0x10); // Bool at bit 4
		this.val_int = buffer.readInt16BE(structOffset + 8); // Int - 2 bytes at offset 8
		this.val_real = buffer.readFloatBE(structOffset + 10); // Real - 4 bytes at offset 10
		// Total size for one entry: 14 bytes
		} else if (structUDTType[this.type].type == "232") {
			this.byte[0] = buffer.readUInt8(structOffset + 7);
			this.byte[1] = buffer.readUInt8(structOffset + 8);
			this.byte[2] = buffer.readUInt8(structOffset + 9);
		}

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
		switch (this.type) {
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
				// convert the int value to a buffer, if it's a real value, it will be rounded
				buffer = Buffer.alloc(4);
				buffer.writeFloatBE(this.val_real);
				offset = this.offset + 10;
				this._previousValue = this.val_real;
				break;
			case 14:
				debugS7(
					"KNX -> PLC : " +
					this.groupAddress +
					" = " +
					this.val_real +
					" : " +
					this.offset
				);
				// convert the int value to a buffer, if it's a real value, it will be rounded
				buffer = Buffer.alloc(4);
				buffer.writeFloatBE(this.val_real);
				offset = this.offset + 10;
				this._previousValue = this.val_real;
				break;
			case 232:
				debugS7(
					"KNX -> PLC : " +
					this.groupAddress +
					" = " +
					this.byte +
					" : " +
					this.offset
				);
				// convert the real value to a buffer
				buffer = Buffer.from(this.byte);
				
				offset = this.offset + 7;
				this._previousValue = this.byte;
				break;

			default:
				debugS7("Type not supported at " + this.offset + " : " + this.type);
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
		await plcConnection.writeDB(offset, buffer);
	}

	// Write the value to the KNX bus
	async writeToBUS(value) {
		const item = {
			groupAddress: this.groupAddress,
			value: value,
			dpt: this.dpt
		}
		debugQueue("Enqueue " + item.groupAddress + " " + item.value)
		queue.enqueue(item)
		return;
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
		switch (this.type) {
			case 1:
				value = this.val_bool;
				break;

			case 5:
				this.val_int = clamp(this.val_int, 0, 100);
				value = this.val_int;
				break;

			case 9:
				value = this.val_real;
				break;

			case 14:
				value = this.val_real;
				break;

			case 232:
				value = { red: this.byte[0], green: this.byte[1], blue: this.byte[2] };
				break;

			default:
				debugS7("sendtoBus : Type not supported at " + this.offset + " : " + this.type);
				break;
		}

		// Prevent sending the value to the KNX bus at startup
		if (this._previousValue == null) {
			this._previousValue = value;
			return;
		}

		// If the value is the same as the previous one, we don't need to send it, except if there was a request from the PLC
		if (compareValues(value, this._previousValue) && !this.send_request) {
			return;
		}
		
		// If previous value is the same as the current value and the request and ack are true, we don't need to send it
		if (compareValues(value, this._previousValue) && this.send_request && this.send_ack) {
			return;
		}

		// Send the value to the KNX bus
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
		knxConnection.connection.on(eventName, (...args) => this.eventHandler(...args));
	}

	/**
	 * eventHandler for the KNX event listener
	 * @param {String} src KNX Device Address
	 * @param {String} value
	 */
	eventHandler(src, value) {
		var convertedValue = this.convertFromDPT(value);
		switch (this.type) {
			case 1:
				this.val_bool = convertedValue;
				break;
			case 5:
				this.val_int = convertedValue;
				break;
			case 9:
				this.val_real = convertedValue;
				break;
			case 14:
				this.val_real = convertedValue;
				break;
			case 232:
				this.byte[0] = convertedValue.red
				this.byte[1] = convertedValue.green
				this.byte[2] = convertedValue.blue
				break;
			default:
				debugKNX("eventHandler : Type not supported");
				break;
		}

		this.sendToPLC();
	}

	/**
	 * Remove the listeners for the given event name
	 * @param {String} eventName
	 */
	removeListeners(eventName) {
		knxConnection.connection.off(eventName, this.eventHandler.bind(this));
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

module.exports = KNXGroupAddress;