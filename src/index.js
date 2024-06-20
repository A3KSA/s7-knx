/**
 * @fileoverview
 * This script is used to read and write values from a KNX bus to a S7 PLC.
 * It uses the node-snap7 library to read and write values from the PLC.
 * It uses the knx library to read and write values from the KNX bus.
 * @author Zacharie Monnet
 * @version 2.0.0
 * @copyright
 */

const dotenv = require("dotenv");
dotenv.config();

// Express
const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

const exitHook = require("async-exit-hook");

// S7
const s7client = require("./s7");

// DEBUG
const debugS7 = require("debug")("s7-knx:s7");

// Queue
const queue = require("./queue");

// KNX
const knxConnection = require("./knx");
const KNXGroupAddress = require("./KNXGroupAddress");

// CONSTANTS
const DB_NUMBER = Number(process.env.S7_DB);
const STRUCT_SIZE = 14;
const START_OFFSET = 2;

const { structUDTType } = require("./CONSTANTS");

// VARIABLES
var dbSize = 0;
var objects = [];
var counter = 0


/**
 * Send the values from the PLC to the KNX bus
 * 
 */
async function sendSyncKNX() {
	const item = queue.dequeue()
	if (item != undefined) {
		counter++

		debugS7("PLC -> KNX : " + item.groupAddress + " : " + item.value + " -> Counter " + counter);
		knxConnection.connection.write(item.groupAddress, item.value, item.dpt);
	}

}

/**
 * Map the buffer to objects
 * @param {Buffer} buffer
 * @returns 
 */
async function mapBufferToObjects(buffer) {
	var i = 0;
	var type = buffer.readInt16BE(2 + 4); // Int - 2 bytes at offset 4 (2 bytes for the size of the buffer)

	for (
		let offset = START_OFFSET; offset < buffer.length; offset += structUDTType[type].size
	) {
		type = buffer.readInt16BE(offset + 4); // Int - 2 bytes at offset 4 (2 bytes for the size of the buffer)
		let objectBuffer = buffer.subarray(offset, offset + structUDTType[type].size);

		// create a new object if it doesn't exist
		if (objects[i] == null) {
			objects[i] = new KNXGroupAddress(offset);
		} else {
			// Update the offset of the object
			objects[i].offset = offset;

			// update the object with the new buffer
			await objects[i].update(objectBuffer);
		}

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
	debugS7("Trying to connect to PLC at : " + process.env.S7_ip)
	debugS7("PLC KNX DB Number : " + DB_NUMBER)
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

		setTimeout(readDB, 100);
	});
}



function generateHTMLTable(data) {
	let html = '<table border="1"><tr>';
	for (let key in data[0]) {
		html += `<th>${key}</th>`;
	}
	html += '</tr>';
	data.forEach(item => {
		html += '<tr>';
		for (let key in item) {
			html += `<td>${item[key]}</td>`;
		}
		html += '</tr>';
	});
	html += '</table>';
	return html;
}

function expressServer() {
	app.get("/", (req, res) => {
		res.send("Hello World!");
	});

	app.get("/knx", (req, res) => {
		if (objects.length > 0) {
			const plainObjects = objects.map(obj => obj.toPlainObject());
			res.send(generateHTMLTable(plainObjects));
		} else {
			res.send("No data available");
		}
	});

	app.get("/knx/:id", (req, res) => {
		const id = req.params.id;
		res.send(objects[id]);
	});

	app.get("/knx/:id/:value", (req, res) => {
		const id = req.params.id;
		const value = req.params.value;
		objects[id].val_int = value;
		res.send(objects[id]);
	});

	app.get("/knx/:id/:value/:type", (req, res) => {
		const id = req.params.id;
		const value = req.params.value;
		const type = req.params.type;
		objects[id].val_int = value;
		objects[id].Type = type;
		res.send(objects[id]);
	});

	app.listen(port, () => {
		console.log(`Listening on port ${port}`);
	});
}

/**
 * Main function
 */
async function main() {
	try {
		expressServer();
		await knxConnection.setupKNX(); // Wait for KNX connection to be established
		await setupS7(); // Proceed with setupS7 only after KNX is connected
		setInterval(sendSyncKNX, 20)
		exitHook((cb) => {
			console.log("Disconnecting from KNX…");
			knxConnection.connection.Disconnect(() => {
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