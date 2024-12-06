import { Network, NetworkType } from "packages/base/src/utils/no-deps-constants";
import { DolomiteMargin } from "../dolomite";
import { CoreProtocolSetupConfig } from "../setup";
import { marketToIsolationModeVaultInfoArbitrumOne } from "packages/deployment/src/deploy/isolation-mode/arbitrum";
import { createContractWithLibrary, createContractWithLibraryAndArtifact } from "packages/base/src/utils/dolomite-utils";
import { SignerWithAddressWithSafety } from "packages/base/src/utils/SignerWithAddressWithSafety";
import { IERC20Metadata__factory, IIsolationModeVaultFactory__factory, IIsolationModeVaultFactoryOld__factory } from "packages/base/src/types";
import { CoreProtocolAbstract } from "../core-protocols/core-protocol-abstract";
import { createArtifactFromWorkspaceIfNotExists } from "packages/gmx-v2/test/gmx-v2-ecosystem-utils";

// @todo IsolationModeEnum type with GLV, GmxV2, Pt, Yt, BerachainRewardVault, etc.

export interface TokenVaultDeployerParams {
  contractName: string;
  contractRenameWithoutVersion: string;
  implementationAddress: string;
  constructorParams: any[];
  libraries: string[];
  currentVersionNumber: number;
}

export class TokenVaultDeployer {
  public contractName: string;
  public contractRenameWithoutVersion: string;
  public constructorParams: any[];
  public implementationAddress: string;
  public libraries: Record<string, string>;
  public currentVersionNumber: number;
  public marketId: number;

  constructor(params: TokenVaultDeployerParams) {
    this.contractName = params.contractName;
    this.contractRenameWithoutVersion = params.contractRenameWithoutVersion;
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
    // @todo Switch to deployContractAndSave. Shouldn't need artifact then
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

export async function getTokenVaultDeployers<T extends NetworkType>(
  config: CoreProtocolSetupConfig<T>,
  dolomiteMargin: DolomiteMargin<T>,
  governance: SignerWithAddressWithSafety,
): Promise<TokenVaultDeployer[]> {
  const tokenVaultDeployers: TokenVaultDeployer[] = [];
  if (config.network === Network.ArbitrumOne) {
    for (const marketId in marketToIsolationModeVaultInfoArbitrumOne) {
      const params = marketToIsolationModeVaultInfoArbitrumOne[marketId];
      tokenVaultDeployers.push(new TokenVaultDeployer(params));
    }

    Object.entries(marketToIsolationModeVaultInfoArbitrumOne).forEach(([marketId, params]) => {
      tokenVaultDeployers.push(new TokenVaultDeployer(params));
    });
  }

  // @todo Add validation code

  return tokenVaultDeployers;
}