import { INTEGERS } from '@dolomite-exchange/dolomite-margin';
import {
  IsolationModeFreezableLiquidatorProxy,
  IsolationModeFreezableLiquidatorProxy__factory,
} from '../../../src/types';
import { createContractWithAbi, depositIntoDolomiteMargin } from '../../../src/utils/dolomite-utils';
import { Network, ONE_BI, ONE_ETH_BI, ZERO_BI } from '../../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../../utils';
import { setExpiry } from '../../utils/expiry-utils';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol, setupWETHBalance } from '../../utils/setup';

const solidAccount = {
  owner: '0x52256ef863a713ef349ae6e97a7e8f35785145de',
  number: '0',
};
const liquidAccount = {
  owner: '0xc93b2a614453ad041f0143dcb9b05448505def01',
  number: '92127868775155223522677465536015646923360873953133361407154510917254498286069',
};

describe('IsolationModeFreezableLiquidatorProxy', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let proxy: IsolationModeFreezableLiquidatorProxy;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    proxy = await createContractWithAbi<IsolationModeFreezableLiquidatorProxy>(
      IsolationModeFreezableLiquidatorProxy__factory.abi,
      IsolationModeFreezableLiquidatorProxy__factory.bytecode,
      [core.dolomiteMargin.address, core.expiry.address, core.liquidatorAssetRegistry.address],
    );

    // TODO; set up GM tokens.
    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#prepareForLiquidation', () => {
    it('should work normally for underwater account', async () => {
      const { owner } = await setupWETHBalance(core, liquidAccount.owner, ONE_ETH_BI.mul(100));
      await depositIntoDolomiteMargin(core, liquidAccount.owner, owner.address, ONE_ETH_BI.mul(100));
      await setExpiry(core, liquidAccount.owner, INTEGERS.ZERO, INTEGERS.ZERO, INTEGERS.ZERO);
      await core.liquidator.prepareForLiquidation(liquidAccount.owner, INTEGERS.ZERO, INTEGERS.ZERO);

      await proxy.prepareForLiquidation(
        liquidAccount.owner,
        gmMarketId,
        amountWei,
        core.marketIds.weth,
        ONE_BI,
        ZERO_BI,
      );
    });
  });
});
