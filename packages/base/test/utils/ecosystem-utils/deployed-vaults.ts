import { marketToIsolationModeVaultInfoBase } from '@dolomite-exchange/modules-deployments/src/deploy/isolation-mode/base';
import { marketToIsolationModeVaultInfoBotanix } from '@dolomite-exchange/modules-deployments/src/deploy/isolation-mode/botanix';
import { marketToIsolationModeVaultInfoEthereum } from '@dolomite-exchange/modules-deployments/src/deploy/isolation-mode/ethereum';
import { marketToIsolationModeVaultInfoInk } from '@dolomite-exchange/modules-deployments/src/deploy/isolation-mode/ink';
import { marketToIsolationModeVaultInfoPolygonZkEvm } from '@dolomite-exchange/modules-deployments/src/deploy/isolation-mode/polygon-zkevm';
import { marketToIsolationModeVaultInfoSuperSeed } from '@dolomite-exchange/modules-deployments/src/deploy/isolation-mode/super-seed';
import { marketToIsolationModeVaultInfoXLayer } from '@dolomite-exchange/modules-deployments/src/deploy/isolation-mode/xlayer';
import { EncodedTransaction } from '@dolomite-exchange/modules-deployments/src/utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '@dolomite-exchange/modules-deployments/src/utils/encoding/base-encoder-utils';
import { BigNumber } from 'ethers';
import { network as hardhatNetwork } from 'hardhat';
import {
  IIsolationModeVaultFactory,
  IIsolationModeVaultFactory__factory,
  IIsolationModeVaultFactoryOld,
  IIsolationModeVaultFactoryOld__factory,
} from 'packages/base/src/types';
import { DFS_GLP_MAP } from 'packages/base/src/utils/constants';
import { DolomiteNetwork, Network } from 'packages/base/src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';
import { marketToIsolationModeVaultInfoArbitrumOne } from 'packages/deployment/src/deploy/isolation-mode/arbitrum';
import { marketToIsolationModeVaultInfoBerachain } from 'packages/deployment/src/deploy/isolation-mode/berachain';
import {
  DeployedVaultInformation,
  IsolationModeVaultType,
} from 'packages/deployment/src/deploy/isolation-mode/isolation-mode-helpers';
import { marketToIsolationModeVaultInfoMantle } from 'packages/deployment/src/deploy/isolation-mode/mantle';
import {
  deployContractAndSave,
  getMaxDeploymentVersionNumberByDeploymentKey,
} from 'packages/deployment/src/utils/deploy-utils';
import { DolomiteMargin, isIsolationModeByTokenAddress } from '../dolomite';
import { getRealLatestBlockNumber } from '../index';
import { CoreProtocolSetupConfig, CoreProtocolType, getMaxDeploymentVersionAddressByDeploymentKey } from '../setup';

export class DeployedVault {
  public contractName: string;
  public contractRenameWithoutVersion: string;
  public constructorParams: any[];
  public implementationAddress: string;
  public libraries: Record<string, string>;
  public currentVersionNumber: number;
  public marketId: number;
  public factory: IIsolationModeVaultFactory | IIsolationModeVaultFactoryOld;
  public vaultType: IsolationModeVaultType;
  public isUpgradeable: boolean;
  public isDepositWithdrawalRouterEnabled: boolean;

  constructor(
    marketId: number,
    factory: IIsolationModeVaultFactory | IIsolationModeVaultFactoryOld,
    info: DeployedVaultInformation,
    network: Network,
  ) {
    this.contractName = info.contractName;
    this.contractRenameWithoutVersion = info.contractRenameWithoutVersion;
    this.implementationAddress = info.implementationAddress;
    this.constructorParams = info.constructorParams;
    this.libraries = this.populateLibraryAddresses(info.libraries, network);
    this.currentVersionNumber = getMaxDeploymentVersionNumberByDeploymentKey(
      this.contractRenameWithoutVersion,
      info.defaultVersion ?? 1,
    );
    this.marketId = marketId;
    this.factory = factory;
    this.vaultType = info.vaultType;
    this.isUpgradeable = info.vaultType !== IsolationModeVaultType.Migrator;
    this.isDepositWithdrawalRouterEnabled = info.vaultType !== IsolationModeVaultType.BerachainPol;
  }

  public async deployNewVaultAndEncodeUpgradeTransaction<T extends DolomiteNetwork>(
    core: CoreProtocolType<T>,
    newLibraries: Record<string, string>,
    expectedVersionNumber?: number,
  ): Promise<EncodedTransaction> {
    if (!this.isUpgradeable) {
      return Promise.reject(new Error(`Vault with ID ${this.marketId} is not upgradeable`));
    }

    await this.deployNewVaultImplementation(newLibraries, expectedVersionNumber);
    return this.encodeSetUserVaultImplementation(core);
  }

  public async deployNewVaultImplementation(
    newLibraries: Record<string, string>,
    expectedVersionNumber?: number,
  ): Promise<string> {
    if (expectedVersionNumber !== undefined && this.currentVersionNumber + 1 !== expectedVersionNumber) {
      const foundVersion = this.currentVersionNumber + 1;
      return Promise.reject(new Error(`Invalid version, expected ${expectedVersionNumber} but found ${foundVersion}`));
    }
    if (!this.isUpgradeable) {
      return Promise.reject(new Error(`Vault with ID ${this.marketId} is not upgradeable`));
    }

    this.libraries = {
      ...this.libraries,
      ...newLibraries,
    };

    const vaultAddress = await deployContractAndSave(
      this.contractName,
      this.constructorParams,
      `${this.contractRenameWithoutVersion}V${this.currentVersionNumber + 1}`,
      this.libraries,
    );
    this.implementationAddress = vaultAddress;
    return vaultAddress;
  }

  public async encodeSetTrustedTokenConverter<T extends DolomiteNetwork>(
    core: CoreProtocolType<T>,
    tokenConverterAddress: string,
    isTrustedConverter: boolean,
  ): Promise<EncodedTransaction> {
    if (this.contractName === 'GLPIsolationModeTokenVaultV2') {
      const factory = IIsolationModeVaultFactoryOld__factory.connect(
        await core.dolomiteMargin.getMarketTokenAddress(this.marketId),
        core.governance,
      );
      return prettyPrintEncodedDataWithTypeSafety(core, { factory }, 'factory', 'setIsTokenConverterTrusted', [
        tokenConverterAddress,
        isTrustedConverter,
      ]);
    }

    const factory = IIsolationModeVaultFactory__factory.connect(
      await core.dolomiteMargin.getMarketTokenAddress(this.marketId),
      core.governance,
    );
    return prettyPrintEncodedDataWithTypeSafety(core, { factory }, 'factory', 'ownerSetIsTokenConverterTrusted', [
      tokenConverterAddress,
      isTrustedConverter,
    ]);
  }

  public async encodeSetUserVaultImplementation<T extends DolomiteNetwork>(
    core: CoreProtocolType<T>,
  ): Promise<EncodedTransaction> {
    if (this.contractName === 'GLPIsolationModeTokenVaultV2') {
      const factory = IIsolationModeVaultFactoryOld__factory.connect(
        await core.dolomiteMargin.getMarketTokenAddress(this.marketId),
        core.governance,
      );
      return prettyPrintEncodedDataWithTypeSafety(core, { factory }, 'factory', 'setUserVaultImplementation', [
        this.implementationAddress,
      ]);
    }

    const factory = IIsolationModeVaultFactory__factory.connect(
      await core.dolomiteMargin.getMarketTokenAddress(this.marketId),
      core.governance,
    );
    return prettyPrintEncodedDataWithTypeSafety(core, { factory }, 'factory', 'ownerSetUserVaultImplementation', [
      this.implementationAddress,
    ]);
  }

  public async encodeSetUserVaultImplementationWithAddress<T extends DolomiteNetwork>(
    core: CoreProtocolType<T>,
    newImplementation: string,
  ): Promise<EncodedTransaction> {
    if (this.contractName === 'GLPIsolationModeTokenVaultV2') {
      const factory = IIsolationModeVaultFactoryOld__factory.connect(
        await core.dolomiteMargin.getMarketTokenAddress(this.marketId),
        core.governance,
      );
      return prettyPrintEncodedDataWithTypeSafety(core, { factory }, 'factory', 'setUserVaultImplementation', [
        newImplementation,
      ]);
    }
    const factory = IIsolationModeVaultFactory__factory.connect(
      await core.dolomiteMargin.getMarketTokenAddress(this.marketId),
      core.governance,
    );
    return prettyPrintEncodedDataWithTypeSafety(core, { factory }, 'factory', 'ownerSetUserVaultImplementation', [
      newImplementation
    ]);
  }

  private populateLibraryAddresses(libraries: string[], network: Network) {
    const libraryAddresses: Record<string, string> = {};
    for (const library of libraries) {
      libraryAddresses[library] = getMaxDeploymentVersionAddressByDeploymentKey(library, network);
    }
    return libraryAddresses;
  }
}

export async function getDeployedVaults<T extends DolomiteNetwork>(
  config: CoreProtocolSetupConfig<T>,
  dolomiteMargin: DolomiteMargin<T>,
  governance: SignerWithAddressWithSafety,
): Promise<DeployedVault[]> {
  let skippedMarkets = 0;
  const deployedVaults: DeployedVault[] = [];
  if (config.network === Network.ArbitrumOne) {
    skippedMarkets = await initializeVaults(
      config,
      governance,
      marketToIsolationModeVaultInfoArbitrumOne,
      deployedVaults,
    );
  } else if (config.network === Network.Base) {
    skippedMarkets = await initializeVaults(config, governance, marketToIsolationModeVaultInfoBase, deployedVaults);
  } else if (config.network === Network.Berachain) {
    skippedMarkets = await initializeVaults(
      config,
      governance,
      marketToIsolationModeVaultInfoBerachain,
      deployedVaults,
    );
  } else if (config.network === Network.Botanix) {
    skippedMarkets = await initializeVaults(config, governance, marketToIsolationModeVaultInfoBotanix, deployedVaults);
  } else if (config.network === Network.Ethereum) {
    skippedMarkets = await initializeVaults(config, governance, marketToIsolationModeVaultInfoEthereum, deployedVaults);
  } else if (config.network === Network.Ink) {
    skippedMarkets = await initializeVaults(config, governance, marketToIsolationModeVaultInfoInk, deployedVaults);
  } else if (config.network === Network.Mantle) {
    skippedMarkets = await initializeVaults(config, governance, marketToIsolationModeVaultInfoMantle, deployedVaults);
  } else if (config.network === Network.PolygonZkEvm) {
    skippedMarkets = await initializeVaults(
      config,
      governance,
      marketToIsolationModeVaultInfoPolygonZkEvm,
      deployedVaults,
    );
  } else if (config.network === Network.SuperSeed) {
    skippedMarkets = await initializeVaults(
      config,
      governance,
      marketToIsolationModeVaultInfoSuperSeed,
      deployedVaults,
    );
  } else if (config.network === Network.XLayer) {
    skippedMarkets = await initializeVaults(config, governance, marketToIsolationModeVaultInfoXLayer, deployedVaults);
  } else {
    throw new Error(`Invalid network, found ${config.network}`);
  }

  // Add a 1,000 block buffer
  const realBlockNumber = await getRealLatestBlockNumber(false, config.network);
  if (skippedMarkets > 0 && config.blockNumber < realBlockNumber - 1_000 && hardhatNetwork.name === 'hardhat') {
    console.log('\tForked block detected. Skipping market & vault implementation checks.');
    return deployedVaults;
  }
  if (skippedMarkets > 0) {
    throw new Error('Skipped markets for non-forked blocks...');
  }

  const marketsCount = await dolomiteMargin.getNumMarkets();
  for (let i = 0; i < marketsCount.toNumber(); i++) {
    const tokenAddress = await dolomiteMargin.getMarketTokenAddress(i);
    if (await isIsolationModeByTokenAddress(tokenAddress, dolomiteMargin.provider)) {
      const vault = deployedVaults.find((v) => BigNumber.from(v.marketId).eq(i));
      if (!vault) {
        throw new Error(`Missing isolation mode market ID ${i}: ${tokenAddress}`);
      }

      if (vault.implementationAddress !== (await vault.factory.userVaultImplementation())) {
        // throw new Error(`Invalid vault implementation for market ID ${i}: ${tokenAddress}`);
      }
    }
  }

  return deployedVaults;
}

async function initializeVaults<T extends DolomiteNetwork>(
  config: CoreProtocolSetupConfig<T>,
  governance: SignerWithAddressWithSafety,
  marketToDeployedVaultInformation: Record<number, DeployedVaultInformation>,
  deployedVaults: DeployedVault[],
): Promise<number> {
  let skippedMarkets = 0;
  for (const [marketId, info] of Object.entries(marketToDeployedVaultInformation)) {
    try {
      let factory;
      if (config.network === Network.ArbitrumOne && marketId === DFS_GLP_MAP[Network.ArbitrumOne].marketId.toString()) {
        factory = IIsolationModeVaultFactoryOld__factory.connect(info.tokenAddress, governance);
      } else {
        factory = IIsolationModeVaultFactory__factory.connect(info.tokenAddress, governance);
      }

      deployedVaults.push(new DeployedVault(Number(marketId), factory, info, config.network));
    } catch (e) {
      skippedMarkets += 1;
    }
  }

  return skippedMarkets;
}

export function filterVaultsByType(
  deployedVaultsMap: Record<number, DeployedVault>,
  vaultType: IsolationModeVaultType,
) {
  return Object.values(deployedVaultsMap).filter((vault) => vault.vaultType === vaultType);
}
