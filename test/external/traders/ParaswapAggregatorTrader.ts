import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { ParaswapAggregatorTrader } from '../../../src/types';
import { BYTES_EMPTY, Network, ZERO_BI } from '../../../src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectThrow } from '../../utils/assertions';
import { createParaswapAggregatorTrader } from '../../utils/ecosystem-token-utils/traders';
import { getCalldataForParaswap } from '../../utils/liquidation-utils';
import { CoreProtocol, setupCoreProtocol, setupWETHBalance } from '../../utils/setup';

const amountIn = BigNumber.from('1000000000000000000');
const minAmountOut = BigNumber.from('123123123');

describe('ParaswapAggregatorTrader', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let trader: ParaswapAggregatorTrader;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 96118000,
      network: Network.ArbitrumOne,
    });
    trader = (await createParaswapAggregatorTrader(core)).connect(core.hhUser1);

    const traderSigner = await impersonate(trader.address, true, amountIn.mul(3));
    await setupWETHBalance(core, traderSigner, amountIn.mul(2), { address: await trader.PARASWAP_TRANSFER_PROXY() });

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#contructor', () => {
    it('should initialize variables properly', async () => {
      expect(await trader.PARASWAP_AUGUSTUS_ROUTER()).to.equal(core.paraswapEcosystem!.augustusRouter);
      expect(await trader.PARASWAP_TRANSFER_PROXY()).to.equal(core.paraswapEcosystem!.transferProxy);
    });
  });

  describe('#exchange', () => {
    it('should succeed under normal conditions', async () => {
      const caller = await impersonate(core.dolomiteMargin.address, true);
      const { calldata } = await getCalldataForParaswap(
        amountIn,
        core.weth,
        18,
        minAmountOut,
        core.usdc,
        6,
        core.dolomiteMargin,
        trader,
        core,
      );
      await expectThrow(
        trader.connect(caller)
          .exchange(
            core.hhUser1.address,
            core.dolomiteMargin.address,
            core.weth.address,
            core.usdc.address,
            amountIn,
            calldata,
          ),
        'ParaswapAggregatorTrader: revert',
      );
    });

    it('should fail when caller is not DolomiteMargin', async () => {
      await expectThrow(
        trader.connect(core.hhUser1)
          .exchange(
            core.hhUser1.address,
            core.dolomiteMargin.address,
            core.weth.address,
            core.usdc.address,
            ZERO_BI,
            BYTES_EMPTY,
          ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail when calldata is invalid', async () => {
      const caller = await impersonate(core.dolomiteMargin.address, true);
      const { calldata } = await getCalldataForParaswap(
        amountIn,
        core.weth,
        18,
        minAmountOut,
        core.usdc,
        6,
        core.dolomiteMargin,
        trader,
        core,
      );
      const actualCalldata = calldata.replace(
        core.weth.address.toLowerCase().substring(2),
        core.weth.address.toLowerCase().substring(2).replace('4', '3'),
      );
      await expectThrow(
        trader.connect(caller)
          .exchange(
            core.hhUser1.address,
            core.dolomiteMargin.address,
            core.weth.address,
            core.usdc.address,
            amountIn,
            actualCalldata,
          ),
        'ParaswapAggregatorTrader: revert',
      );
    });

    it('should fail when Paraswap fails', async () => {
      const caller = await impersonate(core.dolomiteMargin.address, true);
      const { calldata } = await getCalldataForParaswap(
        amountIn,
        core.weth,
        18,
        minAmountOut,
        core.usdc,
        6,
        core.dolomiteMargin,
        trader,
        core,
      );
      const actualCalldata = calldata.replace(
        amountIn.toHexString().substring(2).toLowerCase(),
        amountIn.mul(11).div(10).toHexString().substring(2).toLowerCase(),
      );
      await expectThrow(
        trader.connect(caller)
          .exchange(
            core.hhUser1.address,
            core.dolomiteMargin.address,
            core.weth.address,
            core.usdc.address,
            amountIn.mul(2),
            actualCalldata,
          ),
        'ParaswapAggregatorTrader: revert',
      );
    });
  });

  describe('#getExchangeCost', () => {
    it('should always fail', async () => {
      await expectThrow(
        trader.getExchangeCost(core.weth.address, core.usdc.address, ZERO_BI, BYTES_EMPTY),
        'ParaswapAggregatorTrader: getExchangeCost not implemented',
      );
    });
  });
});
