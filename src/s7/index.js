const snap7 = require("node-snap7");

const debugS7 = require("debug")("s7-knx:s7");


class PLCConection {


    constructor(ip, dbNumber, startOffset) {



        this.ip = ip;
        this.dbNumber = dbNumber
        this.startOffset = startOffset;

    }


    /**
     * Setup the S7 connection
     * @returns {Promise<void>}
     * @throws {Error} If the connection fails
     */
    async setupS7() {
        this.s7client = new snap7.S7Client();
        debugS7("Trying to connect to PLC at : " + this.ip);
        debugS7("PLC KNX DB Number : " + this.dbNumber);

        try {
            await new Promise((resolve, reject) => {
                this.s7client.ConnectTo(this.ip, 0, 1, (err) => {
                    if (err) {
                        reject(new Error("Connection failed. Code #" + err + " - " + this.s7client.ErrorText(err)));
                    } else {
                        resolve();
                    }
                });
            });

            const buffer = await new Promise((resolve, reject) => {
                this.s7client.DBRead(this.dbNumber, 0, 2, (err, res) => {
                    if (err) {
                        reject(new Error("DBRead failed. Code #" + err + " - " + this.s7client.ErrorText(err)));
                    } else {
                        resolve(res);
                    }
                });
            });

            this.dbSize = buffer.readUInt16BE(0);
            debugS7("DB Size : " + this.dbSize);

        } catch (error) {
            debugS7("Error setting up S7:", error);
            throw error;
        }
    }


    /**
     * Function to read the db size
     * @returns {Promise<void>}
     * @throws {Error} If the connection fails
     */
    async readDBSize() {
        if (!this.s7client) {
            throw new Error("S7 client is not initialized.");
        }

        try {
            const buffer = await new Promise((resolve, reject) => {
                this.s7client.DBRead(this.dbNumber, 0, 2, (err, res) => {
                    if (err) {
                        reject(new Error("DBRead failed. Code #" + err + " - " + this.s7client.ErrorText(err)));
                    } else {
                        resolve(res);
                    }
                });
            });

            this.dbSize = buffer.readUInt16BE(0);
            debugS7("DB Size : " + this.dbSize);

        } catch (error) {
            debugS7("Error reading DB size:", error);
            throw error;
        }
    }


    /**
     * Read the DB from the PLC and call the callback function
     * @param {Function} cb - Callback function to call with the buffer
     * @returns {Promise<void>}
     * @throws {Error} If the connection fails
     */
    async readDB(cb) {
        if (!this.s7client) {
            throw new Error("S7 client is not initialized.");
        }

        try {
            const buffer = await new Promise((resolve, reject) => {
                this.s7client.DBRead(this.dbNumber, 0, this.dbSize, function (err, res) {
                    if (err) {
                        reject(new Error("DBRead failed. Code #" + err + " - " + s7client.ErrorText(err)));
                    } else {
                        resolve(res);
                    }
                });
            });

            cb(buffer);
        } catch (error) {
            debugS7("Error reading DB:", error);
            throw error;
        }
    }
}




module.exports = PLCConection;