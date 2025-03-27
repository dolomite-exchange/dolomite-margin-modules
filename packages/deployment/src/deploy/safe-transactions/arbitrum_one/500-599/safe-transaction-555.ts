import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import {
  deployContractAndSave,

} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { RegistryProxy__factory } from 'packages/base/src/types/factories/contracts/general/RegistryProxy__factory';
import { Ownable__factory } from 'packages/tokenomics/src/types';

const D_TOKEN_ROLE = '0xcd86ded6d567eb7adb1b98d283b7e4004869021f7651dbae982e0992bfe0df5a';
const OWNER_WITHDRAW_EXCESS_TOKENS_SELECTOR = '0x8f6bc659';
const OWNER_WITHDRAW_EXCESS_TOKENS_BYTES32_SELECTOR = '0x8f6bc65900000000000000000000000000000000000000000000000000000000';
const OWNER_SET_MAX_WEI_SELECTOR = '0x0cd30a0e';
const OWNER_SET_MAX_WEI_BYTES32_SELECTOR = '0x0cd30a0e00000000000000000000000000000000000000000000000000000000';

/**
 * This script encodes the following transactions:
 * - Deploys new 4626 dToken implementation contracts
 * - Upgrades each existing 4626 dToken to the new implementation
 * - Gives appropriate DolomiteOwnerV2 roles to each 4626 contract
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  // @todo remove once ownership is transferred
  await Ownable__factory.connect(core.dolomiteMargin.address, core.governance).transferOwnership(
    core.ownerAdapterV2.address
  );

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

  const transactions: EncodedTransaction[] = [];

  // Setup DTokenRole on DolomiteOwnerV2
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'ownerAdapterV2',
      'ownerAddRole',
      [D_TOKEN_ROLE]
    )
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'ownerAdapterV2',
      'ownerAddRoleToAddressFunctionSelectors',
      [
        D_TOKEN_ROLE,
        core.dolomiteMargin.address,
        [
          OWNER_WITHDRAW_EXCESS_TOKENS_SELECTOR,
          OWNER_SET_MAX_WEI_SELECTOR
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
          D_TOKEN_ROLE,
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
      assertHardhatInvariant(
        await core.ownerAdapterV2.isRole(D_TOKEN_ROLE),
        'D_TOKEN_ROLE is not an active role'
      );
      assertHardhatInvariant(
        (await core.ownerAdapterV2.getRoleToAddressFunctionSelectors(
          D_TOKEN_ROLE,
          core.dolomiteMargin.address
        )).length === 2,
        'D_TOKEN_ROLE has the wrong number of address to function selectors'
      );
      assertHardhatInvariant(
        (await core.ownerAdapterV2.getRoleToAddressFunctionSelectors(
          D_TOKEN_ROLE,
          core.dolomiteMargin.address
        )).includes(OWNER_WITHDRAW_EXCESS_TOKENS_BYTES32_SELECTOR),
        'OWNER_WITHDRAW_EXCESS_TOKENS_SELECTOR is not in the D_TOKEN_ROLE'
      );
      assertHardhatInvariant(
        (await core.ownerAdapterV2.getRoleToAddressFunctionSelectors(
          D_TOKEN_ROLE,
          core.dolomiteMargin.address
        )).includes(OWNER_SET_MAX_WEI_BYTES32_SELECTOR),
        'OWNER_SET_MAX_WEI_SELECTOR is not in the D_TOKEN_ROLE'
      );

      for (const [key, dToken] of Object.entries(core.dolomiteTokens)) {
        // check dToken was granted the correct roles
        assertHardhatInvariant(
          await core.ownerAdapterV2.hasRole(D_TOKEN_ROLE, dToken.address),
          `dToken ${key} does not have D_TOKEN_ROLE`
        );
        assertHardhatInvariant(
          await core.ownerAdapterV2.hasRole(executorRole, dToken.address),
          `dToken ${key} does not have EXECUTOR_ROLE`
        );
        assertHardhatInvariant(
          await core.ownerAdapterV2.hasRole(bypassTimelockRole, dToken.address),
          `dToken ${key} does not have BYPASS_TIMELOCK_ROLE`
        );

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
