"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTestIsolationModeFactory = void 0;
const types_1 = require("../../../src/types");
const dolomite_utils_1 = require("../../../src/utils/dolomite-utils");
async function createTestIsolationModeFactory(core, underlyingToken, userVaultImplementation) {
    return await (0, dolomite_utils_1.createContractWithAbi)(types_1.TestIsolationModeFactory__factory.abi, types_1.TestIsolationModeFactory__factory.bytecode, [
        underlyingToken.address,
        core.borrowPositionProxyV2.address,
        userVaultImplementation.address,
        core.dolomiteMargin.address,
    ]);
}
exports.createTestIsolationModeFactory = createTestIsolationModeFactory;
