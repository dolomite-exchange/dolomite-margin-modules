import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network, ONE_DAY_SECONDS } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import {
  deployContractAndSave,
  deployDolomiteErc4626Token,
  deployDolomiteErc4626WithPayableToken,

} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { RegistryProxy__factory } from 'packages/base/src/types/factories/contracts/general/RegistryProxy__factory';
import { DolomiteOwnerV2__factory } from 'packages/admin/src/types/factories/contracts/DolomiteOwnerV2__factory';
import { Ownable__factory } from 'packages/tokenomics/src/types';

/**
 * This script encodes the following transactions:
 * - Deploys new 4626 dToken implementation contracts
 * - Upgrades each existing 4626 dToken to the new implementation
 * - Gives appropriate DolomiteOwnerV2 roles to each 4626 contract
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  // @todo deploy ownerAdapterV2 and fix this
  const ownerAdapterV2Address = await deployContractAndSave(
    'DolomiteOwnerV2',
    [core.gnosisSafe.address, ONE_DAY_SECONDS],
    'DolomiteOwnerV2',
    {},
    { signer: core.hhUser1 }
  );
  // @todo Switch ownerAdapterV2 back to readonly on core-protocol-abstract.ts
  core.ownerAdapterV2 = DolomiteOwnerV2__factory.connect(ownerAdapterV2Address, core.hhUser1);
  await Ownable__factory.connect(core.dolomiteMargin.address, core.governance).transferOwnership(ownerAdapterV2Address);

  const erc4626Implementation = await deployContractAndSave(
    'DolomiteERC4626',
    [core.dolomiteRegistryProxy.address, core.dolomiteMargin.address],
    'DolomiteERC4626ImplementationV2',
    {},
    { signer: core.hhUser1 }
  );
  const erc4626PayableImplementation = await deployContractAndSave(
    'DolomiteERC4626WithPayable',
    [core.dolomiteRegistryProxy.address, core.dolomiteMargin.address],
    'DolomiteERC4626WithPayableImplementationV2',
    {},
    { signer: core.hhUser1 }
  );

  const bypassTimelockRole = await core.ownerAdapterV2.BYPASS_TIMELOCK_ROLE();
  const executorRole = await core.ownerAdapterV2.EXECUTOR_ROLE();
  const dTokenRole = await core.ownerAdapterV2.D_TOKEN_ROLE();

  const transactions: EncodedTransaction[] = [];

  // Setup DTokenRole on DolomiteOwnerV2
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'ownerAdapterV2',
      'ownerAddRoleToAddressFunctionSelectors',
      [
        dTokenRole,
        core.dolomiteMargin.address,
        [
          '0x8f6bc659', /* ownerWithdrawExcessTokens */
          '0x0cd30a0e' /* ownerSetMaxWei */
        ]
      ]
    )
  );

  /**
   * DTokens on Arbitrum One:
   *  bridged usdc
   *  dai
   *  usdc
   *  usdt
   *  wbtc
   *  weth
   */
  for (const [key, dToken] of Object.entries(core.dolomiteTokens)) {
    // Upgrade the implementation
    const proxy = RegistryProxy__factory.connect(dToken.address, core.hhUser1);
    if (key === 'weth') {
      transactions.push(
        await prettyPrintEncodedDataWithTypeSafety(
          core,
          { proxy },
          'proxy',
          'upgradeTo',
          [erc4626PayableImplementation]
        )
      );
    } else {
      transactions.push(
        await prettyPrintEncodedDataWithTypeSafety(
          core,
          { proxy },
          'proxy',
          'upgradeTo',
          [erc4626Implementation]
        )
      );
    }

    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        core,
        'ownerAdapterV2',
        'grantRole',
        [
          bypassTimelockRole,
          dToken.address
        ]
      )
    );
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        core,
        'ownerAdapterV2',
        'grantRole',
        [
          executorRole,
          dToken.address
        ]
      )
    );
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        core,
        'ownerAdapterV2',
        'grantRole',
        [
          dTokenRole,
          dToken.address
        ]
      )
    );
  }


  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      addExecuteImmediatelyTransactions: true,
    },
    invariants: async () => {
      for (const [key, dToken] of Object.entries(core.dolomiteTokens)) {
        // Check all implementations were upgraded
        const proxy = RegistryProxy__factory.connect(dToken.address, core.hhUser1);
        if (key === 'weth') {
          assertHardhatInvariant(
            (await proxy.implementation()) === erc4626PayableImplementation,
            `dToken ${key} is not upgraded to the new implementation`
          );
        } else {
          assertHardhatInvariant(
            (await proxy.implementation()) === erc4626Implementation,
            `dToken ${key} is not upgraded to the new implementation`
          );
        }
      }
    },
  };
}

doDryRunAndCheckDeployment(main);
