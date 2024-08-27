
// UDT structure size and type
// Some DPT use the KNXDriver_GA structure, which is a UDT (User Defined Type) defined in the PLC
// For some more complex DPTs, the UDT is different and we need to handle it differently
// This is the case for the DPT 236, which uses the KNXDriver_GA_236 UDT containing 3 bytes instead of the variables found in the KNXDriver_GA UDT
const structUDTType = {
    1: {size : 14, type : "Generic"},
    5: {size : 14, type : "Generic"},
    9: {size : 14, type : "Generic"},
    13: {size : 14, type : "Generic"},
    14: {size : 14, type : "Generic"},
    232: {size : 10, type : "232"}
};



module.exports = {
    structUDTType
};