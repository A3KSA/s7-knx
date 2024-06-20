const {
    structUDTType
} = require("./CONSTANTS");
const KNXGroupAddress = require("./KNXGroupAddress");

class DatapointService {

    constructor(startOffset) {
        this.startOffset = startOffset;
        this.datapoint = [];
        this.buffer = null;
    }



    /**
     * Map the buffer to objects
     * @param {Buffer} buffer
     * @returns 
     */
    async mapBufferToDatapoint(buffer) {
        this.buffer = buffer;
        var i = 0;
        var type = buffer.readInt16BE(2 + 4); // Int - 2 bytes at offset 4 (2 bytes for the size of the buffer)

        for (
            let offset = this.startOffset; offset < buffer.length; offset += structUDTType[type].size
        ) {
            type = buffer.readInt16BE(offset + 4); // Int - 2 bytes at offset 4 (2 bytes for the size of the buffer)
            let objectBuffer = buffer.subarray(offset, offset + structUDTType[type].size);

            // create a new object if it doesn't exist
            if (this.datapoint[i] == null) {
                this.datapoint[i] = new KNXGroupAddress(offset);
            } else {
                // Update the offset of the object
                this.datapoint[i].offset = offset;

                // update the object with the new buffer
                await this.datapoint[i].update(objectBuffer);
            }

            i++;
        }

        return this.datapoint;
    }


    /**
     * Get the objects
     * @returns 
     */
    getDatapoint() {
        return this.datapoint;
    }

    /**
     * Get the object by id
     * @param {Int} id
     */
    getDatapointById(id) {
        return this.datapoint[id];
    }

    /**
     * TODO Reload an object by id 
     * Unload the instance, calc the new offset and create a new instance
     * @param {Int} id
     */
    async reloadDatapointById(id) {
        throw new Error("Not implemented");
    }
        


}



module.exports = DatapointService;