"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeFile = exports.prettyPrintEncodedData = exports.sortFile = exports.deployContractAndSave = exports.verifyContract = void 0;
const upgrades_1 = require("@openzeppelin/upgrades");
const fs_1 = __importDefault(require("fs"));
const hardhat_1 = require("hardhat");
const dolomite_utils_1 = require("../src/utils/dolomite-utils");
async function verifyContract(address, constructorArguments) {
    try {
        await (0, hardhat_1.run)('verify:verify', {
            address,
            constructorArguments,
            network: 'arbitrumTestnet',
        });
    }
    catch (e) {
        if (e === null || e === void 0 ? void 0 : e.message.toLowerCase().includes('already verified')) {
            console.log('EtherscanVerification: Swallowing already verified error');
        }
        else {
            throw e;
        }
    }
}
exports.verifyContract = verifyContract;
async function deployContractAndSave(chainId, contractName, args, contractRename) {
    var _a, _b;
    const fileBuffer = fs_1.default.readFileSync('./scripts/deployments.json');
    let file;
    try {
        file = (_a = JSON.parse(fileBuffer.toString())) !== null && _a !== void 0 ? _a : {};
    }
    catch (e) {
        file = {};
    }
    const usedContractName = contractRename !== null && contractRename !== void 0 ? contractRename : contractName;
    if ((_b = file[usedContractName]) === null || _b === void 0 ? void 0 : _b[chainId.toString()]) {
        const contract = file[usedContractName][chainId.toString()];
        console.log(`Contract ${usedContractName} has already been deployed to chainId ${chainId} (${contract.address}). Skipping...`);
        if (!contract.isVerified) {
            await prettyPrintAndVerifyContract(file, chainId, usedContractName, args);
        }
        return contract.address;
    }
    console.log(`Deploying ${usedContractName} to chainId ${chainId}...`);
    const contract = await (0, dolomite_utils_1.createContract)(contractName, args);
    file[usedContractName] = {
        ...file[usedContractName],
        [chainId]: {
            address: contract.address,
            transaction: contract.deployTransaction.hash,
            isVerified: false,
        },
    };
    if (hardhat_1.network.name !== 'hardhat') {
        writeFile(file);
    }
    await prettyPrintAndVerifyContract(file, chainId, usedContractName, args);
    return contract.address;
}
exports.deployContractAndSave = deployContractAndSave;
function sortFile(file) {
    const sortedFileKeys = Object.keys(file).sort();
    const sortedFile = {};
    for (const key of sortedFileKeys) {
        sortedFile[key] = file[key];
    }
    return sortedFile;
}
exports.sortFile = sortFile;
async function prettyPrintAndVerifyContract(file, chainId, contractName, args) {
    const contract = file[contractName][chainId.toString()];
    console.log(`========================= ${contractName} =========================`);
    console.log('Address: ', contract.address);
    console.log('='.repeat(52 + contractName.length));
    if (hardhat_1.network.name !== 'hardhat') {
        console.log('Sleeping for 5s to wait for the transaction to be indexed by Etherscan...');
        await (0, upgrades_1.sleep)(5000);
        await verifyContract(contract.address, [...args]);
        file[contractName][chainId].isVerified = true;
        writeFile(file);
    }
    else {
        console.log('Skipping Etherscan verification...');
    }
}
let counter = 1;
async function prettyPrintEncodedData(transactionPromise, methodName) {
    const transaction = await transactionPromise;
    console.log(`=================================== ${counter++} - ${methodName} ===================================`);
    console.log('To: ', transaction.to);
    console.log('Data: ', transaction.data);
    console.log('='.repeat(76 + methodName.length));
    console.log(''); // add a new line
}
exports.prettyPrintEncodedData = prettyPrintEncodedData;
function writeFile(file) {
    fs_1.default.writeFileSync('./scripts/deployments.json', JSON.stringify(sortFile(file), null, 2), { encoding: 'utf8', flag: 'w' });
}
exports.writeFile = writeFile;
