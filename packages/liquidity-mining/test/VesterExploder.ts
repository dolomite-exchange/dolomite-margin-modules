import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { IERC20 } from 'packages/base/src/types';
import { depositIntoDolomiteMargin } from 'packages/base/src/utils/dolomite-utils';
import { Network, ONE_ETH_BI, ONE_WEEK_SECONDS, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectThrow, expectWalletBalance } from 'packages/base/test/utils/assertions';
import {
  disableInterestAccrual,
  setupARBBalance,
  setupCoreProtocol,
  setupWETHBalance,
} from 'packages/base/test/utils/setup';
import { OARB, OARB__factory, TestVesterImplementationV2, VesterExploder } from '../src/types';
import { createTestVesterV2Proxy, createVesterExploder } from './liquidity-mining-ecosystem-utils';

const defaultAccountNumber = ZERO_BI;
const LIQUIDATION_BOT = '0x1fF6B8E1192eB0369006Bbad76dA9068B68961B2';
const WETH_BALANCE = parseEther('1000');

describe('VesterExploder', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;

  let vester: TestVesterImplementationV2;
  let vesterExploder: VesterExploder;
  let oARB: OARB;
  let nextNftId: BigNumber;
  let handler: SignerWithAddress;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.ArbitrumOne,
      blockNumber: 157_301_500,
    });
    await disableInterestAccrual(core, core.marketIds.usdc);
    await disableInterestAccrual(core, core.marketIds.weth);
    await disableInterestAccrual(core, core.marketIds.arb!!);

    handler = await impersonate(LIQUIDATION_BOT, true);
    vester = await createTestVesterV2Proxy(core, handler);
    vesterExploder = await createVesterExploder(core, vester);
    nextNftId = (await vester.nextNftId()).add(1);
    oARB = await OARB__factory.connect(await vester.oARB(), core.hhUser1);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(vesterExploder.address, true);
    await freezeAndGetOraclePrice(core.tokens.weth);
    await freezeAndGetOraclePrice(core.tokens.arb!);
    await freezeAndGetOraclePrice(core.tokens.usdc);
    await freezeAndGetOraclePrice(core.tokens.dai);
    await freezeAndGetOraclePrice(core.tokens.link);
    await freezeAndGetOraclePrice(core.tokens.wbtc);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should set the correct state variables', async () => {
      expect(await vesterExploder.VESTER()).to.eq(vester.address);
      expect(await vesterExploder.isHandler(handler.address)).to.eq(true);
    });
  });

  describe('#ownerSetIsHandler', () => {
    it('should work normally', async () => {
      await vesterExploder.connect(core.governance).ownerSetIsHandler(core.hhUser1.address, true);
      expect(await vesterExploder.isHandler(core.hhUser1.address)).to.eq(true);
    });

    it('should fail if not called by dolomite margin owner', async () => {
      await expectThrow(
        vesterExploder.connect(core.hhUser1).ownerSetIsHandler(handler.address, false),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#explodePosition', () => {
    it('should work normally', async () => {
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(vester.address, true);
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(core.hhUser5.address, true);

      await oARB.connect(core.hhUser5).mint(ONE_ETH_BI);
      await oARB.connect(core.hhUser5).transfer(core.hhUser1.address, ONE_ETH_BI);
      await expectWalletBalance(core.hhUser1.address, oARB, ONE_ETH_BI);

      await setupARBBalance(core, core.hhUser1, ONE_ETH_BI, core.dolomiteMargin);
      await setupARBBalance(core, core.hhUser2, parseEther('100'), core.dolomiteMargin);
      await setupWETHBalance(core, core.hhUser1, WETH_BALANCE, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.arb!!, ONE_ETH_BI);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, WETH_BALANCE);
      await oARB.connect(core.hhUser1).approve(vester.address, ONE_ETH_BI);

      await vester.vest(defaultAccountNumber, ONE_WEEK_SECONDS, ONE_ETH_BI);
      await increase(ONE_WEEK_SECONDS * 2);
      await expect(vesterExploder.connect(handler).explodePosition(nextNftId)).to.not.be.reverted;
    });

    it('should fail if not called by valid handler', async () => {
      await expectThrow(
        vesterExploder.connect(core.hhUser1).explodePosition(ZERO_BI),
        `VesterExploder: Only handler can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  async function freezeAndGetOraclePrice(token: IERC20): Promise<BigNumber> {
    const marketId = await core.dolomiteMargin.getMarketIdByTokenAddress(token.address);
    const price = await core.dolomiteMargin.getMarketPrice(marketId);
    await core.testEcosystem!.testPriceOracle.setPrice(token.address, price.value);
    await core.dolomiteMargin.ownerSetPriceOracle(marketId, core.testEcosystem!.testPriceOracle.address);
    return price.value;
  }
});
