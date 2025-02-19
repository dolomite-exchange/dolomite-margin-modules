import {
  CoreProtocolArbitrumOne,
} from '@dolomite-exchange/modules-base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { BaseContract, type Overrides, type PopulatedTransaction } from 'ethers';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import {
  IERC20Metadata__factory,
  IIsolationModeTokenVaultV1__factory,
  IIsolationModeVaultFactory,
} from 'packages/base/src/types';
import { isArraysEqual } from 'packages/base/src/utils';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import {
  deployContractAndSave,

} from 'packages/deployment/src/utils/deploy-utils';
import {
  doDryRunAndCheckDeployment,
  DryRunOutput,
  EncodedTransaction,
} from 'packages/deployment/src/utils/dry-run-utils';
import getScriptName from 'packages/deployment/src/utils/get-script-name';
import { IGLPIsolationModeVaultFactoryOld } from 'packages/glp/src/types';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';

/**
 * This script encodes the following transactions:
 * - Deploys the new event emitter implementation
 * - Deploys the new dolomite registry
 * - Sets the allowable function selectors on the registry
 * - Deploys the new IsolationModeTokenVault library
 * - Sets the new token vault for all token vaults
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const eventEmitterImplementationAddress = await deployContractAndSave(
    'EventEmitterRegistry',
    [],
    'EventEmitterRegistryImplementationV5',
  );
  const dolomiteRegistryImplementationAddress = await deployContractAndSave(
    'DolomiteRegistryImplementation',
    [],
    'DolomiteRegistryImplementationV11',
  );

  const safeDelegateCallLibAddress = await deployContractAndSave('SafeDelegateCallLib', [], 'SafeDelegateCallLibV1');
  const actionsImplAddress = await deployContractAndSave(
    'IsolationModeTokenVaultV1ActionsImpl',
    [],
    'IsolationModeTokenVaultV1ActionsImplV8',
    { SafeDelegateCallLib: safeDelegateCallLibAddress },
  );
  const actionsLibMap = { IsolationModeTokenVaultV1ActionsImpl: actionsImplAddress };

  const glpImplementationAddress = await deployContractAndSave(
    'GLPIsolationModeTokenVaultV2',
    [],
    'GLPIsolationModeTokenVaultV6',
    actionsLibMap,
  );
  const plvGlpImplementationAddress = await deployContractAndSave(
    'PlutusVaultGLPIsolationModeTokenVaultV1',
    [],
    'PlutusVaultGLPIsolationModeTokenVaultV5',
    actionsLibMap,
  );
  const ptGlpMar2024ImplementationAddress = await deployContractAndSave(
    'PendlePtGLPMar2024IsolationModeTokenVaultV1',
    [],
    'PendlePtGLPMar2024IsolationModeTokenVaultV5',
    actionsLibMap,
  );
  const ptREthJun2024ImplementationAddress = await deployContractAndSave(
    'PendlePtIsolationModeTokenVaultV1',
    [],
    'PendlePtREthJun2025IsolationModeTokenVaultV5',
    actionsLibMap,
  );
  const ptWstEthJun2024ImplementationAddress = await deployContractAndSave(
    'PendlePtIsolationModeTokenVaultV1',
    [],
    'PendlePtWstEthJun2024IsolationModeTokenVaultV5',
    actionsLibMap,
  );
  const ptWstEthJun2025ImplementationAddress = await deployContractAndSave(
    'PendlePtIsolationModeTokenVaultV1',
    [],
    'PendlePtWstEthJun2025IsolationModeTokenVaultV5',
    actionsLibMap,
  );
  const arbImplementationAddress = await deployContractAndSave(
    'ARBIsolationModeTokenVaultV1',
    [],
    'ARBIsolationModeTokenVaultV7',
    actionsLibMap,
  );
  const gmxImplementationAddress = await deployContractAndSave(
    'GMXIsolationModeTokenVaultV1',
    [],
    'GMXIsolationModeTokenVaultV7',
    actionsLibMap,
  );
  const ptWeEthApr2024ImplementationAddress = await deployContractAndSave(
    'PendlePtIsolationModeTokenVaultV1',
    [],
    'PendlePtWeETHApr2024IsolationModeTokenVaultV2',
    actionsLibMap,
  );
  const ptEzEthJun2024ImplementationAddress = await deployContractAndSave(
    'PendlePtIsolationModeTokenVaultV1',
    [],
    'PendlePtEzETHJun2024IsolationModeTokenVaultV2',
    actionsLibMap,
  );
  const ptGlpSep2024ImplementationAddress = await deployContractAndSave(
    'PendlePtIsolationModeTokenVaultV1',
    [],
    'PendlePtGLPSep2024IsolationModeTokenVaultV2',
    actionsLibMap,
  );
  const ptWeEthJun2024ImplementationAddress = await deployContractAndSave(
    'PendlePtIsolationModeTokenVaultV1',
    [],
    'PendlePtWeETHJun2024IsolationModeTokenVaultV2',
    actionsLibMap,
  );
  const jUsdcV2ImplementationAddress = await deployContractAndSave(
    'JonesUSDCIsolationModeTokenVaultV1',
    [],
    'JonesUSDCV2IsolationModeTokenVaultV3',
    actionsLibMap,
  );
  const ptWeEthSep2024ImplementationAddress = await deployContractAndSave(
    'PendlePtIsolationModeTokenVaultV1',
    [],
    'PendlePtWeETHSep2024IsolationModeTokenVaultV2',
    actionsLibMap,
  );
  const ptEzEthSep2024ImplementationAddress = await deployContractAndSave(
    'PendlePtIsolationModeTokenVaultV1',
    [],
    'PendlePtEzETHSep2024IsolationModeTokenVaultV2',
    actionsLibMap,
  );
  const ptRsEthSep2024ImplementationAddress = await deployContractAndSave(
    'PendlePtIsolationModeTokenVaultV1',
    [],
    'PendlePtRsETHSep2024IsolationModeTokenVaultV2',
    actionsLibMap,
  );

  const fragmentNames = [
    'depositIntoVaultForDolomiteMargin',
    'withdrawFromVaultForDolomiteMargin',
    'openBorrowPosition',
    'openMarginPosition',
    'transferIntoPositionWithUnderlyingToken',
    'transferIntoPositionWithOtherToken',
    'transferFromPositionWithUnderlyingToken',
    'transferFromPositionWithOtherToken',
    'swapExactInputForOutput',
  ];
  const fragments = fragmentNames
    .map((name) => IIsolationModeTokenVaultV1__factory.createInterface().getSighash(name))
    .sort((a, b) => parseInt(a, 16) - parseInt(b, 16));

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { registry: core.eventEmitterRegistryProxy },
      'registry',
      'upgradeTo',
      [eventEmitterImplementationAddress],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { registry: core.dolomiteRegistryProxy },
      'registry',
      'upgradeTo',
      [dolomiteRegistryImplementationAddress],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { registry: core.dolomiteRegistry },
      'registry',
      'ownerSetIsolationModeMulticallFunctions',
      [fragments],
    ),
    await encodeSetUserVaultImplementationOld(core, core.gmxEcosystem.live.dGlp, glpImplementationAddress),
    await encodeSetUserVaultImplementation(core, core.plutusEcosystem.live.dPlvGlp, plvGlpImplementationAddress),
    await encodeSetUserVaultImplementation(
      core,
      core.pendleEcosystem.glpMar2024.dPtGlpMar2024,
      ptGlpMar2024ImplementationAddress,
    ),
    await encodeSetUserVaultImplementation(
      core,
      core.pendleEcosystem.rEthJun2025.dPtREthJun2025,
      ptREthJun2024ImplementationAddress,
    ),
    await encodeSetUserVaultImplementation(
      core,
      core.pendleEcosystem.wstEthJun2024.dPtWstEthJun2024,
      ptWstEthJun2024ImplementationAddress,
    ),
    await encodeSetUserVaultImplementation(
      core,
      core.pendleEcosystem.wstEthJun2025.dPtWstEthJun2025,
      ptWstEthJun2025ImplementationAddress,
    ),
    await encodeSetUserVaultImplementation(core, core.arbEcosystem.live.dArb, arbImplementationAddress),
    await encodeSetUserVaultImplementation(core, core.gmxEcosystem.live.dGmx, gmxImplementationAddress),
    await encodeSetUserVaultImplementation(
      core,
      core.pendleEcosystem.weEthApr2024.dPtWeEthApr2024,
      ptWeEthApr2024ImplementationAddress,
    ),
    await encodeSetUserVaultImplementation(
      core,
      core.pendleEcosystem.ezEthJun2024.dPtEzEthJun2024,
      ptEzEthJun2024ImplementationAddress,
    ),
    await encodeSetUserVaultImplementation(
      core,
      core.pendleEcosystem.glpSep2024.dPtGlpSep2024,
      ptGlpSep2024ImplementationAddress,
    ),
    await encodeSetUserVaultImplementation(
      core,
      core.pendleEcosystem.weEthJun2024.dPtWeEthJun2024,
      ptWeEthJun2024ImplementationAddress,
    ),
    await encodeSetUserVaultImplementation(
      core,
      core.jonesEcosystem.live.jUSDCV2IsolationModeFactory,
      jUsdcV2ImplementationAddress,
    ),
    await encodeSetUserVaultImplementation(
      core,
      core.pendleEcosystem.weEthSep2024.dPtWeEthSep2024,
      ptWeEthSep2024ImplementationAddress,
    ),
    await encodeSetUserVaultImplementation(
      core,
      core.pendleEcosystem.ezEthSep2024.dPtEzEthSep2024,
      ptEzEthSep2024ImplementationAddress,
    ),
    await encodeSetUserVaultImplementation(
      core,
      core.pendleEcosystem.rsEthApr2024.dPtRsEthSep2024,
      ptRsEthSep2024ImplementationAddress,
    ),
  ];

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      addExecuteImmediatelyTransactions: true,
      chainId: network,
    },
    invariants: async () => {
      assertHardhatInvariant(
        (await core.eventEmitterRegistryProxy.implementation()) === eventEmitterImplementationAddress,
        'Invalid event emitter implementation',
      );
      assertHardhatInvariant(
        (await core.dolomiteRegistryProxy.implementation()) === dolomiteRegistryImplementationAddress,
        'Invalid dolomite registry implementation',
      );
      assertHardhatInvariant(
        isArraysEqual(await core.dolomiteRegistry.isolationModeMulticallFunctions(), fragments),
        'Invalid isolation mode multi call selectors',
      );
      await checkIsolationModeVault(core.gmxEcosystem.live.dGlp, glpImplementationAddress);
      await checkIsolationModeVault(core.plutusEcosystem.live.dPlvGlp, plvGlpImplementationAddress);
      await checkIsolationModeVault(core.pendleEcosystem.glpMar2024.dPtGlpMar2024, ptGlpMar2024ImplementationAddress);
      await checkIsolationModeVault(
        core.pendleEcosystem.rEthJun2025.dPtREthJun2025,
        ptREthJun2024ImplementationAddress,
      );
      await checkIsolationModeVault(
        core.pendleEcosystem.wstEthJun2024.dPtWstEthJun2024,
        ptWstEthJun2024ImplementationAddress,
      );
      await checkIsolationModeVault(
        core.pendleEcosystem.wstEthJun2025.dPtWstEthJun2025,
        ptWstEthJun2025ImplementationAddress,
      );
      await checkIsolationModeVault(core.arbEcosystem.live.dArb, arbImplementationAddress);
      await checkIsolationModeVault(
        core.pendleEcosystem.weEthApr2024.dPtWeEthApr2024,
        ptWeEthApr2024ImplementationAddress,
      );
      await checkIsolationModeVault(
        core.pendleEcosystem.ezEthJun2024.dPtEzEthJun2024,
        ptEzEthJun2024ImplementationAddress,
      );
      await checkIsolationModeVault(core.pendleEcosystem.glpSep2024.dPtGlpSep2024, ptGlpSep2024ImplementationAddress);
      await checkIsolationModeVault(
        core.pendleEcosystem.weEthJun2024.dPtWeEthJun2024,
        ptWeEthJun2024ImplementationAddress,
      );
      await checkIsolationModeVault(core.jonesEcosystem.live.jUSDCV2IsolationModeFactory, jUsdcV2ImplementationAddress);
      await checkIsolationModeVault(
        core.pendleEcosystem.weEthSep2024.dPtWeEthSep2024,
        ptWeEthSep2024ImplementationAddress,
      );
      await checkIsolationModeVault(
        core.pendleEcosystem.ezEthSep2024.dPtEzEthSep2024,
        ptEzEthSep2024ImplementationAddress,
      );
      await checkIsolationModeVault(
        core.pendleEcosystem.rsEthApr2024.dPtRsEthSep2024,
        ptRsEthSep2024ImplementationAddress,
      );
    },
  };
}

interface Factory extends BaseContract {
  populateTransaction: {
    ownerSetUserVaultImplementation: (
      implementation: string,
      overrides?: Overrides & { from?: string },
    ) => Promise<PopulatedTransaction>;
  };
}

async function encodeSetUserVaultImplementation(
  core: CoreProtocolArbitrumOne,
  factory: Factory,
  userVaultAddress: string,
): Promise<EncodedTransaction> {
  return prettyPrintEncodedDataWithTypeSafety(core, { factory }, 'factory', 'ownerSetUserVaultImplementation', [
    userVaultAddress,
  ]);
}

async function encodeSetUserVaultImplementationOld(
  core: CoreProtocolArbitrumOne,
  factory: IGLPIsolationModeVaultFactoryOld,
  userVaultAddress: string,
): Promise<EncodedTransaction> {
  return prettyPrintEncodedDataWithTypeSafety(core, { factory }, 'factory', 'setUserVaultImplementation', [
    userVaultAddress,
  ]);
}

async function checkIsolationModeVault(
  factory: IIsolationModeVaultFactory | IGLPIsolationModeVaultFactoryOld,
  vaultAddress: string,
): Promise<void> {
  const foundVault = await factory.userVaultImplementation();
  if (foundVault !== vaultAddress) {
    const detailed = IERC20Metadata__factory.connect(factory.address, factory.signer);
    return Promise.reject(new Error(`Invalid vault for ${await detailed.symbol()}`));
  }
}

doDryRunAndCheckDeployment(main);
