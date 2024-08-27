import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { OogaBoogaAggregatorTrader } from '../../src/types';
import { AccountStruct } from '../../src/utils/constants';
import { depositIntoDolomiteMargin } from '../../src/utils/dolomite-utils';
import { BYTES_EMPTY, Network, ONE_ETH_BI, ZERO_BI } from '../../src/utils/no-deps-constants';
import {
  revertToSnapshotAndCapture,
  snapshot,
} from '../utils';
import {
  expectThrow,
} from '../utils/assertions';

import { createOogaBoogaAggregatorTrader } from '../utils/ecosystem-utils/traders';
import { disableInterestAccrual, getDefaultCoreProtocolConfig, setupCoreProtocol, setupTestMarket, setupWETHBalance } from '../utils/setup';
import { CoreProtocolBerachain } from '../utils/core-protocols/core-protocol-berachain';

const defaultAccountNumber = '0';
const amountIn = BigNumber.from('1000000000000000000');
const minAmountOut = BigNumber.from('123123123');

describe('OogaBoogaAggregatorTrader', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let trader: OogaBoogaAggregatorTrader;
  let defaultAccount: AccountStruct;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.Berachain));

    trader = (await createOogaBoogaAggregatorTrader(core)).connect(core.hhUser1);
    defaultAccount = { owner: core.hhUser1.address, number: defaultAccountNumber };

    // prevent interest accrual between calls
    await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.weth.address, ONE_ETH_BI);
    await setupTestMarket(core, core.tokens.weth, false);
    await disableInterestAccrual(core, core.marketIds.weth);

    await setupWETHBalance(core, core.hhUser1, amountIn, { address: core.dolomiteMargin.address });
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountIn);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#contructor', () => {
    it('should initialize variables properly', async () => {
      expect(await trader.OOGA_BOOGA_ROUTER()).to.equal(core.oogaBoogaEcosystem.oogaBoogaRouter.address);
      expect(await trader.OOGA_BOOGA_EXECUTOR()).to.equal(core.oogaBoogaEcosystem.oogaBoogaExecutor.address);
    });
  });

  describe('#exchange', () => {
    it('should succeed under normal conditions', async () => {
    });

    it('should fail when caller is not DolomiteMargin', async () => {
    });

    it('should fail when output is insufficient', async () => {
    });

    it('should fail when Paraswap fails', async () => {
    });
  });

  describe('#getExchangeCost', () => {
    it('should always fail', async () => {
      await expectThrow(
        trader.getExchangeCost(core.tokens.weth.address, core.tokens.usdc.address, ZERO_BI, BYTES_EMPTY),
        'OogaBoogaAggregatorTrader: getExchangeCost not implemented',
      );
    });
  });
});
