import { Network, NetworkType } from "packages/base/src/utils/no-deps-constants";
import { DolomiteMargin } from "../dolomite";
import { CoreProtocolSetupConfig } from "../setup";
import { marketToIsolationModeVaultInfoArbitrumOne } from "packages/deployment/src/deploy/isolation-mode/arbitrum";
import { createContractWithLibrary, createContractWithLibraryAndArtifact } from "packages/base/src/utils/dolomite-utils";
import { SignerWithAddressWithSafety } from "packages/base/src/utils/SignerWithAddressWithSafety";
import { IIsolationModeVaultFactory__factory, IIsolationModeVaultFactoryOld__factory } from "packages/base/src/types";
import { CoreProtocolAbstract } from "../core-protocols/core-protocol-abstract";
import { createArtifactFromWorkspaceIfNotExists } from "packages/gmx-v2/test/gmx-v2-ecosystem-utils";

export interface TokenVaultDeployerParams {
  contractName: string;
  implementationAddress: string;
  constructorParams: any[];
  libraries: Record<string, string>;
  currentVersionNumber: number;
  marketId: number;
}

export class TokenVaultDeployer {
  public contractName: string;
  public constructorParams: any[];
  public implementationAddress: string;
  private contractRename: string | undefined;
  public libraries: Record<string, string>;
  public currentVersionNumber: number;
  public marketId: number;

  constructor(params: TokenVaultDeployerParams) {
    this.contractName = params.contractName;
    this.implementationAddress = params.implementationAddress;
    this.constructorParams = params.constructorParams;
    this.libraries = params.libraries;
    this.currentVersionNumber = params.currentVersionNumber;
    this.marketId = params.marketId;
  }

  public async upgradeVaultImplementation<T extends NetworkType>(
    core: CoreProtocolAbstract<T>,
    newLibraries: Record<string, string>,
  ): Promise<string> {
    // Update libraries and deploy new vault
    for (const library in newLibraries) {
      if (library in this.libraries) {
        this.libraries[library] = newLibraries[library];
      } else {
        this.libraries[library] = newLibraries[library];
      }
    }
    const artifact = await createArtifactFromWorkspaceIfNotExists(this.contractName);
    const vault = await createContractWithLibraryAndArtifact(
      artifact,
      this.libraries,
      this.constructorParams,
    );

    // Update user vault implementation
    if (this.contractName === 'GLPIsolationModeTokenVaultV2') {
      const factory = IIsolationModeVaultFactoryOld__factory.connect(
        await core.dolomiteMargin.getMarketTokenAddress(this.marketId),
        core.governance
      );
      await factory.setUserVaultImplementation(vault.address);
    } else {
      const factory = IIsolationModeVaultFactory__factory.connect(
        await core.dolomiteMargin.getMarketTokenAddress(this.marketId),
        core.governance
      );
      await factory.ownerSetUserVaultImplementation(vault.address);
    }

    return vault.address;
  }
}

export function getTokenVaultDeployers<T extends NetworkType>(
  config: CoreProtocolSetupConfig<T>,
  dolomiteMargin: DolomiteMargin<T>
): TokenVaultDeployer[] {
  const tokenVaultDeployers: TokenVaultDeployer[] = [];
  if (config.network === Network.ArbitrumOne) {
    for (const marketId in marketToIsolationModeVaultInfoArbitrumOne) {
      const params = marketToIsolationModeVaultInfoArbitrumOne[marketId];
      tokenVaultDeployers.push(new TokenVaultDeployer(params));
    }
  }

  return tokenVaultDeployers;
}