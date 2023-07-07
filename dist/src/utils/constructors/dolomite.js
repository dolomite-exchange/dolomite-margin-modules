"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRegistryProxyConstructorParams = void 0;
function getRegistryProxyConstructorParams(implementationAddress, implementationCalldata, core) {
    return [implementationAddress, core.dolomiteMargin.address, implementationCalldata];
}
exports.getRegistryProxyConstructorParams = getRegistryProxyConstructorParams;
