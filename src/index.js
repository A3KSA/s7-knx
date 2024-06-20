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

const expressServer = require("./ui/express");

const exitHook = require("async-exit-hook");

// S7 Connection
const PLCConnection = require("./s7");

// Datapoint
const DatapointService = require("./datapoint");


// DEBUG
const debugS7 = require("debug")("s7-knx:s7");

// Queue
const queue = require("./queue");

// KNX
const knxConnection = require("./knx");


// CONSTANTS
const DB_NUMBER = Number(process.env.S7_DB);
const S7_IP = process.env.S7_IP;
const START_OFFSET = 2;

// VARIABLES
var counter = 0

// Create the datapoint service
const datapointService = new DatapointService(START_OFFSET);



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
 * Function to read DB cyclically
 * @param {PLCConnection} plcConnection 
 * @param {number} interval 
 */
async function cyclicReadDB(plcConnection, interval) {
	while (true) {
		const startTime = Date.now();

		try {
			await plcConnection.readDB(async (buffer) => {
				await datapointService.mapBufferToDatapoint(buffer);
			});
		} catch (error) {
			console.error("Error during cyclic read:", error);
		}

		const elapsedTime = Date.now() - startTime;
		const delay = Math.max(interval - elapsedTime, 0);

		await new Promise(resolve => setTimeout(resolve, delay));
	}
}

/**
 * Main function
 */
async function main() {
	try {
		

		expressServer(datapointService);

		await knxConnection.setupKNX(); // Wait for KNX connection to be established

		// Create the PLC connection
		const plcConnection = new PLCConnection(
			S7_IP,
			DB_NUMBER,
			START_OFFSET
		);

		await plcConnection.setupS7(); // Proceed with setupS7 only after KNX is connected

		// Start cyclic read of DB
		const readInterval = process.env.S7_READ_INTERVAL ; // Interval in milliseconds
		cyclicReadDB(plcConnection, readInterval);

		// Set the dequeue interval
		setInterval(sendSyncKNX, 20)

		// Handle the exit
		exitHook((cb) => {
			console.log("Disconnecting from KNX…");
			knxConnection.connection.Disconnect(() => {
				console.log("Disconnected from KNX");
				cb();
			});
		});

	} catch (error) {
		console.error(error);
		process.exit(1);
	}
}

main();