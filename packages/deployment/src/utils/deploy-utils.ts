import { address } from '@dolomite-exchange/dolomite-margin';
import {
  IDolomiteInterestSetter,
  IDolomitePriceOracle,
  IERC20,
  IERC20__factory,
  IERC20Metadata__factory,
  IIsolationModeUnwrapperTraderV2,
  IIsolationModeVaultFactory,
  IIsolationModeWrapperTraderV2,
} from '@dolomite-exchange/modules-base/src/types';
import { CHAINLINK_PRICE_AGGREGATORS_MAP } from '@dolomite-exchange/modules-base/src/utils/constants';
import {
  getLiquidationPremiumForTargetLiquidationPenalty,
  getMarginPremiumForTargetCollateralization,
  getOwnerAddMarketParameters,
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import {
  createContractWithLibrary,
  createContractWithName,
} from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import {
  ADDRESS_ZERO,
  NetworkType,
  TEN_BI,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { CoreProtocolType } from '@dolomite-exchange/modules-base/test/utils/setup';
import { CoreProtocolWithChainlink } from '@dolomite-exchange/modules-oracles/src/oracles-constructors';
import { IChainlinkAggregator__factory } from '@dolomite-exchange/modules-oracles/src/types';
import {
  CoreProtocolWithPendle,
  getPendlePtIsolationModeUnwrapperTraderV2ConstructorParams,
  getPendlePtIsolationModeVaultFactoryConstructorParams,
  getPendlePtIsolationModeWrapperTraderV2ConstructorParams,
  getPendlePtPriceOracleConstructorParams,
  getPendleRegistryConstructorParams,
} from '@dolomite-exchange/modules-pendle/src/pendle-constructors';
import {
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
} from '@dolomite-exchange/modules-pendle/src/types';
import { Etherscan } from '@nomicfoundation/hardhat-verify/etherscan';
import { sleep } from '@openzeppelin/upgrades';
import { BaseContract, BigNumber, BigNumberish, PopulatedTransaction } from 'ethers';
import { commify, formatEther, FormatTypes, ParamType, parseEther } from 'ethers/lib/utils';
import fs, { readFileSync } from 'fs';
import fsExtra from 'fs-extra';
import hardhat, { artifacts, ethers, network } from 'hardhat';
import path, { join } from 'path';

type ChainId = string;

export const DEPLOYMENT_FILE_NAME = `${__dirname}/../deploy/deployments.json`;
export const CORE_DEPLOYMENT_FILE_NAME = path.resolve(
  __dirname,
  '../../../../node_modules/@dolomite-exchange/dolomite-margin/dist/migrations/deployed.json',
);

export function readDeploymentFile(): Record<string, Record<ChainId, any>> {
  return JSON.parse(fs.readFileSync(DEPLOYMENT_FILE_NAME).toString());
}

function readAllDeploymentFiles(): Record<string, Record<ChainId, any>> {
  const coreDeployments = JSON.parse(fs.readFileSync(CORE_DEPLOYMENT_FILE_NAME).toString());
  const deployments = readDeploymentFile();
  return {
    ...coreDeployments,
    ...deployments,
  };
}

export async function verifyContract(
  address: string,
  constructorArguments: any[],
  contractName: string,
  attempts: number = 0,
): Promise<void> {
  const customChain = hardhat.config.etherscan.customChains.filter(c => c.network === hardhat.network.name)[0];
  const instance = new Etherscan(
    (hardhat.config.etherscan.apiKey as Record<string, string>)[customChain.network],
    customChain.urls.apiURL,
    customChain.urls.browserURL,
  );
  if (await instance.isVerified(address)) {
    console.log('\tContract is already verified. Skipping verification...');
    return;
  }

  try {
    console.log('\tVerifying contract...');
    const artifact = await artifacts.readArtifact(contractName);
    const factory = await ethers.getContractFactoryFromArtifact(artifact);
    const buildInfo = artifacts.getBuildInfoSync(contractName);
    const { message: guid } = await instance.verify(
      address,
      JSON.stringify(buildInfo!.input),
      contractName,
      `v${buildInfo!.solcLongVersion}`,
      factory.interface.encodeDeploy(constructorArguments).slice(2),
    );

    await sleep(1000);
    const verificationStatus = await instance.getVerificationStatus(guid);
    if (verificationStatus.isSuccess()) {
      const contractURL = instance.getContractUrl(address);
      console.log(`\tSuccessfully verified contract "${contractName}": ${contractURL}`);
    }
  } catch (e: any) {
    if (e?.message.toLowerCase().includes('already verified')) {
      console.log('\tEtherscanVerification: Swallowing already verified error');
    } else if (attempts < 2) {
      await verifyContract(address, constructorArguments, contractName, attempts + 1);
    } else {
      return Promise.reject(e);
    }
  }
}

type ConstructorArgument = string | BigNumberish | boolean | ConstructorArgument[];

function findArtifactPath(parentPath: string, artifactName: string): string | undefined {
  const childPath = join(parentPath, `${artifactName}.sol`, `${artifactName}.json`);
  if (fs.existsSync(childPath)) {
    return childPath;
  }

  if (!fs.existsSync(parentPath)) {
    return undefined;
  }

  const childDirectories = fs.readdirSync(parentPath, { withFileTypes: true });
  for (const childDirectory of childDirectories) {
    const fullPath = path.join(parentPath, childDirectory.name);
    if (childDirectory.isDirectory() && !childDirectory.name.includes('.sol')) {
      const artifactPath = findArtifactPath(fullPath, artifactName);
      if (artifactPath) {
        return artifactPath;
      }
    }
  }

  return undefined;
}

async function getFreshArtifactFromWorkspace(artifactName: string) {
  const packagesPath = '../../../../packages';
  const deploymentsArtifactsPath = path.join(__dirname, packagesPath, 'deployment', 'artifacts');
  await fsExtra.remove(deploymentsArtifactsPath);

  const workspaces = fs.readdirSync(join(__dirname, packagesPath), { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => path.join(packagesPath, d.name));

  const contractsFolder = process.env.COVERAGE === 'true' ? 'contracts_coverage' : 'contracts';
  for (const workspace of workspaces) {
    const parentPath = join(__dirname, workspace, `artifacts/${contractsFolder}`);
    const artifactPath = findArtifactPath(parentPath, artifactName);
    if (artifactPath) {
      await fsExtra.copy(
        path.join(__dirname, workspace, 'artifacts'),
        deploymentsArtifactsPath,
        { overwrite: true },
      );
      // const packageDebugPath = artifactPath.replace('.json', '.dbg.json');
      // const deploymentDebugPath = packageDebugPath.replace(workspace.substring(21), 'deployment');
      // console.log('deploymentDebugPath', workspace.substring(21), deploymentDebugPath);
      // await fsExtra.copy(packageDebugPath, deploymentDebugPath, { overwrite: true });
      const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
      await artifacts.saveArtifactAndDebugFile(artifact);
      return;
    }
  }

  return Promise.reject(new Error(`Could not find ${artifactName}`));
}

export async function deployContractAndSave(
  contractName: string,
  args: ConstructorArgument[],
  contractRename?: string,
  libraries?: Record<string, string>,
  attempts: number = 0,
): Promise<address> {
  if (attempts === 3) {
    return Promise.reject(new Error(`\tCould not deploy after ${attempts} attempts!`));
  }

  const fileBuffer = fs.readFileSync(DEPLOYMENT_FILE_NAME);

  let file: Record<string, Record<ChainId, any>>;
  try {
    file = JSON.parse(fileBuffer.toString()) ?? {};
  } catch (e) {
    file = {};
  }

  await getFreshArtifactFromWorkspace(contractName);
  const chainId = network.config.chainId!;
  const usedContractName = contractRename ?? contractName;
  if (file[usedContractName]?.[chainId.toString()]) {
    const contract = file[usedContractName][chainId.toString()];
    console.log(`\tContract ${usedContractName} has already been deployed to chainId ${chainId} (${contract.address}). Skipping...`);
    if (!contract.isVerified) {
      await prettyPrintAndVerifyContract(file, chainId, contractName, usedContractName, args);
    }
    return contract.address;
  }

  console.log(`\tDeploying ${usedContractName} to chainId ${chainId}...`);

  let contract: BaseContract;
  try {
    contract = libraries
      ? await createContractWithLibrary(contractName, libraries, args)
      : await createContractWithName(contractName, args);
  } catch (e) {
    console.error(`\tCould not deploy at attempt ${attempts + 1} due to error:`, e);
    return deployContractAndSave(contractName, args, contractRename, libraries, attempts + 1);
  }

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

export function getTokenVaultLibrary<T extends NetworkType>(core: CoreProtocolType<T>): Record<string, string> {
  const libraryName = 'IsolationModeTokenVaultV1ActionsImpl';
  const deploymentName = 'IsolationModeTokenVaultV1ActionsImplV3';
  const deployments = readAllDeploymentFiles();
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

export async function deployPendlePtSystem<T extends NetworkType>(
  core: CoreProtocolWithPendle<T>,
  ptName: string,
  ptMarket: IPendlePtMarket,
  ptOracle: IPendlePtOracle,
  ptToken: IPendlePtToken,
  syToken: IPendleSyToken,
  underlyingToken: IERC20,
): Promise<PendlePtSystem> {
  const libraries = getTokenVaultLibrary(core);
  const userVaultImplementationAddress = await deployContractAndSave(
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
    'PendleRegistry',
    [],
    'PendleRegistryImplementationV1',
  );
  const registryImplementation = PendleRegistry__factory.connect(registryImplementationAddress, core.governance);
  const registryAddress = await deployContractAndSave(
    'RegistryProxy',
    await getPendleRegistryConstructorParams(registryImplementation, core, ptMarket, ptOracle, syToken),
    `Pendle${ptName}RegistryProxy`,
  );
  const registry = PendleRegistry__factory.connect(registryAddress, core.governance);

  const factoryAddress = await deployContractAndSave(
    'PendlePtIsolationModeVaultFactory',
    getPendlePtIsolationModeVaultFactoryConstructorParams(core, registry, ptToken, userVaultImplementation),
    `PendlePt${ptName}IsolationModeVaultFactory`,
  );
  const factory = PendlePtIsolationModeVaultFactory__factory.connect(factoryAddress, core.governance);

  const unwrapperAddress = await deployContractAndSave(
    'PendlePtIsolationModeUnwrapperTraderV2',
    getPendlePtIsolationModeUnwrapperTraderV2ConstructorParams(core, registry, underlyingToken, factory),
    `PendlePt${ptName}IsolationModeUnwrapperTraderV2`,
  );

  const wrapperAddress = await deployContractAndSave(
    'PendlePtIsolationModeWrapperTraderV2',
    getPendlePtIsolationModeWrapperTraderV2ConstructorParams(core, registry, underlyingToken, factory),
    `PendlePt${ptName}IsolationModeWrapperTraderV2`,
  );

  const oracleAddress = await deployContractAndSave(
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
  if (network.name === 'hardhat') {
    return;
  }

  const contract = file[contractRename][chainId.toString()];

  console.log(`========================= ${contractRename} =========================`);
  console.log('Address: ', contract.address);
  console.log('='.repeat(52 + contractRename.length));

  if (!(process.env.SKIP_VERIFICATION === 'true')) {
    console.log('\tSleeping for 5s to wait for the transaction to be indexed by Etherscan...');
    await sleep(3000);
    const artifact = await artifacts.readArtifact(contractName);
    await verifyContract(contract.address, [...args], `${artifact.sourceName}:${contractName}`);
    file[contractRename][chainId].isVerified = true;
    writeDeploymentFile(file);
  } else {
    console.log('\tSkipping Etherscan verification...');
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

async function getFormattedMarketName<T extends NetworkType>(
  core: CoreProtocolType<T>,
  marketId: BigNumberish,
): Promise<string> {
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

async function getFormattedTokenName<T extends NetworkType>(
  core: CoreProtocolType<T>,
  tokenAddress: string,
): Promise<string> {
  if (tokenAddress === ADDRESS_ZERO) {
    return '(None)';
  }

  const token = IERC20Metadata__factory.connect(tokenAddress, core.hhUser1);
  try {
    mostRecentTokenDecimals = await token.decimals();
  } catch (e) {
  }

  const cachedName = addressToNameCache[tokenAddress.toString().toLowerCase()];
  if (typeof cachedName !== 'undefined') {
    return cachedName;
  }
  try {
    addressToNameCache[tokenAddress.toLowerCase()] = `(${await token.symbol()})`;
    return addressToNameCache[tokenAddress.toLowerCase()]!;
  } catch (e) {
    addressToNameCache[tokenAddress.toLowerCase()] = '';
    return '';
  }
}

async function getFormattedChainlinkAggregatorName<T extends NetworkType>(
  core: CoreProtocolType<T>,
  aggregatorAddress: string,
): Promise<string> {
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
  chainId: NetworkType;
  transactions: EncodedTransaction[];
}

function isOwnerFunction(methodName: string): boolean {
  return methodName.startsWith('owner')
    || methodName === 'upgradeTo'
    || methodName === 'upgradeToAndCall'
    || methodName === 'setUserVaultImplementation'
    || methodName === 'setIsTokenConverterTrusted'
    || methodName === 'setGmxRegistry';
}

export async function prettyPrintEncodedDataWithTypeSafety<
  N extends NetworkType,
  T extends V[K],
  U extends keyof T['populateTransaction'],
  V extends Record<K, BaseContract>,
  K extends keyof V,
>(
  core: CoreProtocolType<N>,
  liveMap: V,
  key: K,
  methodName: U,
  args: Parameters<T['populateTransaction'][U]>,
): Promise<EncodedTransaction> {
  const contract = liveMap[key];
  const transaction = await contract.populateTransaction[methodName.toString()](...(args as any));

  if (hardhat.network.name !== 'hardhat') {
    const fragment = contract.interface.getFunction(methodName.toString());
    const mappedArgs: string[] = [];
    for (let i = 0; i < (args as any[]).length; i++) {
      mappedArgs.push(await getReadableArg(core, fragment.inputs[i], (args as any[])[i]));
    }

    const repeatLength = 76 + (counter - 1).toString().length + key.toString().length + methodName.toString().length;
    console.log(''); // add a new line
    console.log(`=================================== ${counter++} - ${key}.${methodName} ===================================`);
    console.log('Readable:\t', `${key}.${methodName}(\n\t\t\t${mappedArgs.join(' ,\n\t\t\t')}\n\t\t)`);
    console.log(
      'To:\t\t',
      (await getReadableArg(core, ParamType.fromString('address to'), transaction.to)).substring(13),
    );
    console.log('Data:\t\t', transaction.data);
    console.log('='.repeat(repeatLength));
    console.log(''); // add a new line
  }

  if (
    typeof methodName === 'string'
    && isOwnerFunction(methodName)
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

async function getReadableArg<T extends NetworkType>(
  core: CoreProtocolType<T>,
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
    const allDeployments = readAllDeploymentFiles();
    Object.keys(allDeployments).forEach(key => {
      if ((allDeployments as any)[key][chainId]?.address.toLowerCase() === arg.toLowerCase()) {
        specialName = ` (${key})`;
      }
    });
    if (!specialName) {
      Object.keys(allDeployments).forEach(key => {
        if ((allDeployments as any)[key][chainId]?.address.toLowerCase() === arg.toLowerCase()) {
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

export async function prettyPrintEncodeInsertChainlinkOracle<T extends NetworkType>(
  core: CoreProtocolWithChainlink<T>,
  token: IERC20,
  tokenPairAddress: address = ADDRESS_ZERO,
  aggregatorAddress: string = CHAINLINK_PRICE_AGGREGATORS_MAP[core.network][token.address],
): Promise<EncodedTransaction> {
  let tokenDecimals: number;
  if ('stEth' in core.tokens && token.address === core.tokens.stEth.address) {
    tokenDecimals = 18;
  } else {
    tokenDecimals = await IERC20Metadata__factory.connect(token.address, core.hhUser1).decimals();
  }

  const aggregator = IChainlinkAggregator__factory.connect(aggregatorAddress, core.governance);

  const description = await aggregator.description();
  const symbol = await IERC20Metadata__factory.connect(token.address, token.signer).symbol();
  if (!description.includes(symbol) && !description.includes(symbol.substring(1))) {
    return Promise.reject(new Error(`Invalid aggregator for symbol, found: ${description}, expected: ${symbol}`));
  }

  mostRecentTokenDecimals = tokenDecimals;
  return await prettyPrintEncodedDataWithTypeSafety(
    core,
    { chainlinkPriceOracle: core.chainlinkPriceOracle },
    'chainlinkPriceOracle',
    'ownerInsertOrUpdateOracleToken',
    [
      token.address,
      tokenDecimals,
      aggregator.address,
      tokenPairAddress,
    ],
  );
}

export async function prettyPrintEncodeAddIsolationModeMarket<T extends NetworkType>(
  core: CoreProtocolType<T>,
  factory: IIsolationModeVaultFactory,
  oracle: IDolomitePriceOracle,
  unwrapper: IIsolationModeUnwrapperTraderV2,
  wrapper: IIsolationModeWrapperTraderV2,
  marketId: BigNumberish,
  targetCollateralization: TargetCollateralization,
  targetLiquidationPremium: TargetLiquidationPenalty,
  maxSupplyWei: BigNumberish,
): Promise<EncodedTransaction[]> {
  const transactions: EncodedTransaction[] = await prettyPrintEncodeAddMarket(
    core,
    IERC20__factory.connect(factory.address, factory.signer),
    oracle,
    core.interestSetters.alwaysZeroInterestSetter,
    targetCollateralization,
    targetLiquidationPremium,
    maxSupplyWei,
    ZERO_BI,
    true,
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
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetGlobalOperator',
      [factory.address, true],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { liquidatorAssetRegistry: core.liquidatorAssetRegistry },
      'liquidatorAssetRegistry',
      'ownerAddLiquidatorToAssetWhitelist',
      [marketId, core.liquidatorProxyV4.address],
    ),
  );
  return transactions;
}

export async function prettyPrintEncodeAddMarket<T extends NetworkType>(
  core: CoreProtocolType<T>,
  token: IERC20,
  oracle: IDolomitePriceOracle,
  interestSetter: IDolomiteInterestSetter,
  targetCollateralization: TargetCollateralization,
  targetLiquidationPremium: TargetLiquidationPenalty,
  maxSupplyWei: BigNumberish,
  maxBorrowWei: BigNumberish,
  isCollateralOnly: boolean,
  earningsRateOverride: BigNumberish = ZERO_BI,
): Promise<EncodedTransaction[]> {
  if (!await isValidAmount(token, maxSupplyWei)) {
    const name = await getFormattedTokenName(core, token.address);
    return Promise.reject(new Error(`Invalid max supply wei for ${name}, found: ${maxSupplyWei.toString()}`));
  }
  if (!await isValidAmount(token, maxBorrowWei)) {
    const name = await getFormattedTokenName(core, token.address);
    return Promise.reject(new Error(`Invalid max borrow wei for ${name}, found: ${maxBorrowWei.toString()}`));
  }

  const transactions = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerAddMarket',
      getOwnerAddMarketParameters(
        core,
        token,
        oracle,
        interestSetter,
        getMarginPremiumForTargetCollateralization(targetCollateralization),
        getLiquidationPremiumForTargetLiquidationPenalty(targetLiquidationPremium),
        maxSupplyWei,
        maxBorrowWei,
        isCollateralOnly,
        earningsRateOverride,
      ),
    ),
  );
  return transactions;
}

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

async function isValidAmount(token: IERC20, amount: BigNumberish) {
  const realAmount = BigNumber.from(amount);
  if (realAmount.eq(ZERO_BI)) {
    return true;
  }

  const decimals = await IERC20Metadata__factory.connect(token.address, token.signer).decimals();
  const scale = TEN_BI.pow(decimals);
  return realAmount.div(scale).gte(TEN_BI) && realAmount.div(scale).lte(100_000_000);
}