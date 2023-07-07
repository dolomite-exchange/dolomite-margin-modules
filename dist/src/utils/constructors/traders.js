"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getParaswapAggregatorTraderConstructorParams = void 0;
function getParaswapAggregatorTraderConstructorParams(core) {
    return [
        core.paraswapEcosystem.augustusRouter,
        core.paraswapEcosystem.transferProxy,
        core.dolomiteMargin.address,
    ];
}
exports.getParaswapAggregatorTraderConstructorParams = getParaswapAggregatorTraderConstructorParams;
