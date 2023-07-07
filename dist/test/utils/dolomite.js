"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDolomiteRegistryImplementation = exports.createRegistryProxy = void 0;
const types_1 = require("../../src/types");
const dolomite_1 = require("../../src/utils/constructors/dolomite");
const dolomite_utils_1 = require("../../src/utils/dolomite-utils");
async function createRegistryProxy(implementationAddress, initializationCalldata, core) {
    return (0, dolomite_utils_1.createContractWithAbi)(types_1.RegistryProxy__factory.abi, types_1.RegistryProxy__factory.bytecode, (0, dolomite_1.getRegistryProxyConstructorParams)(implementationAddress, initializationCalldata, core));
}
exports.createRegistryProxy = createRegistryProxy;
async function createDolomiteRegistryImplementation() {
    return (0, dolomite_utils_1.createContractWithAbi)(types_1.DolomiteRegistryImplementation__factory.abi, types_1.DolomiteRegistryImplementation__factory.bytecode, []);
}
exports.createDolomiteRegistryImplementation = createDolomiteRegistryImplementation;
