"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dolomite_margin_1 = require("@dolomite-exchange/dolomite-margin");
const chai_1 = __importDefault(require("chai"));
const ethereum_waffle_1 = require("ethereum-waffle");
const types_1 = require("../../../src/types");
const dolomite_utils_1 = require("../../../src/utils/dolomite-utils");
const utils_1 = require("../../utils");
const assertions_1 = require("../../utils/assertions");
chai_1.default.use(ethereum_waffle_1.solidity);
describe('Require', () => {
    let snapshotId;
    let testRequire;
    before(async () => {
        testRequire = await (0, dolomite_utils_1.createContractWithAbi)(types_1.TestRequire__factory.abi, types_1.TestRequire__factory.bytecode, []);
        snapshotId = await (0, utils_1.snapshot)();
    });
    beforeEach(async () => {
        snapshotId = await (0, utils_1.revertToSnapshotAndCapture)(snapshotId);
    });
    describe('Require', () => {
        const bytes32Hex = `0x${'0123456789abcdef'.repeat(4)}`;
        const emptyReason = '0x0000000000000000000000000000000000000000000000000000000000000000';
        const reason1 = '0x5468697320497320746865205465787420526561736f6e2e3031323334353637';
        const reasonString1 = 'This Is the Text Reason.01234567';
        const reason2 = '0x53686f727420526561736f6e2030393800000000000000000000000000000000';
        const reasonString2 = 'Short Reason 098';
        const arg1 = '0';
        const arg2 = '1234567890987654321';
        const arg3 = dolomite_margin_1.INTEGERS.ONES_255.toFixed(0);
        const addr = dolomite_margin_1.ADDRESSES.TEST[0];
        it('that (emptyString)', async () => {
            await (0, assertions_1.expectThrow)(testRequire.RequireThat1(emptyReason, arg1), `TestRequire:  <${arg1}>`);
        });
        it('that (0 args)', async () => {
            await (0, assertions_1.expectThrow)(testRequire.RequireThat0(reason1), `TestRequire: ${reasonString1}`);
        });
        it('that (1 args)', async () => {
            await (0, assertions_1.expectThrow)(testRequire.RequireThat1(reason2, arg1), `TestRequire: ${reasonString2} <${arg1}>`);
        });
        it('that (2 args)', async () => {
            await (0, assertions_1.expectThrow)(testRequire.RequireThat2(reason1, arg2, arg3), `TestRequire: ${reasonString1} <${arg2}, ${arg3}>`);
            await testRequire.RequireThat2IsTrue(reason1, arg2, arg3);
        });
        it('that (address arg)', async () => {
            await (0, assertions_1.expectThrow)(testRequire.RequireThatA0(reason2, addr), `TestRequire: ${reasonString2} <${addr}>`);
            await testRequire.RequireThatA0IsTrue(reason2, addr);
        });
        it('that (1 address, 1 number)', async () => {
            await (0, assertions_1.expectThrow)(testRequire.RequireThatA1(reason2, addr, arg1), `TestRequire: ${reasonString2} <${addr}, ${arg1}>`);
            await testRequire.RequireThatA1IsTrue(reason2, addr, arg1);
        });
        it('that (1 address, 2 numbers)', async () => {
            await (0, assertions_1.expectThrow)(testRequire.RequireThatA2(reason2, addr, arg1, arg3), `TestRequire: ${reasonString2} <${addr}, ${arg1}, ${arg3}>`);
            await testRequire.RequireThatA2IsTrue(reason2, addr, arg1, arg3);
        });
        it('that (bytes32 arg)', async () => {
            await (0, assertions_1.expectThrow)(testRequire.RequireThatB0(reason1, bytes32Hex), `TestRequire: ${reasonString1} <${bytes32Hex}>`);
            await testRequire.RequireThatB0IsTrue(reason1, bytes32Hex);
        });
        it('that (1 bytes32, 2 numbers)', async () => {
            await (0, assertions_1.expectThrow)(testRequire.RequireThatB2(reason2, bytes32Hex, arg1, arg3), `TestRequire: ${reasonString2} <${bytes32Hex}, ${arg1}, ${arg3}>`);
            await testRequire.RequireNotThatB2(reason2, bytes32Hex, arg1, arg3);
        });
    });
});
