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

// Datapoint
const DatapointService = require("./datapoint");

// DEBUG
const debugS7 = require("debug")("s7-knx:s7");

// Queue
const queue = require("./queue");

// KNX
const knxConnection = require("./knx");

// S7
const plcConnection = require("./s7/connection");

// CONSTANTS
const START_OFFSET = Number(process.env.S7_START_OFFSET);

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

		debugS7(`PLC -> KNX : ${item.groupAddress.padEnd(10)} : ${item.value.toString().padEnd(21)} -> Counter ${counter}`);
		knxConnection.connection.write(item.groupAddress, item.value, item.dpt);
	}

}


/**
 * Function to read DB cyclically
 * @param {PLCConnection} plcConnection 
 * @param {number} interval 
 */

let cyclicReadTimer = null;
function startCyclicReadDB(plcConnection, interval) {
	async function readCycle() {
		const startTime = Date.now();

		try {
			await plcConnection.readDB(async (buffer) => {
				await datapointService.mapBufferToDatapoint(buffer);
			});
		} catch (error) {
			console.error("Error during cyclic read:", error);
		}

		let delay;

		const elapsedTime = Date.now() - startTime;
		delay = Math.max(interval - elapsedTime, 0);
		cyclicReadTimer = setTimeout(readCycle, delay);

	}
	readCycle();
}

function stopCyclicReadDB() {
	if (cyclicReadTimer) {
		clearTimeout(cyclicReadTimer);
		cyclicReadTimer = null;
		console.log("Cyclic DB read stopped.");
	}
}

/**
 * Main function
 */
async function main() {
	try {


		expressServer(datapointService);

		await knxConnection.setupKNX(); // Wait for KNX connection to be established

		await plcConnection.setupS7(); // Proceed with setupS7 only after KNX is connected


		// Start cyclic read of DB
		const readInterval = process.env.S7_READ_INTERVAL; // Interval in milliseconds
		startCyclicReadDB(plcConnection, readInterval);


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

		// Disconnect from PLC
		exitHook((cb) => {
			stopCyclicReadDB();
			console.log("Disconnecting from PLC…");
			plcConnection.disconnect(() => {
				console.log("Disconnected from PLC");
				cb();
			});
		});

	} catch (error) {
		console.error(error);
		process.exit(1);
	}
}

main();
