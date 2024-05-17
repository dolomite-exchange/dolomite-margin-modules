import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { IsolationModeFreezableLiquidatorProxy__factory } from 'packages/base/src/types';
import {
  getIsolationModeFreezableLiquidatorProxyConstructorParams,
} from 'packages/base/src/utils/constructors/dolomite';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  deployContractAndSave,
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety,
} from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';
import ModuleDeployments from '../../deployments.json';

/**
 * This script encodes the following transactions:
 * - Deploys a new instance of the Freezable Liquidator Proxy (old version wasn't deployed properly due to compilation
 *    sharing)
 * - Unset the old freezable liquidator proxy (v2) as a global operator
 * - Set the new freezable liquidator proxy (v3) as a global operator
 * - Remove the async assets from the liquidator registry as being set for the V2 liquidator
 * - Add the async assets to the liquidator registry for the V3 liquidator
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const oldFreezableAddress = ModuleDeployments.IsolationModeFreezableLiquidatorProxyV2[network].address;
  const oldFreezable = IsolationModeFreezableLiquidatorProxy__factory.connect(oldFreezableAddress, core.hhUser1);

  const numMarkets = await core.dolomiteMargin.getNumMarkets();
  const freezableMarketIds = [];
  for (let i = 0; i < numMarkets.toNumber(); i++) {
    const liquidators = await core.liquidatorAssetRegistry.getLiquidatorsForAsset(i);
    if (liquidators.some(l => l === oldFreezableAddress)) {
      freezableMarketIds.push(i);
    }
  }

  const newFreezableAddress = await deployContractAndSave(
    'IsolationModeFreezableLiquidatorProxy',
    getIsolationModeFreezableLiquidatorProxyConstructorParams(core),
    'IsolationModeFreezableLiquidatorProxyV3',
  );
  const newFreezable = IsolationModeFreezableLiquidatorProxy__factory.connect(newFreezableAddress, core.hhUser1);

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomite: core.dolomiteMargin },
      'dolomite',
      'ownerSetGlobalOperator',
      [oldFreezable.address, false],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomite: core.dolomiteMargin },
      'dolomite',
      'ownerSetGlobalOperator',
      [newFreezable.address, true],
    ),
  );

  for (let i = 0; i < freezableMarketIds.length; i++) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { registry: core.liquidatorAssetRegistry },
        'registry',
        'ownerRemoveLiquidatorFromAssetWhitelist',
        [freezableMarketIds[i], oldFreezable.address],
      ),
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { registry: core.liquidatorAssetRegistry },
        'registry',
        'ownerAddLiquidatorToAssetWhitelist',
        [freezableMarketIds[i], newFreezable.address],
      ),
    );
  }

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
    },
    skipTimeDelay: true,
    invariants: async () => {
      expect(await core.dolomiteMargin.getIsGlobalOperator(oldFreezable.address)).to.be.false;
      expect(await core.dolomiteMargin.getIsGlobalOperator(newFreezable.address)).to.be.true;
    },
  };
}

doDryRunAndCheckDeployment(main);
