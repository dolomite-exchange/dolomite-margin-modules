"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sleep = exports.formatNumber = exports.calculateApy = exports.calculateApr = void 0;
const hardhat_1 = require("hardhat");
const web3_1 = __importDefault(require("web3"));
function calculateApr(newValue, oldValue, durationDeltaSeconds) {
    const base = hardhat_1.ethers.BigNumber.from('1000000000000000000');
    const newValueBN = hardhat_1.ethers.BigNumber.from(newValue);
    const oldValueBN = hardhat_1.ethers.BigNumber.from(oldValue);
    return newValueBN.mul(base).div(oldValueBN).sub(base).mul(365 * 86400)
        .div(durationDeltaSeconds);
}
exports.calculateApr = calculateApr;
function calculateApy(newValue, oldValue, durationDeltaSeconds) {
    const newValueBN = hardhat_1.ethers.BigNumber.from(newValue);
    const oldValueBN = hardhat_1.ethers.BigNumber.from(oldValue);
    const one = hardhat_1.ethers.BigNumber.from('1000000000000000000');
    return one.add(calculateApr(newValueBN, oldValueBN, durationDeltaSeconds).div(365))
        .pow(365)
        .mul(one)
        .div(one.pow(365))
        .sub(one);
}
exports.calculateApy = calculateApy;
function formatNumber(n) {
    const numberBN = hardhat_1.ethers.BigNumber.from(n);
    return web3_1.default.utils.fromWei(numberBN.toString());
}
exports.formatNumber = formatNumber;
async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
exports.sleep = sleep;
