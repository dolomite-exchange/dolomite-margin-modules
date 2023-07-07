"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setExpiry = void 0;
const src_1 = require("@dolomite-margin/dist/src");
const ethers_1 = require("ethers");
const index_1 = require("./index");
const abiCoder = ethers_1.ethers.utils.defaultAbiCoder;
async function setExpiry(core, account, owedMarketId, timeDelta) {
    const action = {
        actionType: src_1.ActionType.Call,
        accountId: 0,
        amount: { sign: false, ref: src_1.AmountReference.Delta, denomination: src_1.AmountDenomination.Actual, value: 0 },
        primaryMarketId: owedMarketId.toString(),
        secondaryMarketId: 0,
        otherAddress: core.expiry.address,
        otherAccountId: 0,
        data: abiCoder.encode(['uint256', '((address, uint256), uint256, uint32, bool)[]'], [
            src_1.ExpiryCallFunctionType.SetExpiry,
            [[[account.owner, account.number], owedMarketId, timeDelta, true]],
        ]),
    };
    const signer = await (0, index_1.impersonate)(account.owner, true);
    return core.dolomiteMargin.connect(signer).operate([account], [action]);
}
exports.setExpiry = setExpiry;
