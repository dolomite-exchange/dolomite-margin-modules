import { IERC20__factory } from '@dolomite-exchange/modules-base/src/types';
import { getUpgradeableProxyConstructorParams } from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber, impersonate } from '@dolomite-exchange/modules-base/test/utils';
import { expectEvent } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  getRewardsDistributorConstructorParams,
} from '@dolomite-exchange/modules-liquidity-mining/src/liquidity-mining-constructors';
import { MineralToken__factory } from '@dolomite-exchange/modules-liquidity-mining/src/types';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  deployContractAndSave,
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety,
} from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';

/**
 * This script encodes the following transactions:
 * - Creates the Mineral token
 * - Creates the Mineral Distributor merkle drop
 * - Creates the new event emitter registry
 * - Plugs in the new event emitter registry, and sets the Distributor as a global operator
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const mineralTokenImplementationAddress = await deployContractAndSave(
    'MineralToken',
    [core.dolomiteMargin.address],
    'MineralTokenImplementationV1',
  );
  const mineralTokenImplementation = MineralToken__factory.connect(mineralTokenImplementationAddress, core.hhUser1);
  const initializeCalldata = await mineralTokenImplementation.populateTransaction.initialize();
  const mineralProxyAddress = await deployContractAndSave(
    'UpgradeableProxy',
    getUpgradeableProxyConstructorParams(
      mineralTokenImplementationAddress,
      initializeCalldata,
      core.dolomiteMargin,
    ),
    'MineralTokenProxy',
  );
  const mineralProxy = IERC20__factory.connect(mineralProxyAddress, core.hhUser1);

  const mineralClaimerAddress = await deployContractAndSave(
    'RewardsDistributor',
    getRewardsDistributorConstructorParams(
      core,
      mineralProxy,
      [
        '0xA238CBeb142c10Ef7Ad8442C6D1f9E89e07e7761',
        '0xbDEf2b2051E2aE113297ee8301e011FD71A83738',
        '0x52256ef863a713Ef349ae6E97A7E8f35785145dE',
      ],
    ),
    'MineralDistributor',
  );

  const eventEmitterImplementationAddress = await deployContractAndSave(
    'EventEmitterRegistry',
    [],
    'EventEmitterRegistryImplementationV3',
  );

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomite: core.dolomiteMargin },
      'dolomite',
      'ownerSetGlobalOperator',
      [mineralClaimerAddress, true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { eventEmitterProxy: core.eventEmitterRegistryProxy },
      'eventEmitterProxy',
      'upgradeTo',
      [eventEmitterImplementationAddress],
    ),
  ];

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
    },
    invariants: async () => {
      assertHardhatInvariant(
        await core.dolomiteMargin.getIsGlobalOperator(mineralClaimerAddress),
        'mineralClaimerAddress must be operator',
      );

      const globalOperator = await impersonate(mineralClaimerAddress, true);
      const result = await core.eventEmitterRegistry.connect(globalOperator)
        .emitRewardClaimed(core.hhUser1.address, 0, 123);
      await expectEvent(core.eventEmitterRegistry, result, 'RewardClaimed', {
        distributor: mineralClaimerAddress,
        user: core.hhUser1.address,
        epoch: 0,
        amount: 123,
      });
    },
  };
}

doDryRunAndCheckDeployment(main);
