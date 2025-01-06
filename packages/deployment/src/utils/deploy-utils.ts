import { address } from '@dolomite-exchange/dolomite-margin';
import {
  DolomiteERC4626,
  DolomiteERC4626__factory,
  DolomiteERC4626WithPayable,
  DolomiteERC4626WithPayable__factory,
  HandlerRegistry,
  IDolomiteInterestSetter,
  IDolomitePriceOracle,
  IERC20,
  IERC20__factory,
  IERC20Metadata__factory,
  IIsolationModeUnwrapperTraderV2,
  IIsolationModeVaultFactory, IIsolationModeVaultFactory__factory,
  IIsolationModeWrapperTraderV2,
} from '@dolomite-exchange/modules-base/src/types';
import {
  CHAINLINK_PRICE_AGGREGATORS_MAP,
  CHAOS_LABS_PRICE_AGGREGATORS_MAP,
  CHRONICLE_PRICE_SCRIBES_MAP,
  INVALID_TOKEN_MAP,
  REDSTONE_PRICE_AGGREGATORS_MAP,
} from '@dolomite-exchange/modules-base/src/utils/constants';
import {
  getDolomiteErc4626ProxyConstructorParams,
  getLiquidationPremiumForTargetLiquidationPenalty,
  getMarginPremiumForTargetCollateralization,
  getOwnerAddMarketParameters,
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import {
  ADDRESS_ZERO,
  BYTES_EMPTY,
  BYTES_ZERO,
  Network,
  NETWORK_TO_NETWORK_NAME_MAP,
  NetworkType,
  ONE_BI,
  TEN_BI,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { impersonate } from '@dolomite-exchange/modules-base/test/utils';
import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { CoreProtocolType } from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  GmxV2IsolationModeVaultFactory,
  GmxV2IsolationModeVaultFactory__factory,
  IGmxV2IsolationModeUnwrapperTraderV2,
  IGmxV2IsolationModeUnwrapperTraderV2__factory,
  IGmxV2IsolationModeVaultFactory,
  IGmxV2IsolationModeWrapperTraderV2,
  IGmxV2IsolationModeWrapperTraderV2__factory,
} from '@dolomite-exchange/modules-gmx-v2/src/types';
import {
  CoreProtocolWithChainlinkOld,
  CoreProtocolWithChainlinkV3,
  CoreProtocolWithChaosLabsV3,
  CoreProtocolWithChronicle,
  CoreProtocolWithRedstone,
} from '@dolomite-exchange/modules-oracles/src/oracles-constructors';
import { IChainlinkAggregator__factory, IChronicleScribe__factory } from '@dolomite-exchange/modules-oracles/src/types';
import {
  CoreProtocolWithPendle,
  getPendlePtIsolationModeUnwrapperTraderV2ConstructorParams,
  getPendlePtIsolationModeVaultFactoryConstructorParams,
  getPendlePtIsolationModeWrapperTraderV2ConstructorParams,
  getPendlePtPriceOracleV2ConstructorParams,
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
  PendlePtPriceOracleV2,
  PendlePtPriceOracleV2__factory,
  PendleRegistry__factory,
} from '@dolomite-exchange/modules-pendle/src/types';
import { Etherscan } from '@nomicfoundation/hardhat-verify/etherscan';
import { Libraries } from '@nomiclabs/hardhat-ethers/src/types';
import { sleep } from '@openzeppelin/upgrades';
import { BaseContract, BigNumber, BigNumberish, PopulatedTransaction, Signer } from 'ethers';
import { commify, formatEther, FormatTypes, keccak256, ParamType, parseEther } from 'ethers/lib/utils';
import fs, { readFileSync } from 'fs';
import fsExtra from 'fs-extra';
import hardhat, { artifacts, ethers, network } from 'hardhat';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { createContractWithName } from 'packages/base/src/utils/dolomite-utils';
import { CoreProtocolXLayer } from 'packages/base/test/utils/core-protocols/core-protocol-x-layer';
import { GlvToken } from 'packages/base/test/utils/ecosystem-utils/glv';
import { GmToken } from 'packages/base/test/utils/ecosystem-utils/gmx';
import {
  getGlvIsolationModeUnwrapperTraderV2ConstructorParams,
  getGlvIsolationModeVaultFactoryConstructorParams,
  getGlvIsolationModeWrapperTraderV2ConstructorParams,
} from 'packages/glv/src/glv-constructors';
import {
  GlvIsolationModeVaultFactory__factory,
  IGlvIsolationModeUnwrapperTraderV2,
  IGlvIsolationModeUnwrapperTraderV2__factory,
  IGlvIsolationModeVaultFactory,
  IGlvIsolationModeWrapperTraderV2,
  IGlvIsolationModeWrapperTraderV2__factory,
} from 'packages/glv/src/types';
import {
  getGmxV2IsolationModeUnwrapperTraderV2ConstructorParams,
  getGmxV2IsolationModeVaultFactoryConstructorParams,
  getGmxV2IsolationModeWrapperTraderV2ConstructorParams,
  GMX_V2_EXECUTION_FEE,
} from 'packages/gmx-v2/src/gmx-v2-constructors';
import path, { join } from 'path';
import ModuleDeployments from '../deploy/deployments.json';
import { CREATE3Factory__factory } from '../saved-types';

type ChainId = string;

export const DEPLOYMENT_FILE_NAME = `${__dirname}/../deploy/deployments.json`;
export const CORE_DEPLOYMENT_FILE_NAME = path.resolve(
  __dirname,
  '../../../../node_modules/@dolomite-exchange/dolomite-margin/dist/migrations/deployed.json',
);
export const TRANSACTION_BUILDER_VERSION = '1.16.5';

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
  libraries: Libraries,
  attempts: number = 0,
): Promise<void> {
  const customChain = hardhat.config.etherscan.customChains.filter((c) => c.network === hardhat.network.name)[0];
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
    const factory = await ethers.getContractFactoryFromArtifact(artifact, { libraries });

    const buildInfo = artifacts.getBuildInfoSync(contractName);

    // Retrieve and override only the needed sources
    const output = buildInfo!.output.contracts[artifact.sourceName][artifact.contractName];
    const allSources = JSON.parse((output as any).metadata).sources as Record<string, any>;
    buildInfo!.input.sources = Object.keys(buildInfo!.input.sources).reduce((memo, sourceName) => {
      if (allSources[sourceName]) {
        memo[sourceName] = buildInfo!.input.sources[sourceName];
      }
      return memo;
    }, {} as Record<string, { content: string }>);

    // Inject any needed libraries
    buildInfo!.input.settings.libraries = Object.keys(libraries).reduce<any>((acc, library) => {
      const artifact = artifacts.readArtifactSync(library);
      acc[`${artifact.sourceName}`] = { [library]: libraries[library] };
      return acc;
    }, {});

    const { message: guid } = await instance.verify(
      address,
      JSON.stringify(buildInfo!.input),
      contractName,
      `v${buildInfo!.solcLongVersion}`,
      factory.interface.encodeDeploy(constructorArguments).slice(2),
    );

    await sleep(1000);
    const verificationStatus = await instance.getVerificationStatus(guid);
    if (verificationStatus.isSuccess() || verificationStatus.isOk()) {
      const contractURL = instance.getContractUrl(address);
      console.log(`\tSuccessfully verified contract "${contractName}": ${contractURL}`);
    } else if (verificationStatus.isFailure()) {
      console.error(`\tCould not verify contract due to reason: ${verificationStatus.message}`);
    }
  } catch (e: any) {
    if (e?.message.toLowerCase().includes('already verified')) {
      console.log('\tEtherscanVerification: Swallowing already verified error');
    } else if (attempts < 2) {
      await sleep(3_000);
      await verifyContract(address, constructorArguments, contractName, libraries, attempts + 1);
    } else {
      console.error('Error with verifying:', e);
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
    const fullPath = join(parentPath, childDirectory.name);
    if (childDirectory.isDirectory() && !childDirectory.name.includes('.sol')) {
      const artifactPath = findArtifactPath(fullPath, artifactName);
      if (artifactPath) {
        return artifactPath;
      }
    }
  }

  return undefined;
}

export async function initializeFreshArtifactFromWorkspace(artifactName: string): Promise<void> {
  const packagesPath = '../../../../packages';
  const deploymentsArtifactsPath = join(__dirname, packagesPath, 'deployment', 'artifacts');
  fsExtra.removeSync(deploymentsArtifactsPath);

  const workspaces = fs
    .readdirSync(join(__dirname, packagesPath), { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.includes('deployment'))
    .map((d) => join(packagesPath, d.name));

  const contractsFolder = process.env.COVERAGE === 'true' ? 'contracts_coverage' : 'contracts';
  for (const workspace of workspaces) {
    const parentPath = join(__dirname, workspace, `artifacts/${contractsFolder}`);
    const artifactPath = findArtifactPath(parentPath, artifactName);
    if (artifactPath) {
      await fsExtra.copy(join(__dirname, workspace, 'artifacts'), deploymentsArtifactsPath, { overwrite: true });

      const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
      const pathToBuildInfo = getBuildInfoFromDebugFileSync(getDebugFilePath(artifactPath));
      await artifacts.saveArtifactAndDebugFile(artifact, pathToBuildInfo);
      return;
    }
  }

  return Promise.reject(new Error(`Could not find ${artifactName}`));
}

function getDebugFilePath(artifactPath: string): string {
  return artifactPath.replace(/\.json$/, '.dbg.json');
}

export function getBuildInfoFromDebugFileSync(debugFilePath: string): string | undefined {
  if (fsExtra.pathExistsSync(debugFilePath)) {
    const { buildInfo } = fsExtra.readJsonSync(debugFilePath);
    return path.resolve(path.dirname(debugFilePath), buildInfo);
  }

  return undefined;
}

function validateNameWithoutVersionPostfix(nameWithoutVersionPostfix: string) {
  const lastChar = nameWithoutVersionPostfix.substring(nameWithoutVersionPostfix.length - 1);
  if (!Number.isNaN(parseInt(lastChar, 10))) {
    throw new Error('Name cannot include version declaration');
  }
}

export function getMaxDeploymentVersionNumberByDeploymentKey(
  nameWithoutVersionPostfix: string,
  defaultVersion: number,
): number {
  validateNameWithoutVersionPostfix(nameWithoutVersionPostfix);

  const maxVersion = Object.keys(readDeploymentFile()).reduce((max, curr) => {
    if (curr.includes(nameWithoutVersionPostfix)) {
      // Add 1 to the length for the `V`
      const currentVersion = parseInt(curr.substring(nameWithoutVersionPostfix.length + 1), 10);
      return currentVersion > max ? currentVersion : max;
    }

    return max;
  }, defaultVersion);

  return Number(maxVersion);
}

/**
 * @param nameWithoutVersionPostfix IE IsolationModeTokenVault
 * @param defaultVersion The version that should be declared if no other version exists
 */
export function getMaxDeploymentVersionNameByDeploymentKey(nameWithoutVersionPostfix: string, defaultVersion: number) {
  const maxVersion = getMaxDeploymentVersionNumberByDeploymentKey(nameWithoutVersionPostfix, defaultVersion);
  return `${nameWithoutVersionPostfix}V${maxVersion}`;
}

/**
 * @param nameWithoutVersionPostfix IE IsolationModeTokenVault
 * @param network The chain ID of the address that's needed
 */
export function getMaxDeploymentVersionAddressByDeploymentKey(nameWithoutVersionPostfix: string, network: Network) {
  const nameWithVersion = getMaxDeploymentVersionNameByDeploymentKey(nameWithoutVersionPostfix, 1);
  return (ModuleDeployments as any)[nameWithVersion][network].address;
}

export function getOldDeploymentVersionNamesByDeploymentKey(nameWithoutVersionPostfix: string, defaultVersion: number) {
  validateNameWithoutVersionPostfix(nameWithoutVersionPostfix);

  const [versions, maxVersion] = Object.keys(readDeploymentFile()).reduce(
    ([versions, max], curr) => {
      if (curr.includes(nameWithoutVersionPostfix)) {
        // Add 1 to the length for the `V`
        const currentVersion = parseInt(curr.substring(nameWithoutVersionPostfix.length + 1), 10);
        return [versions.concat(currentVersion), currentVersion > max ? currentVersion : max];
      }

      return [versions, max];
    },
    [[] as number[], defaultVersion],
  );

  return versions.reduce((acc, version) => {
    if (version !== maxVersion) {
      return acc.concat(`${nameWithoutVersionPostfix}V${version}`);
    }
    return acc;
  }, [] as string[]);
}

export function isDeployed(contractName: string): boolean {
  const fileBuffer = fs.readFileSync(DEPLOYMENT_FILE_NAME);
  let file: Record<string, Record<ChainId, any>>;
  try {
    file = JSON.parse(fileBuffer.toString()) ?? {};
  } catch (e) {
    file = {};
  }

  const networkName = process.env.NETWORK ?? '';
  const chainId = hardhat.userConfig.networks![networkName]!.chainId;
  assertHardhatInvariant(
    typeof chainId === 'number' && NETWORK_TO_NETWORK_NAME_MAP[chainId.toString() as Network] === networkName,
    `Invalid chainId, found: ${chainId}`,
  );
  return file[contractName]?.[chainId.toString()];
}

let nonce: number | undefined = undefined;

export async function deployContractAndSave(
  contractName: string,
  args: ConstructorArgument[],
  contractRename?: string,
  libraries?: Record<string, string>,
  options: {
    nonce?: number;
    gasLimit?: BigNumberish;
    gasPrice?: BigNumberish;
    type?: number;
    skipArtifactInitialization?: boolean;
    signer?: Signer;
  } = {},
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

  if (!options.skipArtifactInitialization) {
    await initializeFreshArtifactFromWorkspace(contractName);
  }
  const networkName = process.env.NETWORK ?? '';
  const chainId = hardhat.userConfig.networks![networkName]!.chainId;
  assertHardhatInvariant(
    typeof chainId === 'number' && NETWORK_TO_NETWORK_NAME_MAP[chainId.toString() as Network] === networkName,
    `Invalid chainId, found: ${chainId}`,
  );
  const usedContractName = contractRename ?? contractName;
  const contractData = file[usedContractName]?.[chainId.toString()];
  if (contractData && contractData.address !== ADDRESS_ZERO) {
    const contract = file[usedContractName][chainId.toString()];
    console.log(
      `\tContract ${usedContractName} has already been deployed to chainId ${chainId} (${contract.address}). Skipping...`,
    );
    if (!contract.isVerified) {
      await prettyPrintAndVerifyContract(file, chainId, contractName, usedContractName, args, libraries ?? {});
    }
    console.log('');

    await verifyFactoryChildProxyContractIfNecessary(
      file,
      file[usedContractName]?.[chainId.toString()]?.transaction,
      usedContractName,
      chainId,
    );

    return contract.address;
  }

  console.log(`\tDeploying ${usedContractName} to network ${network.name}...`);

  let contract: { address: string; transactionHash: string };
  try {
    const signer = options.signer ?? ethers.provider.getSigner(0);
    if (nonce === undefined) {
      nonce = await ethers.provider.getTransactionCount(await signer.getAddress(), 'pending');
    }
    const opts = {
      nonce: options.nonce === undefined ? nonce : options.nonce,
      gasPrice: options.gasPrice,
      gasLimit: options.gasLimit,
      type: options.type,
    };

    if (contractName === 'CREATE3Factory') {
      const result = await createContractWithName('CREATE3Factory', args, opts, signer);
      contract = {
        address: result.address,
        transactionHash: result.deployTransaction.hash,
      };
    } else {
      const factory = await ethers.getContractFactory(contractName, { libraries, signer: options.signer });
      const transaction = factory.getDeployTransaction(...args);
      const deployer = CREATE3Factory__factory.connect(
        (ModuleDeployments.CREATE3Factory as any)[chainId].address,
        signer,
      );
      const salt = keccak256(ethers.utils.defaultAbiCoder.encode(['string'], [usedContractName]));
      const contractAddress = await deployer.getDeployed(await signer.getAddress(), salt);
      const code = await ethers.provider.getCode(contractAddress);
      if (code === BYTES_EMPTY) {
        const result = await deployer.deploy(salt, transaction.data!, opts);
        await result.wait();
        contract = {
          address: contractAddress,
          transactionHash: result.hash,
        };
        nonce += 1;
      } else {
        console.warn(`\t${contractRename} was already deployed. Filling in 0x0 for hash...`);
        contract = {
          address: contractAddress,
          transactionHash: BYTES_ZERO,
        };
      }
    }
  } catch (e) {
    console.error(`\tCould not deploy at attempt ${attempts + 1} due for ${contractName} to error:`, e);
    console.log(); // print new line

    const errorMessage = (e as any).message;
    if (errorMessage.includes('nonce has already been used') || errorMessage.includes('replacement fee too low')) {
      console.log('\tRe-fetching nonce...');
      const signer = ethers.provider.getSigner(0);
      nonce = await ethers.provider.getTransactionCount(await signer.getAddress(), 'pending');
    }
    return deployContractAndSave(contractName, args, contractRename, libraries, options, attempts + 1);
  }

  file[usedContractName] = {
    ...file[usedContractName],
    [chainId]: {
      address: contract.address,
      transaction: contract.transactionHash,
      isVerified: false,
    },
  };

  if (network.name !== 'hardhat') {
    writeDeploymentFile(file);
  }

  await prettyPrintAndVerifyContract(file, chainId, contractName, usedContractName, args, libraries ?? {});
  console.log('');

  await verifyFactoryChildProxyContractIfNecessary(
    file,
    file[usedContractName]?.[chainId.toString()]?.transaction,
    usedContractName,
    chainId,
  );

  return contract.address;
}

async function verifyFactoryChildProxyContractIfNecessary(
  file: Record<string, Record<ChainId, any>>,
  deploymentTransactionHash: string,
  usedContractName: string,
  chainId: number,
) {
  if (network.name !== 'hardhat') {
    const receipt = await ethers.provider.getTransactionReceipt(deploymentTransactionHash);
    const vaultCreatedTopic0 = '0x5d9c31ffa0fecffd7cf379989a3c7af252f0335e0d2a1320b55245912c781f53';
    const event = receipt?.logs.find((l) => l.topics[0] === vaultCreatedTopic0);
    if (event) {
      const vaultAddress = ethers.utils.defaultAbiCoder.decode(['address'], event.data)[0];
      const vaultRename = `${usedContractName}DeadProxy`;
      if (!file[vaultRename]?.[chainId]?.isVerified) {
        file[vaultRename] = {
          ...file[vaultRename],
          [chainId]: {
            address: vaultAddress,
            transaction: deploymentTransactionHash,
            isVerified: false,
          },
        };
        writeDeploymentFile(file);
        await prettyPrintAndVerifyContract(file, chainId, 'IsolationModeUpgradeableProxy', vaultRename, [], {});
      } else {
        console.log(
          `\tContract ${vaultRename} has already been verified on chainId ${chainId} (${vaultAddress}). Skipping...`,
        );
      }

      console.log('');
    }
  }
}

export interface GmxV2GlvTokenSystem {
  factory: IGlvIsolationModeVaultFactory;
  unwrapper: IGlvIsolationModeUnwrapperTraderV2;
  wrapper: IGlvIsolationModeWrapperTraderV2;
}

export async function deployGmxV2GlvTokenSystem(
  core: CoreProtocolArbitrumOne,
  glvToken: GlvToken,
  glvName: string,
): Promise<GmxV2GlvTokenSystem> {
  const stablecoins = core.marketIds.stablecoins;
  const shortIndex = stablecoins.findIndex((m) => BigNumber.from(m).eq(glvToken.shortMarketId));
  if (shortIndex !== -1) {
    const firstValue = stablecoins[0];
    stablecoins[0] = stablecoins[shortIndex];
    stablecoins[shortIndex] = firstValue;
  }

  const longMarketId = BigNumber.from(glvToken.longMarketId);
  const debtMarketIds = [...stablecoins];
  const collateralMarketIds = [...stablecoins];
  if (!longMarketId.eq(-1)) {
    debtMarketIds.unshift(longMarketId);
    collateralMarketIds.unshift(longMarketId);
  }
  if (longMarketId.eq(glvToken.shortMarketId)) {
    // Need to append the short marketId to the beginning too, even if they're the same asset
    debtMarketIds.unshift(longMarketId);
    collateralMarketIds.unshift(longMarketId);
  }

  function addMarketIdIfNeeded(list: BigNumberish[], findMarketId: BigNumberish) {
    if (!list.some((m) => BigNumber.from(m).eq(findMarketId))) {
      list.push(findMarketId);
    }
  }

  addMarketIdIfNeeded(debtMarketIds, core.marketIds.wbtc);
  addMarketIdIfNeeded(collateralMarketIds, core.marketIds.wbtc);

  addMarketIdIfNeeded(debtMarketIds, core.marketIds.weth);
  addMarketIdIfNeeded(collateralMarketIds, core.marketIds.weth);

  const factoryAddress = await deployContractAndSave(
    'GlvIsolationModeVaultFactory',
    getGlvIsolationModeVaultFactoryConstructorParams(
      core,
      core.glvEcosystem.live.registry,
      debtMarketIds,
      collateralMarketIds,
      glvToken,
      core.glvEcosystem.live.tokenVaultImplementation,
      GMX_V2_EXECUTION_FEE,
      longMarketId.eq(-1),
    ),
    `Glv${glvName}IsolationModeVaultFactory`,
    { ...core.gmxV2Ecosystem.live.gmxV2LibraryMap },
  );
  const factory = GlvIsolationModeVaultFactory__factory.connect(factoryAddress, core.hhUser1);

  const unwrapperProxyAddress = await deployContractAndSave(
    'IsolationModeTraderProxy',
    await getGlvIsolationModeUnwrapperTraderV2ConstructorParams(
      core,
      core.glvEcosystem.live.unwrapperImplementation,
      factory,
      core.glvEcosystem.live.registry,
      false,
    ),
    `Glv${glvName}AsyncIsolationModeUnwrapperTraderProxyV2`,
  );

  const wrapperProxyAddress = await deployContractAndSave(
    'IsolationModeTraderProxy',
    await getGlvIsolationModeWrapperTraderV2ConstructorParams(
      core,
      core.glvEcosystem.live.wrapperImplementation,
      factory,
      core.glvEcosystem.live.registry,
      false,
    ),
    `Glv${glvName}AsyncIsolationModeWrapperTraderProxyV2`,
  );

  return {
    factory,
    unwrapper: IGlvIsolationModeUnwrapperTraderV2__factory.connect(unwrapperProxyAddress, core.hhUser1),
    wrapper: IGlvIsolationModeWrapperTraderV2__factory.connect(wrapperProxyAddress, core.hhUser1),
  };
}

export interface GmxV2GmTokenSystem {
  factory: GmxV2IsolationModeVaultFactory;
  unwrapper: IGmxV2IsolationModeUnwrapperTraderV2;
  wrapper: IGmxV2IsolationModeWrapperTraderV2;
}

export async function deployGmxV2GmTokenSystem(
  core: CoreProtocolArbitrumOne,
  gmToken: GmToken,
  gmName: string,
): Promise<GmxV2GmTokenSystem> {
  const stablecoins = core.marketIds.stablecoins;
  const shortIndex = stablecoins.findIndex((m) => BigNumber.from(m).eq(gmToken.shortMarketId));
  if (shortIndex !== -1) {
    const firstValue = stablecoins[0];
    stablecoins[0] = stablecoins[shortIndex];
    stablecoins[shortIndex] = firstValue;
  }

  const longMarketId = BigNumber.from(gmToken.longMarketId);
  const debtMarketIds = [...stablecoins];
  const collateralMarketIds = [...stablecoins];
  if (!longMarketId.eq(-1)) {
    debtMarketIds.unshift(longMarketId);
    collateralMarketIds.unshift(longMarketId);
  }
  if (longMarketId.eq(gmToken.shortMarketId)) {
    // Need to append the short marketId to the beginning too, even if they're the same asset
    debtMarketIds.unshift(longMarketId);
    collateralMarketIds.unshift(longMarketId);
  }

  function addMarketIdIfNeeded(list: BigNumberish[], findMarketId: BigNumberish) {
    if (!list.some((m) => BigNumber.from(m).eq(findMarketId))) {
      list.push(findMarketId);
    }
  }

  addMarketIdIfNeeded(debtMarketIds, core.marketIds.wbtc);
  addMarketIdIfNeeded(collateralMarketIds, core.marketIds.wbtc);

  addMarketIdIfNeeded(debtMarketIds, core.marketIds.weth);
  addMarketIdIfNeeded(collateralMarketIds, core.marketIds.weth);

  const factoryAddress = await deployContractAndSave(
    'GmxV2IsolationModeVaultFactory',
    getGmxV2IsolationModeVaultFactoryConstructorParams(
      core,
      core.gmxV2Ecosystem.live.registry,
      debtMarketIds,
      collateralMarketIds,
      gmToken,
      core.gmxV2Ecosystem.live.tokenVaultImplementation,
      GMX_V2_EXECUTION_FEE,
      longMarketId.eq(-1),
    ),
    `GmxV2${gmName}IsolationModeVaultFactory`,
    core.gmxV2Ecosystem.live.gmxV2LibraryMap,
  );
  const factory = GmxV2IsolationModeVaultFactory__factory.connect(factoryAddress, core.hhUser1);

  const unwrapperProxyAddress = await deployContractAndSave(
    'IsolationModeTraderProxy',
    await getGmxV2IsolationModeUnwrapperTraderV2ConstructorParams(
      core,
      core.gmxV2Ecosystem.live.unwrapperImplementation,
      factory,
      core.gmxV2Ecosystem.live.registry,
      false,
    ),
    `GmxV2${gmName}AsyncIsolationModeUnwrapperTraderProxyV2`,
  );

  const wrapperProxyAddress = await deployContractAndSave(
    'IsolationModeTraderProxy',
    await getGmxV2IsolationModeWrapperTraderV2ConstructorParams(
      core,
      core.gmxV2Ecosystem.live.wrapperImplementation,
      factory,
      core.gmxV2Ecosystem.live.registry,
      false,
    ),
    `GmxV2${gmName}AsyncIsolationModeWrapperTraderProxyV2`,
  );

  return {
    factory,
    unwrapper: IGmxV2IsolationModeUnwrapperTraderV2__factory.connect(unwrapperProxyAddress, core.hhUser1),
    wrapper: IGmxV2IsolationModeWrapperTraderV2__factory.connect(wrapperProxyAddress, core.hhUser1),
  };
}

export interface PendlePtSystem {
  factory: PendlePtIsolationModeVaultFactory;
  oracle: PendlePtPriceOracleV2;
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
  const officialPtName = await IERC20Metadata__factory.connect(ptToken.address, ptToken.signer).name();
  const [syOfficial, ptOfficial] = await ptMarket.readTokens();
  const syTokensIn = await syToken.getTokensIn();
  const ptNamePart = ptName.substring(0, ptName.length - 7);
  if (!officialPtName.toUpperCase().includes(ptNamePart.toUpperCase())) {
    return Promise.reject(
      new Error(
        `ptName does not match official PT name on chain. official: [${officialPtName}], found: [${ptNamePart}]`,
      ),
    );
  }
  if (syOfficial !== syToken.address) {
    return Promise.reject(new Error(`SY does not match official SY on chain: ${syOfficial} / ${syToken.address}`));
  }
  if (ptOfficial !== ptToken.address) {
    return Promise.reject(new Error(`PT does not match official PT on chain: ${ptOfficial} / ${ptToken.address}`));
  }
  if (!syTokensIn.some((t) => t === underlyingToken.address)) {
    return Promise.reject(
      new Error(
        `Underlying does not match official underlying on chain: underlying=[${
          underlyingToken.address
        }] official=[${syTokensIn.join(', ')}]`,
      ),
    );
  }

  const userVaultImplementationAddress = await deployContractAndSave(
    'PendlePtIsolationModeTokenVaultV1',
    [],
    `PendlePt${ptName}IsolationModeTokenVaultV1`,
    core.libraries.tokenVaultActionsImpl,
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
    'PendlePtIsolationModeUnwrapperTraderV3',
    getPendlePtIsolationModeUnwrapperTraderV2ConstructorParams(core, registry, underlyingToken, factory),
    `PendlePt${ptName}IsolationModeUnwrapperTraderV3`,
  );

  const wrapperAddress = await deployContractAndSave(
    'PendlePtIsolationModeWrapperTraderV3',
    getPendlePtIsolationModeWrapperTraderV2ConstructorParams(core, registry, underlyingToken, factory),
    `PendlePt${ptName}IsolationModeWrapperTraderV3`,
  );

  const oracleAddress = await deployContractAndSave(
    'PendlePtPriceOracleV2',
    getPendlePtPriceOracleV2ConstructorParams(core, factory, registry),
    `PendlePt${ptName}PriceOracleV2`,
  );
  const oracle = PendlePtPriceOracleV2__factory.connect(oracleAddress, core.governance);

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
    lowerOptimal.lt(ONE_PERCENT) ||
    upperOptimal.lt(ONE_PERCENT) ||
    !lowerOptimal.add(upperOptimal).eq(ONE_PERCENT.mul(100))
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

export async function deployDolomiteErc4626Token(
  core: CoreProtocolType<any>,
  tokenName: string,
  marketId: BigNumberish,
): Promise<DolomiteERC4626> {
  const address = await deployContractAndSave(
    'RegistryProxy',
    await getDolomiteErc4626ProxyConstructorParams(core, marketId),
    `Dolomite${tokenName}4626Token`,
  );
  return DolomiteERC4626__factory.connect(address, core.hhUser1);
}

export async function deployDolomiteErc4626WithPayableToken(
  core: CoreProtocolType<any>,
  tokenName: string,
  marketId: BigNumberish,
): Promise<DolomiteERC4626WithPayable> {
  const address = await deployContractAndSave(
    'RegistryProxy',
    await getDolomiteErc4626ProxyConstructorParams(core, marketId),
    `Dolomite${tokenName}4626Token`,
  );
  return DolomiteERC4626WithPayable__factory.connect(address, core.hhUser1);
}

export function sortFile(file: Record<string, Record<ChainId, any>>) {
  const sortedFileKeys = Object.keys(file).sort((a, b) => {
    const aSplitPoint = a.search(/V\d+$/);
    const bSplitPoint = b.search(/V\d+$/);
    if (aSplitPoint !== -1 && bSplitPoint !== -1) {
      const aBase = a.substring(0, aSplitPoint);
      const bBase = b.substring(0, bSplitPoint);
      if (aBase === bBase) {
        const aVersion = a.substring(aSplitPoint + 1);
        const bVersion = b.substring(bSplitPoint + 1);
        return parseInt(aVersion, 10) - parseInt(bVersion, 10);
      }
    }
    return a.localeCompare(b);
  });
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
  libraries: Libraries,
) {
  if (network.name === 'hardhat') {
    return;
  }

  const contract = file[contractRename][chainId.toString()];

  console.log(`\t========================= ${contractRename} =========================`);
  console.log('\tAddress: ', contract.address);
  console.log(`\t${'='.repeat(52 + contractRename.length)}`);

  if (!(process.env.SKIP_VERIFICATION === 'true')) {
    console.log('\tSleeping for 5s to wait for the transaction to be indexed by the block explorer...');
    await sleep(5000);
    const artifact = await artifacts.readArtifact(contractName);
    await verifyContract(contract.address, [...args], `${artifact.sourceName}:${contractName}`, libraries);
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
  } catch (e) {}

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
  return (
    (paramType.name.includes('token') || paramType.name.includes('Token')) &&
    !paramType.name.toLowerCase().includes('decimals')
  );
}

function isChainlinkAggregatorParam(paramType: ParamType): boolean {
  return paramType.name.includes('chainlinkAggregator');
}

function isMaxWeiParam(paramType: ParamType): boolean {
  return (
    paramType.name.includes('maxWei') ||
    paramType.name.includes('maxSupplyWei') ||
    paramType.name.includes('maxBorrowWei')
  );
}

export interface EncodedTransaction {
  to: string;
  value: string;
  data: string;
}

export interface DenJsonUpload {
  addExecuteImmediatelyTransactions?: boolean;
  chainId: NetworkType;
  transactions: EncodedTransaction[];
}

export interface TransactionBuilderUpload extends DenJsonUpload {
  version: '1.0';
  meta: {
    name: string;
    txBuilderVersion: typeof TRANSACTION_BUILDER_VERSION;
  };
}

function isOwnerFunction(methodName: string, isMultisig: boolean): boolean {
  return (
    methodName.startsWith('owner') ||
    methodName === 'initializeETHMarket' ||
    methodName === 'setGmxRegistry' ||
    methodName === 'setIsTokenConverterTrusted' ||
    methodName === 'setUserVaultImplementation' ||
    methodName === 'upgradeTo' ||
    methodName === 'upgradeToAndCall' ||
    (isMultisig && methodName === 'addOwner') ||
    (isMultisig && methodName === 'changeRequirement') ||
    (isMultisig && methodName === 'changeTimelock') ||
    (isMultisig && methodName === 'removeOver') ||
    (isMultisig && methodName === 'replaceOwner') ||
    (isMultisig && methodName === 'setSelector')
  );
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
  options: { skipWrappingCalldataInSubmitTransaction: boolean } = { skipWrappingCalldataInSubmitTransaction: false },
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
    console.log(
      `=================================== ${counter++} - ${String(key)}.${String(
        methodName,
      )} ===================================`,
    );
    console.log('Readable:\t', `${String(key)}.${String(methodName)}(\n\t\t\t${mappedArgs.join(' ,\n\t\t\t')}\n\t\t)`);
    console.log(
      'To:\t\t',
      (await getReadableArg(core, ParamType.fromString('address to'), transaction.to)).substring(13),
    );
    console.log('Data:\t\t', transaction.data);
    console.log('='.repeat(repeatLength));
    console.log(''); // add a new line
  }

  const realtimeOwner = await core.dolomiteMargin.owner();
  const skipWrappingCalldataInSubmitTransaction =
    options.skipWrappingCalldataInSubmitTransaction ||
    (realtimeOwner === core.ownerAdapterV1.address && realtimeOwner === transaction.to!);
  if (skipWrappingCalldataInSubmitTransaction) {
    return {
      to: transaction.to!,
      value: transaction.value?.toString() ?? '0',
      data: transaction.data!,
    };
  }

  let outerTransaction: PopulatedTransaction;
  if (realtimeOwner === core.ownerAdapterV1?.address) {
    outerTransaction = await core.ownerAdapterV1.populateTransaction.submitTransaction(
      transaction.to!,
      transaction.data!,
    );
  } else if (realtimeOwner === core.delayedMultiSig?.address) {
    outerTransaction = await core.delayedMultiSig.populateTransaction.submitTransaction(
      transaction.to!,
      transaction.value ?? ZERO_BI,
      transaction.data!,
    );
  } else if (realtimeOwner === core.gnosisSafeAddress) {
    outerTransaction = { ...transaction };
  } else {
    return Promise.reject(new Error(`Unknown owner contract: ${realtimeOwner}`));
  }

  return {
    to: outerTransaction.to!,
    value: outerTransaction.value?.toString() ?? '0',
    data: outerTransaction.data!,
  };
}

let mostRecentTokenDecimals: number | undefined = undefined;

async function getReadableArg<T extends NetworkType>(
  core: CoreProtocolType<T>,
  inputParamType: ParamType,
  arg: any,
  decimals?: number,
  index?: number,
  nestedLevel: number = 3,
): Promise<string> {
  let formattedInputParamName: string;
  if (typeof index !== 'undefined') {
    formattedInputParamName = `${inputParamType.name}[${index}]`;
  } else {
    formattedInputParamName = inputParamType.format(FormatTypes.full);
  }

  if (Array.isArray(arg)) {
    // remove the [] at the end
    const subParamType = ParamType.fromObject({
      ...inputParamType.arrayChildren,
      name: inputParamType.name,
    });
    const formattedArgs = await Promise.all(
      arg.map(async (value, i) => {
        return await getReadableArg(core, subParamType, value, decimals, i, nestedLevel + 1);
      }),
    );
    const tabs = '\t'.repeat(nestedLevel);
    return `${formattedInputParamName} = [\n${tabs}\t${formattedArgs.join(` ,\n${tabs}\t`)}\n${tabs}]`;
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
    Object.keys(allDeployments).forEach((key) => {
      if ((allDeployments as any)[key][chainId]?.address?.toLowerCase() === arg.toLowerCase()) {
        specialName = ` (${key})`;
      }
    });
    if (!specialName) {
      Object.keys(allDeployments).forEach((key) => {
        if ((allDeployments as any)[key][chainId]?.address?.toLowerCase() === arg.toLowerCase()) {
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
      const componentPiece = inputParamType.components[i];
      values.push(
        await getReadableArg(core, componentPiece, arg[componentPiece.name], decimals, index, nestedLevel + 1),
      );
    }
    const tabs = '\t'.repeat(nestedLevel);
    return `${formattedInputParamName} = {\n${tabs}\t${values.join(` ,\n${tabs}\t`)}\n${tabs}}`;
  }

  if (BigNumber.isBigNumber(arg) && typeof decimals !== 'undefined') {
    const multiplier = BigNumber.from(10).pow(18 - decimals);
    specialName = ` (${commify(formatEther(arg.mul(multiplier)))})`;
  }

  return `${formattedInputParamName} = ${arg}${specialName}`;
}

export async function prettyPrintEncodeInsertChainlinkOracle<T extends NetworkType>(
  core: CoreProtocolWithChainlinkOld<T>,
  token: IERC20,
  tokenPairAddress: string | undefined = CHAINLINK_PRICE_AGGREGATORS_MAP[core.network][token.address]!.tokenPairAddress,
  aggregatorAddress: string = CHAINLINK_PRICE_AGGREGATORS_MAP[core.network][token.address]!.aggregatorAddress,
  options?: { ignoreDescription: boolean },
): Promise<EncodedTransaction> {
  const invalidTokens = ['stEth', 'eEth'];
  let tokenDecimals: number;
  if (invalidTokens.some((t) => t in core.tokens && token.address === (core.tokens as any)[t].address)) {
    tokenDecimals = 18;
  } else {
    tokenDecimals = await IERC20Metadata__factory.connect(token.address, core.hhUser1).decimals();
  }

  const aggregator = IChainlinkAggregator__factory.connect(aggregatorAddress, core.governance);

  const description = (await aggregator.description()).toLowerCase();
  const symbol = (await IERC20Metadata__factory.connect(token.address, token.signer).symbol()).toLowerCase();
  if (!options?.ignoreDescription) {
    if (!description.includes(symbol) && !description.includes(symbol.substring(1))) {
      return Promise.reject(new Error(`Invalid aggregator for symbol, found: ${description}, expected: ${symbol}`));
    }
  }

  mostRecentTokenDecimals = tokenDecimals;
  return await prettyPrintEncodedDataWithTypeSafety(
    core,
    { chainlinkPriceOracle: core.chainlinkPriceOracleV1 },
    'chainlinkPriceOracle',
    'ownerInsertOrUpdateOracleToken',
    [token.address, tokenDecimals, aggregator.address, tokenPairAddress ?? ADDRESS_ZERO],
  );
}

export async function prettyPrintEncodeInsertChainlinkOracleV3<T extends NetworkType>(
  core: CoreProtocolWithChainlinkV3<T>,
  token: IERC20,
  invertPrice: boolean = CHAINLINK_PRICE_AGGREGATORS_MAP[core.network][token.address]!.invert ?? false,
  tokenPairAddress: string | undefined = CHAINLINK_PRICE_AGGREGATORS_MAP[core.network][token.address]!.tokenPairAddress,
  aggregatorAddress: string = CHAINLINK_PRICE_AGGREGATORS_MAP[core.network][token.address]!.aggregatorAddress,
  options?: { ignoreDescription: boolean },
): Promise<EncodedTransaction[]> {
  const invalidTokenSettings = INVALID_TOKEN_MAP[core.network][token.address];

  let tokenDecimals: number;
  if (invalidTokenSettings) {
    tokenDecimals = invalidTokenSettings.decimals;
  } else {
    tokenDecimals = await IERC20Metadata__factory.connect(token.address, core.hhUser1).decimals();
  }

  const aggregator = IChainlinkAggregator__factory.connect(aggregatorAddress, core.governance);

  const description = await aggregator.description();
  let symbol: string;
  if (invalidTokenSettings) {
    symbol = invalidTokenSettings.symbol;
  } else {
    symbol = await IERC20Metadata__factory.connect(token.address, token.signer).symbol();
  }

  if (!options?.ignoreDescription) {
    if (
      !description.toUpperCase().includes(symbol.toUpperCase()) &&
      !description.toUpperCase().includes(symbol.toUpperCase().substring(1))
    ) {
      return Promise.reject(new Error(`Invalid aggregator for symbol, found: ${description}, expected: ${symbol}`));
    }
  }

  mostRecentTokenDecimals = tokenDecimals;
  return [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { chainlinkPriceOracle: core.chainlinkPriceOracleV3 },
      'chainlinkPriceOracle',
      'ownerInsertOrUpdateOracleToken',
      [token.address, aggregator.address, invertPrice],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { oracleAggregatorV2: core.oracleAggregatorV2 },
      'oracleAggregatorV2',
      'ownerInsertOrUpdateToken',
      [
        {
          token: token.address,
          decimals: tokenDecimals,
          oracleInfos: [
            {
              oracle: core.chainlinkPriceOracleV3.address,
              tokenPair: tokenPairAddress ?? ADDRESS_ZERO,
              weight: 100,
            },
          ],
        },
      ],
    ),
  ];
}

export async function prettyPrintEncodeInsertChaosLabsOracleV3<T extends NetworkType>(
  core: CoreProtocolWithChaosLabsV3<T>,
  token: IERC20,
  invertPrice: boolean = CHAOS_LABS_PRICE_AGGREGATORS_MAP[core.network][token.address]?.invert ?? false,
  tokenPairAddress: string | undefined = CHAOS_LABS_PRICE_AGGREGATORS_MAP[core.network][token.address]
    ?.tokenPairAddress,
  aggregatorAddress: string = CHAOS_LABS_PRICE_AGGREGATORS_MAP[core.network][token.address]!.aggregatorAddress,
  options?: { ignoreDescription: boolean },
): Promise<EncodedTransaction[]> {
  const invalidTokenSettings = INVALID_TOKEN_MAP[core.network][token.address];

  let tokenDecimals: number;
  if (invalidTokenSettings) {
    tokenDecimals = invalidTokenSettings.decimals;
  } else {
    tokenDecimals = await IERC20Metadata__factory.connect(token.address, core.hhUser1).decimals();
  }

  const aggregator = IChainlinkAggregator__factory.connect(aggregatorAddress, core.governance);

  const description = await aggregator.description();
  let symbol: string;
  if (invalidTokenSettings) {
    symbol = invalidTokenSettings.symbol;
  } else {
    symbol = await IERC20Metadata__factory.connect(token.address, token.signer).symbol();
  }

  if (!options?.ignoreDescription) {
    if (
      !description.toUpperCase().includes(symbol.toUpperCase()) &&
      !description.toUpperCase().includes(symbol.toUpperCase().substring(1))
    ) {
      return Promise.reject(new Error(`Invalid aggregator for symbol, found: ${description}, expected: ${symbol}`));
    }
  }

  mostRecentTokenDecimals = tokenDecimals;
  return [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { chaosLabsPriceOracle: core.chaosLabsPriceOracleV3 },
      'chaosLabsPriceOracle',
      'ownerInsertOrUpdateOracleToken',
      [token.address, aggregator.address, invertPrice],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { oracleAggregatorV2: core.oracleAggregatorV2 },
      'oracleAggregatorV2',
      'ownerInsertOrUpdateToken',
      [
        {
          token: token.address,
          decimals: tokenDecimals,
          oracleInfos: [
            {
              oracle: core.chaosLabsPriceOracleV3.address,
              tokenPair: tokenPairAddress ?? ADDRESS_ZERO,
              weight: 100,
            },
          ],
        },
      ],
    ),
  ];
}

export async function prettyPrintEncodeInsertChronicleOracleV3(
  core: CoreProtocolWithChronicle<Network.ArbitrumOne | Network.Berachain | Network.Mantle>,
  token: IERC20,
  invertPrice: boolean = CHRONICLE_PRICE_SCRIBES_MAP[core.config.network][token.address].invertPrice ?? false,
  tokenPairAddress: string | undefined = CHRONICLE_PRICE_SCRIBES_MAP[core.config.network][token.address]
    .tokenPairAddress,
  scribeAddress: string = CHRONICLE_PRICE_SCRIBES_MAP[core.config.network][token.address].scribeAddress,
): Promise<EncodedTransaction[]> {
  const invalidTokenSettings = INVALID_TOKEN_MAP[core.network][token.address];

  let tokenDecimals: number;
  if (invalidTokenSettings) {
    tokenDecimals = invalidTokenSettings.decimals;
  } else {
    tokenDecimals = await IERC20Metadata__factory.connect(token.address, core.hhUser1).decimals();
  }

  const scribe = IChronicleScribe__factory.connect(scribeAddress, core.governance);

  let symbol: string;
  if (invalidTokenSettings) {
    symbol = invalidTokenSettings.symbol;
  } else {
    symbol = await IERC20Metadata__factory.connect(token.address, token.signer).symbol();
  }

  const oracleAddress = core.chroniclePriceOracleV3.address;
  if ((await scribe.bud(oracleAddress)).eq(ZERO_BI)) {
    console.warn(`ChroniclePriceOracleV3 has not been kissed yet for scribe ${scribe.address}!`);
  }

  if (network.name === 'hardhat') {
    const toller = await impersonate((await scribe.authed())[0], true);
    const oracle = await impersonate(oracleAddress, true);
    await scribe.connect(toller).kiss(oracle.address);
    console.log(`\tChronicle price for ${symbol}:`, (await scribe.connect(oracle).latestRoundData()).answer.toString());
  }

  mostRecentTokenDecimals = tokenDecimals;
  return [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { chroniclePriceOracle: core.chroniclePriceOracleV3 },
      'chroniclePriceOracle',
      'ownerInsertOrUpdateOracleToken',
      [token.address, scribe.address, invertPrice],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { oracleAggregatorV2: core.oracleAggregatorV2 },
      'oracleAggregatorV2',
      'ownerInsertOrUpdateToken',
      [
        {
          token: token.address,
          decimals: tokenDecimals,
          oracleInfos: [
            {
              oracle: core.chroniclePriceOracleV3.address,
              tokenPair: tokenPairAddress ?? ADDRESS_ZERO,
              weight: 100,
            },
          ],
        },
      ],
    ),
  ];
}

export async function prettyPrintEncodeInsertOkxOracleV3(
  core: CoreProtocolXLayer,
  token: IERC20,
  invertPrice: boolean,
  tokenPairAddress: string | undefined = CHAINLINK_PRICE_AGGREGATORS_MAP[core.network][token.address]!.tokenPairAddress,
  aggregatorAddress: string = CHAINLINK_PRICE_AGGREGATORS_MAP[core.network][token.address]!.aggregatorAddress,
): Promise<EncodedTransaction[]> {
  const invalidTokenMap: Record<Network.XLayer, Record<string, { symbol: string; decimals: number }>> = {
    [Network.XLayer]: {},
  };
  const invalidTokenSettings = invalidTokenMap[core.network][token.address];

  let tokenDecimals: number;
  if (invalidTokenSettings) {
    tokenDecimals = invalidTokenSettings.decimals;
  } else {
    tokenDecimals = await IERC20Metadata__factory.connect(token.address, core.hhUser1).decimals();
  }

  const aggregator = IChainlinkAggregator__factory.connect(aggregatorAddress, core.governance);

  const description = await aggregator.description();
  let symbol: string;
  if (invalidTokenSettings) {
    symbol = invalidTokenSettings.symbol;
  } else {
    symbol = await IERC20Metadata__factory.connect(token.address, token.signer).symbol();
  }

  if (
    !description.toUpperCase().includes(symbol.toUpperCase()) &&
    !description.toUpperCase().includes(symbol.toUpperCase().substring(1))
  ) {
    return Promise.reject(new Error(`Invalid aggregator for symbol, found: ${description}, expected: ${symbol}`));
  }

  mostRecentTokenDecimals = tokenDecimals;
  return [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { okxPriceOracle: core.okxPriceOracleV3 },
      'okxPriceOracle',
      'ownerInsertOrUpdateOracleToken',
      [token.address, aggregator.address, invertPrice],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { oracleAggregatorV2: core.oracleAggregatorV2 },
      'oracleAggregatorV2',
      'ownerInsertOrUpdateToken',
      [
        {
          token: token.address,
          decimals: tokenDecimals,
          oracleInfos: [
            {
              oracle: core.okxPriceOracleV3.address,
              tokenPair: tokenPairAddress ?? ADDRESS_ZERO,
              weight: 100,
            },
          ],
        },
      ],
    ),
  ];
}

export async function prettyPrintEncodeInsertPendlePtOracle<T extends NetworkType>(
  core: CoreProtocolType<T>,
  pendleSystem: PendlePtSystem,
  token: IERC20,
): Promise<EncodedTransaction> {
  return prettyPrintEncodedDataWithTypeSafety(
    core,
    { oracleAggregatorV2: core.oracleAggregatorV2 },
    'oracleAggregatorV2',
    'ownerInsertOrUpdateToken',
    [
      {
        token: pendleSystem.factory.address,
        decimals: await pendleSystem.factory.decimals(),
        oracleInfos: [
          {
            oracle: pendleSystem.oracle.address,
            tokenPair: token.address,
            weight: 100,
          },
        ],
      },
    ],
  );
}

export async function prettyPrintEncodeInsertRedstoneOracleV3<T extends NetworkType>(
  core: CoreProtocolWithRedstone<T>,
  token: IERC20,
  invertPrice: boolean = REDSTONE_PRICE_AGGREGATORS_MAP[core.config.network][token.address]!.invert ?? false,
  tokenPairAddress: string | undefined = REDSTONE_PRICE_AGGREGATORS_MAP[core.config.network][token.address]!
    .tokenPairAddress,
  aggregatorAddress: string = REDSTONE_PRICE_AGGREGATORS_MAP[core.config.network][token.address]!.aggregatorAddress,
): Promise<EncodedTransaction[]> {
  const invalidTokenSettings = INVALID_TOKEN_MAP[Network.Mantle][token.address];

  let tokenDecimals: number;
  if (invalidTokenSettings) {
    tokenDecimals = invalidTokenSettings.decimals;
  } else {
    tokenDecimals = await IERC20Metadata__factory.connect(token.address, core.hhUser1).decimals();
  }

  const aggregator = IChainlinkAggregator__factory.connect(aggregatorAddress, core.governance);

  let symbol: string;
  if (invalidTokenSettings) {
    symbol = invalidTokenSettings.symbol;
  } else {
    symbol = await IERC20Metadata__factory.connect(token.address, token.signer).symbol();
  }

  console.log(`\tRedstone price for ${symbol}:`, (await aggregator.latestRoundData()).answer.toString());

  mostRecentTokenDecimals = tokenDecimals;
  return [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { redstonePriceOracle: core.redstonePriceOracleV3 },
      'redstonePriceOracle',
      'ownerInsertOrUpdateOracleToken',
      [token.address, aggregator.address, invertPrice],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { oracleAggregatorV2: core.oracleAggregatorV2 },
      'oracleAggregatorV2',
      'ownerInsertOrUpdateToken',
      [
        {
          token: token.address,
          decimals: tokenDecimals,
          oracleInfos: [
            {
              oracle: core.redstonePriceOracleV3.address,
              tokenPair: tokenPairAddress ?? ADDRESS_ZERO,
              weight: 100,
            },
          ],
        },
      ],
    ),
  ];
}

export interface AddMarketOptions {
  additionalConverters?: BaseContract[];
  skipAmountValidation?: boolean;
  decimals?: number;
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
  options: AddMarketOptions = {},
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
    ZERO_BI,
    options,
  );

  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomiteMargin: core.dolomiteMargin },
      'dolomiteMargin',
      'ownerSetGlobalOperator',
      [factory.address, true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(core, { factory }, 'factory', 'ownerInitialize', [
      [unwrapper.address, wrapper.address, ...(options.additionalConverters ?? []).map((c) => c.address)],
    ]),
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

export async function prettyPrintEncodeAddAsyncIsolationModeMarket<T extends NetworkType>(
  core: CoreProtocolType<T>,
  factory: IIsolationModeVaultFactory,
  oracle: IDolomitePriceOracle,
  unwrapper: IIsolationModeUnwrapperTraderV2,
  wrapper: IIsolationModeWrapperTraderV2,
  handlerRegistry: HandlerRegistry,
  marketId: BigNumberish,
  targetCollateralization: TargetCollateralization,
  targetLiquidationPremium: TargetLiquidationPenalty,
  maxSupplyWei: BigNumberish,
  options: AddMarketOptions = {},
): Promise<EncodedTransaction[]> {
  const transactions: EncodedTransaction[] = await prettyPrintEncodeAddIsolationModeMarket(
    core,
    IIsolationModeVaultFactory__factory.connect(factory.address, factory.signer),
    oracle,
    unwrapper,
    wrapper,
    marketId,
    targetCollateralization,
    targetLiquidationPremium,
    maxSupplyWei,
    options,
  );

  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { liquidatorAssetRegistry: core.liquidatorAssetRegistry },
      'liquidatorAssetRegistry',
      'ownerAddLiquidatorToAssetWhitelist',
      [marketId, core.freezableLiquidatorProxy.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { handlerRegistry },
      'handlerRegistry',
      'ownerSetUnwrapperByToken',
      [factory.address, unwrapper.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(core, { handlerRegistry }, 'handlerRegistry', 'ownerSetWrapperByToken', [
      factory.address,
      wrapper.address,
    ]),
  );

  return transactions;
}

export async function prettyPrintEncodeAddGlvMarket(
  core: CoreProtocolArbitrumOne,
  factory: IGlvIsolationModeVaultFactory,
  pairedGmToken: GmToken,
  unwrapper: IIsolationModeUnwrapperTraderV2,
  wrapper: IIsolationModeWrapperTraderV2,
  handlerRegistry: HandlerRegistry,
  marketId: BigNumberish,
  targetCollateralization: TargetCollateralization,
  targetLiquidationPremium: TargetLiquidationPenalty,
  maxSupplyWei: BigNumberish,
  options: AddMarketOptions = {},
): Promise<EncodedTransaction[]> {
  return [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { glvRegistry: core.glvEcosystem.live.registry },
      'glvRegistry',
      'ownerSetGlvTokenToGmMarketForDeposit',
      [await factory.UNDERLYING_TOKEN(), pairedGmToken.marketToken.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { glvRegistry: core.glvEcosystem.live.registry },
      'glvRegistry',
      'ownerSetGlvTokenToGmMarketForWithdrawal',
      [await factory.UNDERLYING_TOKEN(), pairedGmToken.marketToken.address],
    ),
    ...(await prettyPrintEncodeAddAsyncIsolationModeMarket(
      core,
      factory,
      core.oracleAggregatorV2,
      unwrapper,
      wrapper,
      handlerRegistry,
      marketId,
      targetCollateralization,
      targetLiquidationPremium,
      maxSupplyWei,
      options,
    )),
  ];
}

export async function prettyPrintEncodeAddGmxV2Market(
  core: CoreProtocolArbitrumOne,
  factory: IGmxV2IsolationModeVaultFactory,
  unwrapper: IIsolationModeUnwrapperTraderV2,
  wrapper: IIsolationModeWrapperTraderV2,
  handlerRegistry: HandlerRegistry,
  marketId: BigNumberish,
  targetCollateralization: TargetCollateralization,
  targetLiquidationPremium: TargetLiquidationPenalty,
  maxSupplyWei: BigNumberish,
  options: AddMarketOptions = {},
): Promise<EncodedTransaction[]> {
  return [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { gmxV2PriceOracle: core.gmxV2Ecosystem.live.priceOracle },
      'gmxV2PriceOracle',
      'ownerSetMarketToken',
      [factory.address, true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { oracleAggregatorV2: core.oracleAggregatorV2 },
      'oracleAggregatorV2',
      'ownerInsertOrUpdateToken',
      [
        {
          decimals: await IERC20Metadata__factory.connect(factory.address, factory.signer).decimals(),
          token: factory.address,
          oracleInfos: [
            {
              oracle: core.gmxV2Ecosystem.live.priceOracle.address,
              weight: 100,
              tokenPair: ADDRESS_ZERO,
            },
          ],
        },
      ],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { gmxV2Registry: core.gmxV2Ecosystem.live.registry },
      'gmxV2Registry',
      'ownerSetGmxMarketToIndexToken',
      [await factory.UNDERLYING_TOKEN(), await factory.INDEX_TOKEN()],
    ),
    ...(await prettyPrintEncodeAddAsyncIsolationModeMarket(
      core,
      factory,
      core.oracleAggregatorV2,
      unwrapper,
      wrapper,
      handlerRegistry,
      marketId,
      targetCollateralization,
      targetLiquidationPremium,
      maxSupplyWei,
      options,
    )),
  ];
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
  options: AddMarketOptions = {},
): Promise<EncodedTransaction[]> {
  if (!options.skipAmountValidation && !(await isValidAmount(token, maxSupplyWei))) {
    const name = await getFormattedTokenName(core, token.address);
    return Promise.reject(new Error(`Invalid max supply wei for ${name}, found: ${maxSupplyWei.toString()}`));
  }
  if (!options.skipAmountValidation && !(await isValidAmount(token, maxBorrowWei))) {
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

export async function prettyPrintSetGlobalOperator<T extends NetworkType>(
  core: CoreProtocolType<T>,
  operator: { address: string },
  isOperator: boolean,
): Promise<EncodedTransaction> {
  return prettyPrintEncodedDataWithTypeSafety(
    core,
    { dolomiteMargin: core.dolomiteMargin },
    'dolomiteMargin',
    'ownerSetGlobalOperator',
    [operator.address, isOperator],
  );
}

export function writeDeploymentFile(fileContent: Record<string, Record<ChainId, any>>) {
  writeFile(DEPLOYMENT_FILE_NAME, JSON.stringify(sortFile(fileContent), null, 2));
}

export function createFolder(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
}

export function writeFile(fileName: string, fileContent: string) {
  fs.writeFileSync(fileName, fileContent, { encoding: 'utf8', flag: 'w' });
}

async function isValidAmount(token: IERC20, amount: BigNumberish) {
  const realAmount = BigNumber.from(amount);
  if (realAmount.eq(ZERO_BI) || realAmount.eq('1')) {
    return true;
  }

  const decimals = await IERC20Metadata__factory.connect(token.address, token.signer).decimals();
  const scale = TEN_BI.pow(decimals);
  return realAmount.div(scale).gt(ONE_BI) && realAmount.div(scale).lte(100_000_000);
}
