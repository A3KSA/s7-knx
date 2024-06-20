debugKNX = require("debug")("knx");
const knx = require("knx");


// KNX Connection
class KNXConnection {
    constructor() {
        if (!KNXConnection.instance) {
            this.connection = null;
            KNXConnection.instance = this;
        }

        return KNXConnection.instance;
    }

    /**
     * Setup the KNX connection
     * @param {Int} retryDelay
     * @returns {Promise<void>}
     * @throws {Error} If the connection fails
     */
    async setupKNX() {
        return new Promise((resolve, reject) => {
            debugKNX("Initializing KNX connection");
            debugKNX(process.env.KNX_IP);
            debugKNX(process.env.KNX_PORT);
            debugKNX(process.env.KNX_MANUAL_CONNECT);
            debugKNX(process.env.KNX_MIN_DELAY);
            debugKNX(process.env.KNX_ADDRESS);

            this.connection = knx.Connection({
                ipAddr: process.env.KNX_IP, // KNX IP gateway address
                ipPort: process.env.KNX_PORT, // default KNX IP port
                debug: "trace",
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
    
    getConnection() {
        return this.connection;
      }
}

const instance = new KNXConnection();
// Object.freeze(instance);

module.exports = instance;