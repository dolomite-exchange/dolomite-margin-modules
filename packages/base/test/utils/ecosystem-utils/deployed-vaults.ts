import { Network, NetworkType } from 'packages/base/src/utils/no-deps-constants';
import { DolomiteMargin } from '../dolomite';
import { CoreProtocolSetupConfig, CoreProtocolType, getMaxDeploymentVersionAddressByDeploymentKey } from '../setup';
import { DeployedVaultInformation, IsolationModeVaultType, marketToIsolationModeVaultInfoArbitrumOne } from 'packages/deployment/src/deploy/isolation-mode/arbitrum';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';
import { IIsolationModeVaultFactory__factory, IIsolationModeVaultFactoryOld__factory } from 'packages/base/src/types';
import { CoreProtocolAbstract } from '../core-protocols/core-protocol-abstract';
import { deployContractAndSave, EncodedTransaction, getCurrentVersionNumberByDeploymentKey, prettyPrintEncodedDataWithTypeSafety } from 'packages/deployment/src/utils/deploy-utils';

export class DeployedVault {
  public contractName: string;
  public contractRenameWithoutVersion: string;
  public constructorParams: any[];
  public implementationAddress: string;
  public libraries: Record<string, string>;
  public currentVersionNumber: number;
  public marketId: number;
  public vaultType: IsolationModeVaultType;

  constructor(marketId: number, info: DeployedVaultInformation) {
    this.contractName = info.contractName;
    this.contractRenameWithoutVersion = info.contractRenameWithoutVersion;
    this.implementationAddress = info.implementationAddress;
    this.constructorParams = info.constructorParams;
    this.libraries = this.populateLibraryAddresses(info.libraries);
    this.currentVersionNumber = getCurrentVersionNumberByDeploymentKey(this.contractRenameWithoutVersion);
    this.marketId = marketId;
    this.vaultType = info.vaultType;
  }

  private populateLibraryAddresses(libraries: string[]) {
    const libraryAddresses: Record<string, string> = {};
    for (const library of libraries) {
      libraryAddresses[library] = getMaxDeploymentVersionAddressByDeploymentKey(library, Network.ArbitrumOne);
    }
    return libraryAddresses;
  }

  public async deployNewVaultAndEncodeUpgradeTransaction<T extends NetworkType>(
    core: CoreProtocolType<T>,
    newLibraries: Record<string, string>,
  ): Promise<EncodedTransaction> {
    await this.deployNewVaultImplementation(newLibraries);
    return this.encodeSetUserVaultImplementation(core);
  }

  public async deployNewVaultImplementation<T extends NetworkType>(
    newLibraries: Record<string, string>,
  ): Promise<string> {
    Object.assign(this.libraries, newLibraries);

    const vaultAddress = await deployContractAndSave(
      this.contractName,
      this.constructorParams,
      `${this.contractRenameWithoutVersion}V${(this.currentVersionNumber + 1).toString()}`,
      this.libraries
    );
    this.implementationAddress = vaultAddress;
    return vaultAddress;
  }

  public async encodeSetUserVaultImplementation<T extends NetworkType>(core: CoreProtocolType<T>): Promise<EncodedTransaction> {
    if (this.contractName === 'GLPIsolationModeTokenVaultV2') {
      const factory = IIsolationModeVaultFactoryOld__factory.connect(
        await core.dolomiteMargin.getMarketTokenAddress(this.marketId),
        core.governance
      );
      return prettyPrintEncodedDataWithTypeSafety(
        core,
        { factory },
        'factory',
        'setUserVaultImplementation',
        [this.implementationAddress],
      );
    } else {
      const factory = IIsolationModeVaultFactory__factory.connect(
        await core.dolomiteMargin.getMarketTokenAddress(this.marketId),
        core.governance
      );
      return prettyPrintEncodedDataWithTypeSafety(
        core,
        { factory },
        'factory',
        'ownerSetUserVaultImplementation',
        [this.implementationAddress],
      );
    }
  }
}

export async function getDeployedVaults<T extends NetworkType>(
  config: CoreProtocolSetupConfig<T>,
  dolomiteMargin: DolomiteMargin<T>,
  governance: SignerWithAddressWithSafety,
): Promise<DeployedVault[]> {
  const deployedVaults: DeployedVault[] = [];
  if (config.network === Network.ArbitrumOne) {
    Object.entries(marketToIsolationModeVaultInfoArbitrumOne).forEach(([marketId, params]) => {
      deployedVaults.push(new DeployedVault(Number(marketId), params));
    });
  }

  // @todo Add validation code
  return deployedVaults;
}

export function filterVaultsByType(deployedVaultsMap: Record<number, DeployedVault>, vaultType: IsolationModeVaultType) {
  return Object.values(deployedVaultsMap).filter((vault) => vault.vaultType === vaultType);
}
