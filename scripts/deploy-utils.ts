import { address } from '@dolomite-exchange/dolomite-margin';
import { sleep } from '@openzeppelin/upgrades';
import { BaseContract, BigNumber, BigNumberish, ethers, PopulatedTransaction } from 'ethers';
import { FormatTypes, ParamType, parseEther } from 'ethers/lib/utils';
import fs from 'fs';
import { network, run } from 'hardhat';
import { IChainlinkAggregator__factory, IERC20, IERC20Metadata__factory } from '../src/types';
import { createContractWithName } from '../src/utils/dolomite-utils';
import { ADDRESS_ZERO } from '../src/utils/no-deps-constants';
import { CoreProtocol } from '../test/utils/setup';
import * as deployments from './deployments.json';

type ChainId = string;

export async function verifyContract(address: string, constructorArguments: any[]) {
  try {
    console.log('Verifying contract...');
    await run('verify:verify', {
      address,
      constructorArguments,
      noCompile: true,
    });
  } catch (e: any) {
    if (e?.message.toLowerCase().includes('already verified')) {
      console.log('EtherscanVerification: Swallowing already verified error');
    } else {
      throw e;
    }
  }
}

type ConstructorArgument = string | BigNumberish | boolean | ConstructorArgument[];

export async function deployContractAndSave(
  chainId: number,
  contractName: string,
  args: ConstructorArgument[],
  contractRename?: string,
): Promise<address> {
  const fileBuffer = fs.readFileSync('./scripts/deployments.json');

  let file: Record<string, Record<ChainId, any>>;
  try {
    file = JSON.parse(fileBuffer.toString()) ?? {};
  } catch (e) {
    file = {};
  }

  const usedContractName = contractRename ?? contractName;
  if (file[usedContractName]?.[chainId.toString()]) {
    const contract = file[usedContractName][chainId.toString()];
    console.log(`Contract ${usedContractName} has already been deployed to chainId ${chainId} (${contract.address}). Skipping...`);
    if (!contract.isVerified) {
      await prettyPrintAndVerifyContract(file, chainId, usedContractName, args);
    }
    return contract.address;
  }

  console.log(`Deploying ${usedContractName} to chainId ${chainId}...`);

  const contract = await createContractWithName(contractName, args);

  file[usedContractName] = {
    ...file[usedContractName],
    [chainId]: {
      address: contract.address,
      transaction: contract.deployTransaction.hash,
      isVerified: false,
    },
  };

  if (network.name !== 'hardhat') {
    writeFile(file);
  }

  await prettyPrintAndVerifyContract(file, chainId, usedContractName, args);

  return contract.address;
}

export enum InterestSetterType {
  Altcoin = 'Altcoin',
  Stablecoin = 'Stablecoin',
}

const ONE_PERCENT = parseEther('0.01');

export async function deployLinearInterestSetterAndSave(
  chainId: number,
  interestSetterType: InterestSetterType,
  lowerOptimal: BigNumber,
  upperOptimal: BigNumber,
): Promise<address> {
  if (
    lowerOptimal.lt(ONE_PERCENT)
    || upperOptimal.lt(ONE_PERCENT)
    || !lowerOptimal.add(upperOptimal).eq(ONE_PERCENT.mul(100))
  ) {
    return Promise.reject(new Error('Invalid lowerOptimal and upperOptimal'));
  }
  const lowerName = lowerOptimal.div(ONE_PERCENT).toString().concat('L');
  const upperName = upperOptimal.div(ONE_PERCENT).toString().concat('U');

  return deployContractAndSave(
    chainId,
    'LinearStepFunctionInterestSetter',
    [lowerOptimal, upperOptimal],
    `${interestSetterType}${lowerName}${upperName}LinearStepFunctionInterestSetter`,
  );
}

export function sortFile(file: Record<string, Record<ChainId, any>>) {
  const sortedFileKeys = Object.keys(file).sort();
  const sortedFile: Record<string, Record<ChainId, any>> = {};
  for (const key of sortedFileKeys) {
    sortedFile[key] = file[key];
  }
  return sortedFile;
}

async function prettyPrintAndVerifyContract(
  file: Record<string, Record<ChainId, any>>,
  chainId: number,
  contractName: string,
  args: any[],
) {
  const contract = file[contractName][chainId.toString()];

  console.log(`========================= ${contractName} =========================`);
  console.log('Address: ', contract.address);
  console.log('='.repeat(52 + contractName.length));

  if (network.name !== 'hardhat') {
    console.log('Sleeping for 5s to wait for the transaction to be indexed by Etherscan...');
    await sleep(5000);
    await verifyContract(contract.address, [...args]);
    file[contractName][chainId].isVerified = true;
    writeFile(file);
  } else {
    console.log('Skipping Etherscan verification...');
  }
}

let counter = 1;

export async function prettyPrintEncodedData(
  transactionPromise: Promise<PopulatedTransaction>,
  methodName: string,
): Promise<void> {
  const transaction = await transactionPromise;
  console.log(`=================================== ${counter++} - ${methodName} ===================================`);
  console.log('To: ', transaction.to);
  console.log('Data: ', transaction.data);
  console.log('='.repeat(75 + (counter - 1).toString().length + methodName.length));
  console.log(''); // add a new line
}

const numMarketsKey = 'numMarkets';
const marketIdToMarketNameCache: Record<string, string | undefined> = {};

async function getFormattedMarketName(core: CoreProtocol, marketId: BigNumberish): Promise<string> {
  let cachedNumMarkets = marketIdToMarketNameCache[numMarketsKey];
  if (!cachedNumMarkets) {
    cachedNumMarkets = (await core.dolomiteMargin.getNumMarkets()).toString();
    marketIdToMarketNameCache[cachedNumMarkets] = cachedNumMarkets;
  }
  if (BigNumber.from(marketId).gte(cachedNumMarkets)) {
    return '(Unknown)';
  }

  const cachedName = marketIdToMarketNameCache[marketId.toString()];
  if (typeof cachedName !== 'undefined') {
    return cachedName;
  }
  const tokenAddress = await core.dolomiteMargin.getMarketTokenAddress(marketId);
  const marketName = await getFormattedTokenName(core, tokenAddress);
  marketIdToMarketNameCache[marketId.toString()] = marketName;
  return marketName;
}

const addressToNameCache: Record<string, string | undefined> = {};

async function getFormattedTokenName(core: CoreProtocol, tokenAddress: string): Promise<string> {
  if (tokenAddress === ADDRESS_ZERO) {
    return 'None';
  }

  const cachedName = addressToNameCache[tokenAddress.toString().toLowerCase()];
  if (typeof cachedName !== 'undefined') {
    return cachedName;
  }
  const token = IERC20Metadata__factory.connect(tokenAddress, core.hhUser1);
  try {
    addressToNameCache[tokenAddress.toLowerCase()] = `(${await token.symbol()})`;
    return addressToNameCache[tokenAddress.toLowerCase()]!;
  } catch (e) {
    addressToNameCache[tokenAddress.toLowerCase()] = '';
    return '';
  }
}

async function getFormattedChainlinkAggregatorName(core: CoreProtocol, aggregatorAddress: string): Promise<string> {
  if (aggregatorAddress === ADDRESS_ZERO) {
    return 'None';
  }

  const cachedName = addressToNameCache[aggregatorAddress.toString().toLowerCase()];
  if (typeof cachedName !== 'undefined') {
    return cachedName;
  }

  const aggregator = IChainlinkAggregator__factory.connect(aggregatorAddress, core.hhUser1);
  try {
    addressToNameCache[aggregatorAddress.toLowerCase()] = `(${await aggregator.description()})`;
    return addressToNameCache[aggregatorAddress.toLowerCase()]!;
  } catch (e) {
    addressToNameCache[aggregatorAddress.toLowerCase()] = '';
    return '';
  }
}

function isMarketIdParam(paramType: ParamType): boolean {
  return paramType.name.includes('marketId') || paramType.name.includes('MarketId');
}

function isTokenParam(paramType: ParamType): boolean {
  return (paramType.name.includes('token') || paramType.name.includes('Token'))
    && !paramType.name.toLowerCase().includes('decimals');
}

function isChainlinkAggregatorParam(paramType: ParamType): boolean {
  return paramType.name.includes('chainlinkAggregator');
}

export async function prettyPrintEncodedDataWithTypeSafety<
  T extends V[K],
  U extends keyof T['populateTransaction'],
  V extends Record<K, BaseContract>,
  K extends keyof V,
>(
  core: CoreProtocol,
  liveMap: V,
  key: K,
  methodName: U,
  args: Parameters<T['populateTransaction'][U]>,
): Promise<void> {
  const contract = liveMap[key];
  const transaction = await contract.populateTransaction[methodName.toString()](...(args as any));
  const fragment = contract.interface.getFunction(methodName.toString());
  const mappedArgs = await Promise.all((args as any[]).map(async (arg, i) => {
    return getReadableArg(core, fragment.inputs[i], arg);
  }));
  console.log(''); // add a new line
  console.log(`=================================== ${counter++} - ${key}.${methodName} ===================================`);
  console.log('Readable:\t', `${key}.${methodName}(\n\t\t\t${mappedArgs.join(' ,\n\t\t\t')}\n\t\t)`);
  console.log('To:\t\t', transaction.to);
  console.log('Data:\t\t', transaction.data);
  console.log('='.repeat(76 + (counter - 1).toString().length + key.toString().length + methodName.toString().length));
  console.log(''); // add a new line
}

async function getReadableArg(core: CoreProtocol, inputParamType: ParamType, arg: any): Promise<string> {
  const formattedInputParamName = inputParamType.format(FormatTypes.full);
  if (BigNumber.isBigNumber(arg)) {
    if (isMarketIdParam(inputParamType)) {
      return `${formattedInputParamName} = ${arg.toString()} ${await getFormattedMarketName(core, arg)}`;
    }
    return `${formattedInputParamName} = ${arg.toString()}`;
  }

  if (Array.isArray(arg)) {
    // remove the [] at the end
    const subParamType = ParamType.fromString(
      `${inputParamType.type.substring(0, inputParamType.type.length - 2)} ${inputParamType.name}`,
      false,
    );
    const formattedArgs = await Promise.all(arg.map(async value => {
      return await getReadableArg(core, subParamType, value);
    }));
    return `${formattedInputParamName} = [\n\t\t\t\t${formattedArgs.join(' ,\n\t\t\t\t')}\n\t\t\t]`;
  }

  if (typeof arg === 'object') {
    if (inputParamType.baseType !== 'tuple') {
      return Promise.reject(new Error('Object type is not tuple'));
    }
    const values: string[] = [];
    const keys = Object.keys(arg);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const componentPiece = inputParamType.components[i];
      values.push(await getReadableArg(core, componentPiece, arg[key]));
    }
    return `${formattedInputParamName} = {\n\t\t\t\t${values.join(' ,\n\t\t\t\t')}\n\t\t\t}`;
  }

  if (isMarketIdParam(inputParamType)) {
    return `${formattedInputParamName} = ${arg} ${await getFormattedMarketName(core, arg)}`;
  }
  if (isTokenParam(inputParamType)) {
    return `${formattedInputParamName} = ${arg} ${await getFormattedTokenName(core, arg)}`;
  }
  if (isChainlinkAggregatorParam(inputParamType)) {
    return `${formattedInputParamName} = ${arg} ${await getFormattedChainlinkAggregatorName(core, arg)}`;
  }

  let specialName: string = '';
  if (inputParamType.type === 'address') {
    const chainId = core.config.network;
    Object.keys(deployments).forEach(key => {
      if ((deployments as any)[key][chainId]?.address.toLowerCase() === arg.toLowerCase()) {
        specialName = ` (${key})`;
      }
    });
  }
  return `${formattedInputParamName} = ${arg}${specialName}`;
}

export async function prettyPrintEncodeInsertChainlinkOracle(
  core: CoreProtocol,
  token: IERC20,
  chainlinkAggregatorAddress: address,
  tokenPairAddress: address,
): Promise<void> {
  const tokenDecimals = await IERC20Metadata__factory.connect(token.address, core.hhUser1).decimals();
  await prettyPrintEncodedDataWithTypeSafety(
    core,
    { chainlinkPriceOracle: core.chainlinkPriceOracle! },
    'chainlinkPriceOracle',
    'ownerInsertOrUpdateOracleToken',
    [
      token.address,
      tokenDecimals,
      chainlinkAggregatorAddress,
      tokenPairAddress,
    ],
  );
}

export function writeFile(file: Record<string, Record<ChainId, any>>) {
  fs.writeFileSync(
    './scripts/deployments.json',
    JSON.stringify(sortFile(file), null, 2),
    { encoding: 'utf8', flag: 'w' },
  );
}
