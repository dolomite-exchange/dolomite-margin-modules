import { address } from '@dolomite-exchange/dolomite-margin';
import {
  DolomiteERC4626,
  DolomiteERC4626__factory,
  DolomiteERC4626WithPayable,
  DolomiteERC4626WithPayable__factory,
  IERC20,
  IERC20Metadata__factory,
  IIsolationModeUnwrapperTraderV2,
  IIsolationModeUnwrapperTraderV2__factory,
  IIsolationModeWrapperTraderV2,
  IIsolationModeWrapperTraderV2__factory,
} from '@dolomite-exchange/modules-base/src/types';
import {
  getDolomiteErc4626ProxyConstructorParams,
  getDolomiteErc4626WithPayableProxyConstructorParams,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import {
  ADDRESS_ZERO,
  BYTES_EMPTY,
  BYTES_ZERO,
  DolomiteNetwork,
  Network,
  NETWORK_TO_NETWORK_NAME_MAP,
  NetworkName,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { CoreProtocolType } from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  GmxV2IsolationModeVaultFactory,
  GmxV2IsolationModeVaultFactory__factory,
  IGmxV2IsolationModeUnwrapperTraderV2,
  IGmxV2IsolationModeUnwrapperTraderV2__factory,
  IGmxV2IsolationModeWrapperTraderV2,
  IGmxV2IsolationModeWrapperTraderV2__factory,
} from '@dolomite-exchange/modules-gmx-v2/src/types';
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
import { Wallet } from '@ethersproject/wallet/src.ts';
import { Etherscan } from '@nomicfoundation/hardhat-verify/etherscan';
import { Libraries } from '@nomiclabs/hardhat-ethers/src/types';
import { sleep } from '@openzeppelin/upgrades';
import { BigNumber, BigNumberish, ethers, Signer } from 'ethers';
import { keccak256, parseEther, parseUnits } from 'ethers/lib/utils';
import fs, { readFileSync } from 'fs';
import fsExtra from 'fs-extra';
import hardhat, { artifacts, network } from 'hardhat';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { createContractWithName } from 'packages/base/src/utils/dolomite-utils';
import { GlvToken } from 'packages/base/test/utils/ecosystem-utils/glv';
import { GmToken } from 'packages/base/test/utils/ecosystem-utils/gmx';
import { getPOLIsolationModeVaultFactoryConstructorParams } from 'packages/berachain/src/berachain-constructors';
import {
  IBerachainRewardsRegistry,
  IERC4626__factory,
  POLIsolationModeTokenVaultV1,
  POLIsolationModeUnwrapperTraderV2,
  POLIsolationModeVaultFactory,
  POLIsolationModeVaultFactory__factory,
  POLIsolationModeWrapperTraderV2,
  POLPriceOracleV2,
  POLPriceOracleV2__factory,
} from 'packages/berachain/src/types';
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
import { SignerWithAddressWithSafety } from '../../../base/src/utils/SignerWithAddressWithSafety';
import { impersonate } from '../../../base/test/utils';
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

export async function getDeployerSigner(): Promise<{ signer: Wallet | SignerWithAddressWithSafety; wallet: Wallet }> {
  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY as string);
  let hhUser1: Wallet | SignerWithAddressWithSafety;
  if (hardhat.network.name === 'hardhat') {
    hhUser1 = await impersonate(wallet.address);
  } else {
    hhUser1 = wallet.connect(hardhat.ethers.provider);
  }
  return { wallet, signer: hhUser1 };
}

export async function verifyContract(
  address: string,
  constructorArguments: any[],
  contractName: string,
  libraries: Libraries,
  sleepTimeSeconds: number,
  attempts: number = 0,
): Promise<void> {
  await sleep(sleepTimeSeconds * 1_000);
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
    const factory = await hardhat.ethers.getContractFactoryFromArtifact(artifact, { libraries });
    console.log('\tGot contract info for verification...');

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

    console.log('\tSubmitting verification...');
    console.log('\tConstructor: ', factory.interface.encodeDeploy(constructorArguments).slice(2));
    const { message: guid } = await retryWithTimeout(
      () =>
        instance.verify(
          address,
          JSON.stringify(buildInfo!.input),
          contractName,
          `v${buildInfo!.solcLongVersion}`,
          factory.interface.encodeDeploy(constructorArguments).slice(2),
        ),
      10_000,
      3,
    );

    console.log('\tSubmitted verification. Checking status...');
    await sleep(1_000);
    const verificationStatus = await retryWithTimeout(() => instance.getVerificationStatus(guid), 10_000, 3);
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
      const sleepTimeSeconds = 3_000;
      await verifyContract(address, constructorArguments, contractName, libraries, sleepTimeSeconds, attempts + 1);
    } else {
      console.error('Error with verifying:', e);
      return Promise.reject(e);
    }
  }
}

async function retryWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number, retries: number): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await Promise.race([
        fn(),
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout exceeded')), timeoutMs)),
      ]);
    } catch (err: any) {
      const message = err.message ?? '';
      console.warn(`Attempt ${attempt + 1} failed:`, message || err);
      console.log('');

      if (attempt + 1 === retries) {
        return Promise.reject(err);
      }
      if (message.includes('does not have bytecode')) {
        await sleep(timeoutMs);
      }
    }
  }

  return Promise.reject(new Error('All retries failed'));
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
    skipRenameUpgradeableContracts?: boolean;
    nonce?: number;
    gasLimit?: BigNumberish;
    gasPrice?: BigNumberish;
    maxPriorityFeePerGas?: BigNumberish;
    type?: number;
    skipArtifactInitialization?: boolean;
    signer?: Signer;
  } = {},
  attempts: number = 0,
): Promise<address> {
  if (attempts === 3) {
    return Promise.reject(new Error(`\tCould not deploy after ${attempts} attempts!`));
  }

  const invalidNames = ['RegistryProxy', 'UpgradeableProxy'];
  if (invalidNames.includes(contractName) && !contractRename) {
    if (!options.skipRenameUpgradeableContracts) {
      console.error('Cannot deploy an upgradeable contract with an invalid name:', invalidNames);
    }
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
    if (!contract.isVerified || process.env.FORCE_VERIFY === 'true') {
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
    const deployer = process.env.DEPLOYER_PRIVATE_KEY
      ? new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, hardhat.ethers.provider)
      : undefined;
    const signer = options.signer ?? deployer ?? hardhat.ethers.provider.getSigner(0);
    if (nonce === undefined) {
      nonce = await hardhat.ethers.provider.getTransactionCount(await signer.getAddress(), 'pending');
    }

    const gasPrice = options.gasPrice ?? hardhat.userConfig.networks![networkName]?.gasPrice;
    const opts = {
      nonce: options.nonce === undefined ? nonce : options.nonce,
      gasPrice: gasPrice ?? undefined,
      gasLimit: options.gasLimit,
      maxPriorityFeePerGas: options.maxPriorityFeePerGas,
      type: options.type,
    };
    if (network.name === NetworkName.Ethereum) {
      const block = await signer.provider?.getBlock('latest');
      opts.gasPrice = undefined;
      opts.maxPriorityFeePerGas = block?.baseFeePerGas?.div(10) ?? parseUnits('0.1', 'gwei');
      opts.type = 2;
    }

    if (contractName === 'CREATE3Factory') {
      const result = await createContractWithName('CREATE3Factory', args, opts, signer);
      contract = {
        address: result.address,
        transactionHash: result.deployTransaction.hash,
      };
    } else {
      const factory = await hardhat.ethers.getContractFactory(contractName, { libraries, signer });
      const transaction = factory.getDeployTransaction(...args);
      const deployer = CREATE3Factory__factory.connect(
        (ModuleDeployments.CREATE3Factory as any)[chainId].address,
        signer,
      );
      const salt = keccak256(ethers.utils.defaultAbiCoder.encode(['string'], [usedContractName]));
      const contractAddress = await deployer.getDeployed(await signer.getAddress(), salt);
      const code = await hardhat.ethers.provider.getCode(contractAddress);
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
      const signer = hardhat.ethers.provider.getSigner(0);
      nonce = await hardhat.ethers.provider.getTransactionCount(await signer.getAddress(), 'pending');
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
  console.log();

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
    const receipt = await hardhat.ethers.provider.getTransactionReceipt(deploymentTransactionHash);
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

export async function deployPendlePtSystem<T extends DolomiteNetwork>(
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

export interface BerachainPOLSystem {
  factory: POLIsolationModeVaultFactory;
  oracle: POLPriceOracleV2;
  unwrapper: IIsolationModeUnwrapperTraderV2;
  wrapper: IIsolationModeWrapperTraderV2;
}

export async function deployBerachainPOLSystem<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  registry: IBerachainRewardsRegistry,
  dToken: DolomiteERC4626,
  polName: string,
  userVaultImplementation: POLIsolationModeTokenVaultV1,
  polUnwrapperImplementation: POLIsolationModeUnwrapperTraderV2,
  polWrapperImplementation: POLIsolationModeWrapperTraderV2,
): Promise<BerachainPOLSystem> {
  if (core.network !== Network.Berachain) {
    return Promise.reject(new Error('Core protocol is not Berachain'));
  }
  const marketId = await dToken.marketId();
  if (!marketId || marketId.isNegative()) {
    return Promise.reject(new Error('Invalid dToken'));
  }

  const underlyingAddress = await IERC4626__factory.connect(dToken.address, core.hhUser1).asset();
  const underlyingSymbol = await IERC4626__factory.connect(underlyingAddress, core.hhUser1).symbol();
  console.log(`\tReal symbol for POL name: ${underlyingSymbol}`);

  const factoryAddress = await deployContractAndSave(
    'POLIsolationModeVaultFactory',
    getPOLIsolationModeVaultFactoryConstructorParams(
      core,
      underlyingSymbol,
      registry,
      dToken,
      userVaultImplementation,
      [],
      [],
    ),
    `${polName}IsolationModeVaultFactory`,
  );
  const factory = POLIsolationModeVaultFactory__factory.connect(factoryAddress, core.governance);

  const calldata = await polUnwrapperImplementation.populateTransaction.initialize(factory.address);
  const unwrapperProxyAddress = await deployContractAndSave(
    'POLIsolationModeUnwrapperUpgradeableProxy',
    [registry.address, calldata.data!],
    `${polName}IsolationModeUnwrapperUpgradeableProxy`,
  );
  const unwrapper = IIsolationModeUnwrapperTraderV2__factory.connect(unwrapperProxyAddress, core.governance);

  const wrapperCalldata = await polWrapperImplementation.populateTransaction.initialize(factory.address);
  const wrapperProxyAddress = await deployContractAndSave(
    'POLIsolationModeWrapperUpgradeableProxy',
    [registry.address, wrapperCalldata.data!],
    `${polName}IsolationModeWrapperUpgradeableProxy`,
  );
  const wrapper = IIsolationModeWrapperTraderV2__factory.connect(wrapperProxyAddress, core.governance);

  const oracleAddress = await deployContractAndSave(
    'POLPriceOracleV2',
    [factory.address, core.dolomiteMargin.address],
    `${polName}PriceOracleV2`,
  );
  const oracle = POLPriceOracleV2__factory.connect(oracleAddress, core.governance);

  return {
    factory,
    unwrapper,
    wrapper,
    oracle,
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
  options: { skipDeploymentAddressCheck: boolean } = { skipDeploymentAddressCheck: false },
): Promise<DolomiteERC4626> {
  const contractRename = `Dolomite${tokenName}4626Token`;
  const address = await deployContractAndSave(
    'RegistryProxy',
    await getDolomiteErc4626ProxyConstructorParams(core, marketId),
    contractRename,
  );
  const previousDeployments = (ModuleDeployments as any)[contractRename];
  if (previousDeployments && Object.values(previousDeployments).length > 0) {
    const firstDeployment = (Object.values(previousDeployments) as any[])[0].address;
    if (firstDeployment !== address && !options.skipDeploymentAddressCheck) {
      return Promise.reject(
        new Error(
          `Addresses does not match expected name for ${tokenName}. Expected: ${firstDeployment} Actual: ${address}`,
        ),
      );
    }
  }

  const vaultToken = DolomiteERC4626__factory.connect(address, core.hhUser1);
  const symbol = await vaultToken.symbol();
  console.log(`\tCheck the supplied symbol vs the real symbol of the market: ${tokenName} // ${symbol}`);

  return vaultToken;
}

export async function deployDolomiteErc4626WithPayableToken(
  core: CoreProtocolType<any>,
  tokenName: string,
  marketId: BigNumberish,
): Promise<DolomiteERC4626WithPayable> {
  const address = await deployContractAndSave(
    'RegistryProxy',
    await getDolomiteErc4626WithPayableProxyConstructorParams(core, marketId),
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

  if (!(process.env.SKIP_VERIFICATION === 'true') && !contract.isVerified) {
    const slowNetworks: Record<string, number | undefined> = {
      [Network.Ethereum]: 15,
      [Network.Ink]: 10,
    };
    const sleepTimeSeconds = slowNetworks[chainId] ?? 5;
    console.log(
      `\tSleeping for ${sleepTimeSeconds}s to wait for the transaction to be indexed by the block explorer...`,
    );
    const artifact = await artifacts.readArtifact(contractName);
    await verifyContract(
      contract.address,
      [...args],
      `${artifact.sourceName}:${contractName}`,
      libraries,
      sleepTimeSeconds,
    );
    file[contractRename][chainId].isVerified = true;
    writeDeploymentFile(file);
  } else {
    console.log('\tSkipping Etherscan verification...');
  }
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
