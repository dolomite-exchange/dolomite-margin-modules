import { BigNumber } from 'ethers';
import {
  IIsolationModeVaultFactory,
  IIsolationModeVaultFactory__factory,
  IIsolationModeVaultFactoryOld,
  IIsolationModeVaultFactoryOld__factory,
} from 'packages/base/src/types';
import { DFS_GLP_MAP } from 'packages/base/src/utils/constants';
import { Network, NetworkType } from 'packages/base/src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';
import { marketToIsolationModeVaultInfoArbitrumOne } from 'packages/deployment/src/deploy/isolation-mode/arbitrum';
import {
  DeployedVaultInformation,
  IsolationModeVaultType,
} from 'packages/deployment/src/deploy/isolation-mode/isolation-mode-helpers';
import { marketToIsolationModeVaultInfoMantle } from 'packages/deployment/src/deploy/isolation-mode/mantle';
import {
  deployContractAndSave,
  EncodedTransaction,
  getMaxDeploymentVersionNumberByDeploymentKey,
  prettyPrintEncodedDataWithTypeSafety,
} from 'packages/deployment/src/utils/deploy-utils';
import { DolomiteMargin, isIsolationModeByTokenAddress } from '../dolomite';
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

  constructor(
    marketId: number,
    factory: IIsolationModeVaultFactory | IIsolationModeVaultFactoryOld,
    info: DeployedVaultInformation,
  ) {
    this.contractName = info.contractName;
    this.contractRenameWithoutVersion = info.contractRenameWithoutVersion;
    this.implementationAddress = info.implementationAddress;
    this.constructorParams = info.constructorParams;
    this.libraries = this.populateLibraryAddresses(info.libraries);
    this.currentVersionNumber = getMaxDeploymentVersionNumberByDeploymentKey(this.contractRenameWithoutVersion, 1);
    this.marketId = marketId;
    this.factory = factory;
    this.vaultType = info.vaultType;
  }

  public async deployNewVaultAndEncodeUpgradeTransaction<T extends NetworkType>(
    core: CoreProtocolType<T>,
    newLibraries: Record<string, string>,
  ): Promise<EncodedTransaction> {
    await this.deployNewVaultImplementation(newLibraries);
    return this.encodeSetUserVaultImplementation(core);
  }

  public async deployNewVaultImplementation(newLibraries: Record<string, string>): Promise<string> {
    this.libraries = {
      ...this.libraries,
      ...newLibraries,
    };

    const vaultAddress = await deployContractAndSave(
      this.contractName,
      this.constructorParams,
      `${this.contractRenameWithoutVersion}V${(this.currentVersionNumber + 1).toString()}`,
      this.libraries,
    );
    this.implementationAddress = vaultAddress;
    return vaultAddress;
  }

  public async encodeSetUserVaultImplementation<T extends NetworkType>(
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

  private populateLibraryAddresses(libraries: string[]) {
    const libraryAddresses: Record<string, string> = {};
    for (const library of libraries) {
      libraryAddresses[library] = getMaxDeploymentVersionAddressByDeploymentKey(library, Network.ArbitrumOne);
    }
    return libraryAddresses;
  }
}

export async function getDeployedVaults<T extends NetworkType>(
  config: CoreProtocolSetupConfig<T>,
  dolomiteMargin: DolomiteMargin<T>,
  governance: SignerWithAddressWithSafety,
): Promise<DeployedVault[]> {
  const deployedVaults: DeployedVault[] = [];
  if (config.network === Network.ArbitrumOne) {
    for (const [marketId, params] of Object.entries(marketToIsolationModeVaultInfoArbitrumOne)) {
      let factory;
      if (marketId === DFS_GLP_MAP[Network.ArbitrumOne].marketId.toString()) {
        factory = IIsolationModeVaultFactoryOld__factory.connect(
          await dolomiteMargin.getMarketTokenAddress(Number(marketId)),
          governance,
        );
      } else {
        factory = IIsolationModeVaultFactory__factory.connect(
          await dolomiteMargin.getMarketTokenAddress(Number(marketId)),
          governance,
        );
      }

      deployedVaults.push(new DeployedVault(Number(marketId), factory, params));
    }
  } else if (config.network === Network.Mantle) {
    for (const [marketId, params] of Object.entries(marketToIsolationModeVaultInfoMantle)) {
      const factory = IIsolationModeVaultFactory__factory.connect(
        await dolomiteMargin.getMarketTokenAddress(Number(marketId)),
        governance,
      );

      deployedVaults.push(new DeployedVault(Number(marketId), factory, params));
    }
  } else {
    throw new Error(`Invalid network, found ${config.network}`);
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
        throw new Error(`Invalid vault implementation for market ID ${i}: ${tokenAddress}`);
      }
    }
  }

  return deployedVaults;
}

export function filterVaultsByType(
  deployedVaultsMap: Record<number, DeployedVault>,
  vaultType: IsolationModeVaultType,
) {
  return Object.values(deployedVaultsMap).filter((vault) => vault.vaultType === vaultType);
}
