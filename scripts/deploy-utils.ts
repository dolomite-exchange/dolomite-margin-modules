import { address } from '@dolomite-exchange/dolomite-margin';
import { sleep } from '@openzeppelin/upgrades';
import { BaseContract, BigNumber, BigNumberish, PopulatedTransaction } from 'ethers';
import { commify, formatEther, FormatTypes, ParamType, parseEther } from 'ethers/lib/utils';
import fs from 'fs';
import { artifacts, network, run } from 'hardhat';
import {
  IChainlinkAggregator__factory,
  IDolomiteInterestSetter,
  IDolomitePriceOracle,
  IERC20,
  IERC20Metadata__factory,
  IIsolationModeUnwrapperTrader,
  IIsolationModeVaultFactory,
  IIsolationModeWrapperTrader,
  IPendlePtMarket,
  IPendlePtOracle,
  IPendlePtToken,
  IPendleSyToken,
  PendlePtIsolationModeTokenVaultV1__factory,
  PendlePtIsolationModeUnwrapperTraderV2,
  PendlePtIsolationModeUnwrapperTraderV2__factory,
  PendlePtIsolationModeVaultFactory,
  PendlePtIsolationModeVaultFactory__factory,
  PendlePtIsolationModeWrapperTraderV2,
  PendlePtIsolationModeWrapperTraderV2__factory,
  PendlePtPriceOracle,
  PendlePtPriceOracle__factory,
  PendleRegistry__factory,
} from '../src/types';
import {
  getLiquidationPremiumForTargetLiquidationPenalty,
  getMarginPremiumForTargetCollateralization,
  getOwnerAddMarketParameters,
  getOwnerAddMarketParametersForIsolationMode,
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '../src/utils/constructors/dolomite';
import {
  getPendlePtIsolationModeUnwrapperTraderV2ConstructorParams,
  getPendlePtIsolationModeVaultFactoryConstructorParams,
  getPendlePtIsolationModeWrapperTraderV2ConstructorParams,
  getPendlePtPriceOracleConstructorParams,
  getPendleRegistryConstructorParams,
} from '../src/utils/constructors/pendle';
import { createContractWithLibrary, createContractWithName } from '../src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network, ZERO_BI } from '../src/utils/no-deps-constants';
import { CoreProtocol } from '../test/utils/setup';
import deployments from './deployments.json';

type ChainId = string;

export async function verifyContract(address: string, constructorArguments: any[], contractName: string | undefined) {
  try {
    console.log('Verifying contract...');
    await run('verify:verify', {
      address,
      constructorArguments,
      noCompile: true,
      contract: contractName,
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
  libraries?: Record<string, string>,
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
      await prettyPrintAndVerifyContract(file, chainId, contractName, usedContractName, args);
    }
    return contract.address;
  }

  console.log(`Deploying ${usedContractName} to chainId ${chainId}...`);

  const contract = libraries
    ? await createContractWithLibrary(contractName, libraries, args)
    : await createContractWithName(contractName, args);

  file[usedContractName] = {
    ...file[usedContractName],
    [chainId]: {
      address: contract.address,
      transaction: contract.deployTransaction.hash,
      isVerified: false,
    },
  };

  if (network.name !== 'hardhat') {
    writeDeploymentFile(file);
  }

  await prettyPrintAndVerifyContract(file, chainId, contractName, usedContractName, args);

  return contract.address;
}

export function getTokenVaultLibrary(core: CoreProtocol): Record<string, string> {
  const libraryName = 'IsolationModeTokenVaultV1ActionsImpl';
  const deploymentName = 'IsolationModeTokenVaultV1ActionsImplV2';
  return {
    [libraryName]: deployments[deploymentName][core.config.network as '42161'].address,
  };
}

export interface PendlePtSystem {
  factory: PendlePtIsolationModeVaultFactory;
  oracle: PendlePtPriceOracle;
  unwrapper: PendlePtIsolationModeUnwrapperTraderV2;
  wrapper: PendlePtIsolationModeWrapperTraderV2;
}

export async function deployPendlePtSystem(
  network: Network,
  core: CoreProtocol,
  ptName: string,
  ptMarket: IPendlePtMarket,
  ptOracle: IPendlePtOracle,
  ptToken: IPendlePtToken,
  syToken: IPendleSyToken,
  underlyingToken: IERC20,
): Promise<PendlePtSystem> {
  const libraries = getTokenVaultLibrary(core);
  const userVaultImplementationAddress = await deployContractAndSave(
    Number(network),
    'PendlePtIsolationModeTokenVaultV1',
    [],
    `PendlePt${ptName}IsolationModeTokenVaultV1'`,
    libraries,
  );
  const userVaultImplementation = PendlePtIsolationModeTokenVaultV1__factory.connect(
    userVaultImplementationAddress,
    core.governance,
  );

  const registryImplementationAddress = await deployContractAndSave(
    Number(network),
    'PendleRegistry',
    [],
    'PendleRegistryImplementationV1',
  );
  const registryImplementation = PendleRegistry__factory.connect(registryImplementationAddress, core.governance);
  const registryAddress = await deployContractAndSave(
    Number(network),
    'RegistryProxy',
    await getPendleRegistryConstructorParams(registryImplementation, core, ptMarket, ptOracle, syToken),
    `Pendle${ptName}RegistryProxy`,
  );
  const registry = PendleRegistry__factory.connect(registryAddress, core.governance);

  const factoryAddress = await deployContractAndSave(
    Number(network),
    'PendlePtIsolationModeVaultFactory',
    getPendlePtIsolationModeVaultFactoryConstructorParams(core, registry, ptToken, userVaultImplementation),
    `PendlePt${ptName}IsolationModeVaultFactory`,
  );
  const factory = PendlePtIsolationModeVaultFactory__factory.connect(factoryAddress, core.governance);

  const unwrapperAddress = await deployContractAndSave(
    Number(network),
    'PendlePtIsolationModeUnwrapperTraderV2',
    getPendlePtIsolationModeUnwrapperTraderV2ConstructorParams(core, registry, underlyingToken, factory),
    `PendlePt${ptName}IsolationModeUnwrapperTraderV2`,
  );

  const wrapperAddress = await deployContractAndSave(
    Number(network),
    'PendlePtIsolationModeWrapperTraderV2',
    getPendlePtIsolationModeWrapperTraderV2ConstructorParams(core, registry, underlyingToken, factory),
    `PendlePt${ptName}IsolationModeWrapperTraderV2`,
  );

  const oracleAddress = await deployContractAndSave(
    Number(network),
    'PendlePtPriceOracle',
    getPendlePtPriceOracleConstructorParams(core, factory, registry, underlyingToken),
    `PendlePt${ptName}PriceOracle`,
  );
  const oracle = PendlePtPriceOracle__factory.connect(oracleAddress, core.governance);

  return {
    factory,
    oracle,
    unwrapper: PendlePtIsolationModeUnwrapperTraderV2__factory.connect(unwrapperAddress, core.governance),
    wrapper: PendlePtIsolationModeWrapperTraderV2__factory.connect(wrapperAddress, core.governance),
  };
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
  contractRename: string,
  args: any[],
) {
  const contract = file[contractRename][chainId.toString()];

  console.log(`========================= ${contractRename} =========================`);
  console.log('Address: ', contract.address);
  console.log('='.repeat(52 + contractRename.length));

  if (network.name !== 'hardhat') {
    console.log('Sleeping for 5s to wait for the transaction to be indexed by Etherscan...');
    await sleep(5000);
    const sourceName = (await artifacts.readArtifact(contractName)).sourceName;
    await verifyContract(contract.address, [...args], `${sourceName}:${contractName}`);
    file[contractRename][chainId].isVerified = true;
    writeDeploymentFile(file);
  } else {
    console.log('Skipping Etherscan verification...');
  }
}

let counter = 1;

/**
 * @deprecated
 */
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
    return '(None)';
  }

  const cachedName = addressToNameCache[tokenAddress.toString().toLowerCase()];
  if (typeof cachedName !== 'undefined') {
    return cachedName;
  }
  const token = IERC20Metadata__factory.connect(tokenAddress, core.hhUser1);
  try {
    mostRecentTokenDecimals = await token.decimals();
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

function isMaxWeiParam(paramType: ParamType): boolean {
  return paramType.name.includes('maxWei')
    || paramType.name.includes('maxSupplyWei')
    || paramType.name.includes('maxBorrowWei');
}

export interface EncodedTransaction {
  to: string;
  value: string;
  data: string;
}

export interface DenJsonUpload {
  chainId: string;
  transactions: EncodedTransaction[];
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
): Promise<EncodedTransaction> {
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

  if (
    typeof methodName === 'string'
    && (methodName.startsWith('owner') || methodName === 'upgradeTo' || methodName === 'upgradeToAndCall')
    && await core.dolomiteMargin.owner() === core.delayedMultiSig.address
  ) {
    // All owner ... functions must go to Dolomite governance first
    const outerTransaction = await core.delayedMultiSig.populateTransaction.submitTransaction(
      transaction.to!,
      transaction.value ?? ZERO_BI,
      transaction.data!,
    );
    return {
      to: outerTransaction.to!,
      value: outerTransaction.value?.toString() ?? '0',
      data: outerTransaction.data!,
    };
  }

  return {
    to: transaction.to!,
    value: transaction.value?.toString() ?? '0',
    data: transaction.data!,
  };

}

let mostRecentTokenDecimals: number | undefined = undefined;

async function getReadableArg(
  core: CoreProtocol,
  inputParamType: ParamType,
  arg: any,
  decimals?: number,
  index?: number,
): Promise<string> {
  let formattedInputParamName: string;
  if (typeof index !== 'undefined') {
    formattedInputParamName = `${inputParamType.name}[${index}]`;
  } else {
    formattedInputParamName = inputParamType.format(FormatTypes.full);
  }

  if (Array.isArray(arg)) {
    // remove the [] at the end
    const subParamType = ParamType.fromString(
      `${inputParamType.type.slice(0, -2)} ${inputParamType.name}`,
      false,
    );
    const formattedArgs = await Promise.all(arg.map(async (value, i) => {
      return await getReadableArg(core, subParamType, value, decimals, i);
    }));
    return `${formattedInputParamName} = [\n\t\t\t\t${formattedArgs.join(' ,\n\t\t\t\t')}\n\t\t\t]`;
  }

  if (isMarketIdParam(inputParamType)) {
    return `${formattedInputParamName} = ${arg} ${await getFormattedMarketName(core, arg)}`;
  }
  if (isTokenParam(inputParamType)) {
    const tokenName = await getFormattedTokenName(core, arg);
    if (tokenName) {
      return `${formattedInputParamName} = ${arg} ${tokenName}`;
    }
  }
  if (isChainlinkAggregatorParam(inputParamType)) {
    return `${formattedInputParamName} = ${arg} ${await getFormattedChainlinkAggregatorName(core, arg)}`;
  }
  if (isMaxWeiParam(inputParamType) && typeof mostRecentTokenDecimals !== 'undefined') {
    const scaleTo18Decimals = BigNumber.from(10).pow(18 - mostRecentTokenDecimals);
    const decimal = commify(formatEther(BigNumber.from(arg).mul(scaleTo18Decimals)));
    return `${formattedInputParamName} = ${arg} (${decimal})`;
  }

  let specialName: string = '';
  if (inputParamType.type === 'address') {
    const chainId = core.config.network;
    const freshDeployments = JSON.parse(fs.readFileSync(`${__dirname}/deployments.json`).toString());
    Object.keys(freshDeployments).forEach(key => {
      if ((freshDeployments as any)[key][chainId]?.address.toLowerCase() === arg.toLowerCase()) {
        specialName = ` (${key})`;
      }
    });
    if (!specialName) {
      const coreDeployments = JSON.parse(fs.readFileSync(`${__dirname}/deployments.json`).toString());
      Object.keys(coreDeployments).forEach(key => {
        if ((coreDeployments as any)[key][chainId]?.address.toLowerCase() === arg.toLowerCase()) {
          specialName = ` (${key})`;
        }
      });

      const tokenName = await getFormattedTokenName(core, arg);
      if (tokenName) {
        specialName = ` ${tokenName}`;
      }
    }
  }

  if (typeof arg === 'object' && !BigNumber.isBigNumber(arg)) {
    if (inputParamType.baseType !== 'tuple') {
      return Promise.reject(new Error('Object type is not tuple'));
    }
    let decimals: number | undefined = undefined;
    if (inputParamType.name.toLowerCase().includes('premium')) {
      decimals = 18;
    }
    const values: string[] = [];
    const keys = Object.keys(arg);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const componentPiece = inputParamType.components[i];
      values.push(await getReadableArg(core, componentPiece, arg[key], decimals, index));
    }
    return `${formattedInputParamName} = {\n\t\t\t\t${values.join(' ,\n\t\t\t\t')}\n\t\t\t}`;
  }

  if (BigNumber.isBigNumber(arg) && typeof decimals !== 'undefined') {
    const multiplier = BigNumber.from(10).pow(18 - decimals);
    specialName = ` (${commify(formatEther(arg.mul(multiplier)))})`;
  }

  return `${formattedInputParamName} = ${arg}${specialName}`;
}

export async function prettyPrintEncodeInsertChainlinkOracle(
  core: CoreProtocol,
  token: IERC20,
  chainlinkAggregatorAddress: address,
  tokenPairAddress: address,
): Promise<EncodedTransaction> {
  let tokenDecimals: number;
  if (token.address === core.tokens.stEth?.address) {
    tokenDecimals = 18;
  } else {
    tokenDecimals = await IERC20Metadata__factory.connect(token.address, core.hhUser1).decimals();
  }

  mostRecentTokenDecimals = tokenDecimals;
  return await prettyPrintEncodedDataWithTypeSafety(
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

export async function prettyPrintEncodeAddIsolationModeMarket(
  core: CoreProtocol,
  factory: IIsolationModeVaultFactory,
  oracle: IDolomitePriceOracle,
  unwrapper: IIsolationModeUnwrapperTrader,
  wrapper: IIsolationModeWrapperTrader,
  marketId: BigNumberish,
  targetCollateralization: TargetCollateralization,
  targetLiquidationPremium: TargetLiquidationPenalty,
  maxWei: BigNumberish,
): Promise<EncodedTransaction[]> {
  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteMargin',
      'ownerAddMarket',
      getOwnerAddMarketParametersForIsolationMode(
        factory,
        oracle,
        core.interestSetters.alwaysZeroInterestSetter,
        getMarginPremiumForTargetCollateralization(targetCollateralization),
        getLiquidationPremiumForTargetLiquidationPenalty(targetLiquidationPremium),
        maxWei,
      ),
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory },
      'factory',
      'ownerInitialize',
      [[unwrapper.address, wrapper.address]],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteMargin',
      'ownerSetGlobalOperator',
      [factory.address, true],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'liquidatorAssetRegistry',
      'ownerAddLiquidatorToAssetWhitelist',
      [marketId, core.liquidatorProxyV4.address],
    ),
  );
  return transactions;
}

export async function prettyPrintEncodeAddMarket(
  core: CoreProtocol,
  token: IERC20,
  oracle: IDolomitePriceOracle,
  interestSetter: IDolomiteInterestSetter,
  targetCollateralization: TargetCollateralization,
  targetLiquidationPremium: TargetLiquidationPenalty,
  maxWei: BigNumberish,
  isCollateralOnly: boolean,
): Promise<EncodedTransaction[]> {
  const transactions = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteMargin',
      'ownerAddMarket',
      getOwnerAddMarketParameters(
        token,
        oracle,
        interestSetter,
        getMarginPremiumForTargetCollateralization(targetCollateralization),
        getLiquidationPremiumForTargetLiquidationPenalty(targetLiquidationPremium),
        maxWei,
        isCollateralOnly,
      ),
    ),
  );
  return transactions;
}

export const DEPLOYMENT_FILE_NAME = './scripts/deployments.json';

export function writeDeploymentFile(
  fileContent: Record<string, Record<ChainId, any>>,
) {
  writeFile(
    DEPLOYMENT_FILE_NAME,
    JSON.stringify(sortFile(fileContent), null, 2),
  );
}

export function createFolder(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
}

export function writeFile(
  fileName: string,
  fileContent: string,
) {
  fs.writeFileSync(
    fileName,
    fileContent,
    { encoding: 'utf8', flag: 'w' },
  );
}
