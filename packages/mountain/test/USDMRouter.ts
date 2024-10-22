import { expect } from 'chai';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { ZERO_BI, ONE_ETH_BI, Network } from 'packages/base/src/utils/no-deps-constants';
import { snapshot, revertToSnapshotAndCapture } from 'packages/base/test/utils';
import { expectProtocolBalance, expectWalletBalance, expectWalletBalanceIsBetween } from 'packages/base/test/utils/assertions';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { setupCoreProtocol, disableInterestAccrual, setupUSDMBalance } from 'packages/base/test/utils/setup';
import { IERC4626, IERC4626__factory, USDMRouter, USDMRouter__factory } from '../src/types';
import { BalanceCheckFlag } from '@dolomite-exchange/dolomite-margin';

const usdmAmount = ONE_ETH_BI;
const defaultAccountNumber = ZERO_BI;

describe('USDMRouter', () => {
  let snapshotId: string;
  let core: CoreProtocolArbitrumOne;
  let router: USDMRouter;
  let wUSDM: IERC4626;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.ArbitrumOne,
      blockNumber: 227_000_000,
    });
    router = await createContractWithAbi<USDMRouter>(
      USDMRouter__factory.abi,
      USDMRouter__factory.bytecode,
      [
        core.dolomiteMargin.address,
        core.tokens.usdm.address,
        core.tokens.wusdm.address
      ],
    );
    await disableInterestAccrual(core, core.marketIds.wusdm);
    await core.dolomiteMargin.ownerSetGlobalOperator(router.address, true);
    await setupUSDMBalance(core, core.hhUser1, usdmAmount, router);
    wUSDM = IERC4626__factory.connect(core.tokens.wusdm.address, core.hhUser1);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await router.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await router.USDM()).to.eq(core.tokens.usdm.address);
      expect(await router.W_USDM()).to.eq(core.tokens.wusdm.address);
      expect(await router.W_USDM_MARKET_ID()).to.eq(core.marketIds.wusdm);
    });
  });

  describe('#depositUSDM', () => {
    it('should work normally', async () => {
      const shares = await wUSDM.convertToShares(usdmAmount);
      await router.depositUSDM(defaultAccountNumber, usdmAmount);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.wusdm, shares);
      await expectWalletBalance(core.hhUser1, core.tokens.usdm, ZERO_BI);
      await expectWalletBalance(router, core.tokens.usdm, ZERO_BI);
      await expectWalletBalance(router, core.tokens.wusdm, ZERO_BI);
    });
  });

  describe('#withdrawUSDM', () => {
    it('should work normally', async () => {
      const shares = await wUSDM.convertToShares(usdmAmount);
      await router.depositUSDM(defaultAccountNumber, usdmAmount);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.wusdm, shares);
      await expectWalletBalance(core.hhUser1, core.tokens.usdm, ZERO_BI);

      const assets = await wUSDM.previewRedeem(shares);
      await router.withdrawUSDM(defaultAccountNumber, shares, BalanceCheckFlag.None);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.wusdm, ZERO_BI);
      // USDM is rebasing so adding a small margin of error
      await expectWalletBalanceIsBetween(core.hhUser1, core.tokens.usdm, assets.sub(10), assets.add(10));
      await expectWalletBalance(router, core.tokens.usdm, ZERO_BI);
      await expectWalletBalance(router, core.tokens.wusdm, ZERO_BI);
    });
  });
});
