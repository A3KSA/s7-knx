// S7 Connection
const PLCConnection = require("./index")

// CONSTANTS
const S7_IP = process.env.S7_IP;
const DB_NUMBER = Number(process.env.S7_DB);
const START_OFFSET = Number(process.env.S7_START_OFFSET);


// Create the PLC connection
const plcConnection = new PLCConnection(
    S7_IP,
    DB_NUMBER,
    START_OFFSET
);

module.exports = plcConnection;