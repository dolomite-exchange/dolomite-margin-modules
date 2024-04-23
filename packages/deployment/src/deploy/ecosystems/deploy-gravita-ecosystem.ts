import { getAnyNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { NetworkType, ONE_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { deployContractAndSave } from '../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../utils/dry-run-utils';
import getScriptName from '../../utils/get-script-name';
import {
  getExternalOARBConstructorParams
} from '@dolomite-exchange/modules-liquidity-mining/src/liquidity-mining-constructors';
import { getRealLatestBlockNumber, impersonate } from '@dolomite-exchange/modules-base/test/utils';
import { expect } from 'chai';
import { ExternalOARB__factory } from '@dolomite-exchange/modules-liquidity-mining/src/types';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';

const ownerAddress = '0x52256ef863a713Ef349ae6E97A7E8f35785145dE';

async function main<T extends NetworkType>(): Promise<DryRunOutput<T>> {
  const network = await getAnyNetwork() as T;
  const core = await setupCoreProtocol<T>({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });
  const oArbAddress = await deployContractAndSave(
    'ExternalOARB',
    getExternalOARBConstructorParams(ownerAddress, 'Gravita: oARB Token', 'goARB'),
    'GravitaOArbToken',
  );
  const oArb = ExternalOARB__factory.connect(oArbAddress, core.hhUser1);

  return {
    core,
    invariants: async () => {
      const owner = await impersonate(ownerAddress);
      expect(await oArb.owner()).to.eq(ownerAddress);

      await expectThrow(
        oArb.mint(ONE_BI),
        'oARB: Invalid handler'
      );

      await expectThrow(
        oArb.connect(core.hhUser1).ownerMint(ONE_BI),
        'Ownable: caller is not the owner',
      );

      await expectThrow(
        oArb.connect(core.hhUser1).ownerSetHandler(core.hhUser1.address, true),
        'Ownable: caller is not the owner',
      );

      expect(await oArb.isHandler(core.hhUser1.address)).to.eq(false);
      await oArb.connect(owner).ownerSetHandler(core.hhUser1.address, true);
      expect(await oArb.isHandler(core.hhUser1.address)).to.eq(true);
    },
    scriptName: getScriptName(__filename),
    upload: {
      chainId: core.network,
      transactions: [],
    },
  };
}

// noinspection JSIgnoredPromiseFromCall
doDryRunAndCheckDeployment(main);
