import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { Emitter, Emitter__factory, OARB, OARB__factory, Vester, Vester__factory } from 'src/types';
import { createContractWithAbi, depositIntoDolomiteMargin } from 'src/utils/dolomite-utils';
import { Network, ONE_BI, ONE_ETH_BI, ZERO_BI } from 'src/utils/no-deps-constants';
import { getBlockTimestamp, revertToSnapshotAndCapture, snapshot } from 'test/utils';
import { expectEvent, expectProtocolBalance, expectThrow } from 'test/utils/assertions';
import {
  CoreProtocol,
  disableInterestAccrual,
  getDefaultCoreProtocolConfig,
  setupARBBalance,
  setupCoreProtocol,
  setupTestMarket,
  setupUSDCBalance,
} from 'test/utils/setup';
import { expectEmptyPosition } from './liquidityMining-utils';
import { mine } from '@nomicfoundation/hardhat-network-helpers';

const defaultAccountNumber = ZERO_BI;
const usdcAmount = BigNumber.from('100000000'); // $100
const ONE_WEEK = BigNumber.from('604800');

describe('Vester', () => {
  let snapshotId: string;

  let core: CoreProtocol;

  let emitter: Emitter;
  let vester: Vester;
  let oARB: OARB;
  let blockNumber: number;
  let marketId: BigNumberish;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    await disableInterestAccrual(core, core.marketIds.usdc);
    await disableInterestAccrual(core, core.marketIds.arb);

    oARB = await createContractWithAbi<OARB>(OARB__factory.abi, OARB__factory.bytecode, [core.dolomiteMargin.address]);
    await core.testEcosystem!.testPriceOracle.setPrice(
      oARB.address,
      '1000000000000000000' // $1.00
    );
    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, oARB, true);
    await oARB.connect(core.governance).ownerInitialize();

    blockNumber = await ethers.provider.getBlockNumber();
    emitter = await createContractWithAbi<Emitter>(
      Emitter__factory.abi,
      Emitter__factory.bytecode,
      [
        core.dolomiteMargin.address,
        core.dolomiteRegistry.address,
        oARB.address,
        ONE_ETH_BI,
        blockNumber,
      ]
    );
    vester = await createContractWithAbi<Vester>(
      Vester__factory.abi,
      Vester__factory.bytecode,
      [
        core.dolomiteMargin.address,
        core.dolomiteRegistry.address,
        marketId,
      ]
    );

    await setupUSDCBalance(core, core.hhUser1, usdcAmount.mul(2), core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.usdc, usdcAmount);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(emitter.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(vester.address, true);

    await emitter.connect(core.governance).add(core.marketIds.usdc, 100);
    await emitter.connect(core.hhUser1).deposit(defaultAccountNumber, core.marketIds.usdc, usdcAmount);
    await mine(1);
    await emitter.connect(core.hhUser1).withdraw(core.marketIds.usdc, usdcAmount);

    // @follow-up Since par values, tests are one wei off
    await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, marketId, parseEther('2').sub(1));
    await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, core.marketIds.usdc, usdcAmount);
    await expectProtocolBalance(core, emitter.address, defaultAccountNumber, core.marketIds.usdc, ZERO_BI);
    expect(await oARB.balanceOf(core.dolomiteMargin.address)).to.eq(parseEther('2').sub(1));

    await setupARBBalance(core, core.hhUser1, ONE_ETH_BI, core.dolomiteMargin);
    await setupARBBalance(core, core.hhUser2, parseEther('100'), core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.arb, ONE_ETH_BI);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await vester.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
    });
  });

  describe('#vest', () => {
    it('should work normally', async () => {
      const result = await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);
      await expectEvent(vester, result, 'Vesting', {
        owner: core.hhUser1.address,
        duration: ONE_WEEK,
        amount: ONE_ETH_BI,
        vestingId: ONE_BI,
      });
    });

    it('should work with 1 week duration', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);

      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, core.marketIds.arb, ZERO_BI);
      const newAccountNumber = BigNumber.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, 1])
      );
      await expectProtocolBalance(core, vester.address, newAccountNumber, marketId, ONE_ETH_BI);
      await expectProtocolBalance(core, vester.address, newAccountNumber, core.marketIds.arb, ONE_ETH_BI);

      const position = await vester.vestingPositions(1);
      expect(position.id).to.eq(1);
      expect(position.startTime).to.eq(await getBlockTimestamp(await ethers.provider.getBlockNumber()));
      expect(position.duration).to.eq(ONE_WEEK);
      expect(position.amount).to.eq(ONE_ETH_BI);
    });

    it('should work with 2 week duration', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK.mul(2), ONE_ETH_BI);

      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, core.marketIds.arb, ZERO_BI);
      const newAccountNumber = BigNumber.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, 1])
      );
      await expectProtocolBalance(core, vester.address, newAccountNumber, marketId, ONE_ETH_BI);
      await expectProtocolBalance(core, vester.address, newAccountNumber, core.marketIds.arb, ONE_ETH_BI);

      const position = await vester.vestingPositions(1);
      expect(position.id).to.eq(1);
      expect(position.startTime).to.eq(await getBlockTimestamp(await ethers.provider.getBlockNumber()));
      expect(position.duration).to.eq(ONE_WEEK.mul(2));
      expect(position.amount).to.eq(ONE_ETH_BI);
    });

    it('should work with 3 week duration', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK.mul(3), ONE_ETH_BI);

      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, core.marketIds.arb, ZERO_BI);
      const newAccountNumber = BigNumber.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, 1])
      );
      await expectProtocolBalance(core, vester.address, newAccountNumber, marketId, ONE_ETH_BI);
      await expectProtocolBalance(core, vester.address, newAccountNumber, core.marketIds.arb, ONE_ETH_BI);

      const position = await vester.vestingPositions(1);
      expect(position.id).to.eq(1);
      expect(position.startTime).to.eq(await getBlockTimestamp(await ethers.provider.getBlockNumber()));
      expect(position.duration).to.eq(ONE_WEEK.mul(3));
      expect(position.amount).to.eq(ONE_ETH_BI);
    });

    it('should work with 4 week duration', async () => {
      await vester.connect(core.hhUser1).vest(defaultAccountNumber, ONE_WEEK.mul(4), ONE_ETH_BI);

      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, core.marketIds.arb, ZERO_BI);
      const newAccountNumber = BigNumber.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, 1])
      );
      await expectProtocolBalance(core, vester.address, newAccountNumber, marketId, ONE_ETH_BI);
      await expectProtocolBalance(core, vester.address, newAccountNumber, core.marketIds.arb, ONE_ETH_BI);

      const position = await vester.vestingPositions(1);
      expect(position.id).to.eq(1);
      expect(position.startTime).to.eq(await getBlockTimestamp(await ethers.provider.getBlockNumber()));
      expect(position.duration).to.eq(ONE_WEEK.mul(4));
      expect(position.amount).to.eq(ONE_ETH_BI);
    });

    it('should fail if duration is less than 1 week', async () => {
      await expectThrow(vester.vest(defaultAccountNumber, ONE_WEEK.sub(1), ZERO_BI), 'Vester: Invalid duration');
    });

    it('should fail if duration is more than 4 weeks', async () => {
      await expectThrow(vester.vest(defaultAccountNumber, ONE_WEEK.mul(4).sub(1), ZERO_BI), 'Vester: Invalid duration');
    });

    it('should fail if duration not 1 week interval', async () => {
      await expectThrow(vester.vest(defaultAccountNumber, ONE_WEEK.mul(2).add(1), ZERO_BI), 'Vester: Invalid duration');
    });
  });

  describe('#closePositionAndBuyTokens', () => {
    it('should work normally', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);
      const newAccountNumber = BigNumber.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, 1])
      );
      await increase(ONE_WEEK);

      await core.tokens.arb.connect(core.hhUser2).transfer(vester.address, ONE_ETH_BI);
      const result = await vester.closePositionAndBuyTokens(1, { value: parseEther('.001') });
      await expectEvent(vester, result, 'PositionClosed', {
        owner: core.hhUser1.address,
        vestingId: ONE_BI,
      });
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1.address,
        defaultAccountNumber,
        core.marketIds.arb,
        parseEther('2')
      ); // two blocks since vesting
      await expectProtocolBalance(core, vester.address, newAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vester.address, newAccountNumber, core.marketIds.arb, ZERO_BI);

      expectEmptyPosition(await vester.vestingPositions(1));
    });

    it('should work normally with one week', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);
      const newAccountNumber = BigNumber.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, 1])
      );
      await increase(ONE_WEEK);

      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.arb.address, ONE_ETH_BI);
      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.weth.address, ONE_ETH_BI);
      await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.arb, core.testEcosystem!.testPriceOracle.address);
      await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.weth, core.testEcosystem!.testPriceOracle.address);

      await core.tokens.arb.connect(core.hhUser2).transfer(vester.address, ONE_ETH_BI);
      await vester.closePositionAndBuyTokens(1, { value: parseEther('.975') });
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1.address,
        defaultAccountNumber,
        core.marketIds.arb,
        parseEther('2')
      ); // two blocks since vesting
      await expectProtocolBalance(core, vester.address, newAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vester.address, newAccountNumber, core.marketIds.arb, ZERO_BI);

      expectEmptyPosition(await vester.vestingPositions(1));
    });

    it('should work normally with two weeks', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK.mul(2), ONE_ETH_BI);
      const newAccountNumber = BigNumber.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, 1])
      );
      await increase(ONE_WEEK.mul(2));

      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.arb.address, ONE_ETH_BI);
      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.weth.address, ONE_ETH_BI);
      await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.arb, core.testEcosystem!.testPriceOracle.address);
      await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.weth, core.testEcosystem!.testPriceOracle.address);

      await core.tokens.arb.connect(core.hhUser2).transfer(vester.address, ONE_ETH_BI);
      await vester.closePositionAndBuyTokens(1, { value: parseEther('.95') });
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1.address,
        defaultAccountNumber,
        core.marketIds.arb,
        parseEther('2')
      ); // two blocks since vesting
      await expectProtocolBalance(core, vester.address, newAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vester.address, newAccountNumber, core.marketIds.arb, ZERO_BI);

      expectEmptyPosition(await vester.vestingPositions(1));
    });

    it('should work normally with three weeks', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK.mul(3), ONE_ETH_BI);
      const newAccountNumber = BigNumber.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, 1])
      );
      await increase(ONE_WEEK.mul(3));

      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.arb.address, ONE_ETH_BI);
      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.weth.address, ONE_ETH_BI);
      await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.arb, core.testEcosystem!.testPriceOracle.address);
      await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.weth, core.testEcosystem!.testPriceOracle.address);

      await core.tokens.arb.connect(core.hhUser2).transfer(vester.address, ONE_ETH_BI);
      await vester.closePositionAndBuyTokens(1, { value: parseEther('.9') });
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1.address,
        defaultAccountNumber,
        core.marketIds.arb,
        parseEther('2')
      ); // two blocks since vesting
      await expectProtocolBalance(core, vester.address, newAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vester.address, newAccountNumber, core.marketIds.arb, ZERO_BI);

      expectEmptyPosition(await vester.vestingPositions(1));
    });

    it('should work normally with four weeks', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK.mul(4), ONE_ETH_BI);
      const newAccountNumber = BigNumber.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, 1])
      );
      await increase(ONE_WEEK.mul(4));

      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.arb.address, ONE_ETH_BI);
      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.weth.address, ONE_ETH_BI);
      await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.arb, core.testEcosystem!.testPriceOracle.address);
      await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.weth, core.testEcosystem!.testPriceOracle.address);

      await core.tokens.arb.connect(core.hhUser2).transfer(vester.address, ONE_ETH_BI);
      await vester.closePositionAndBuyTokens(1, { value: parseEther('.8') });
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1.address,
        defaultAccountNumber,
        core.marketIds.arb,
        parseEther('2')
      ); // two blocks since vesting
      await expectProtocolBalance(core, vester.address, newAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vester.address, newAccountNumber, core.marketIds.arb, ZERO_BI);

      expectEmptyPosition(await vester.vestingPositions(1));
    });

    it('should work normally with refund', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK.mul(4), ONE_ETH_BI);
      const newAccountNumber = BigNumber.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, 1])
      );
      await increase(ONE_WEEK.mul(4));

      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.arb.address, ONE_ETH_BI);
      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.weth.address, ONE_ETH_BI);
      await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.arb, core.testEcosystem!.testPriceOracle.address);
      await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.weth, core.testEcosystem!.testPriceOracle.address);

      await core.tokens.arb.connect(core.hhUser2).transfer(vester.address, ONE_ETH_BI);
      await expect(() => vester.closePositionAndBuyTokens(1, { value: parseEther('.9') })).to.changeEtherBalance(
        core.hhUser1,
        parseEther('-.8')
      );
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1.address,
        defaultAccountNumber,
        core.marketIds.arb,
        parseEther('2')
      ); // two blocks since vesting
      await expectProtocolBalance(core, vester.address, newAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vester.address, newAccountNumber, core.marketIds.arb, ZERO_BI);

      expectEmptyPosition(await vester.vestingPositions(1));
    });

    it('should fail if msg.value is not sufficient', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);
      await increase(ONE_WEEK);
      await expectThrow(
        vester.closePositionAndBuyTokens(1, { value: parseEther('.0001') }),
        'Vester: Insufficient msg.value'
      );
    });

    it('should fail if not called by position owner', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);
      await expectThrow(vester.connect(core.hhUser2).closePositionAndBuyTokens(1), 'Vester: Invalid position owner');
    });

    it('should fail if before vesting time', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);
      await expectThrow(vester.connect(core.hhUser1).closePositionAndBuyTokens(1), 'Vester: Position not vested');
    });

    it('should fail if refund call fails', async () => {});
  });

  describe('#emergencyWithdraw', () => {
    it('should work normally', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);

      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, core.marketIds.arb, ZERO_BI);
      const newAccountNumber = BigNumber.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, 1])
      );
      await expectProtocolBalance(core, vester.address, newAccountNumber, marketId, ONE_ETH_BI);
      await expectProtocolBalance(core, vester.address, newAccountNumber, core.marketIds.arb, ONE_ETH_BI);

      const result = await vester.emergencyWithdraw(1);
      await expectEvent(vester, result, 'EmergencyWithdraw', {
        owner: core.hhUser1.address,
        vestingId: ONE_BI,
      });
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, marketId, ONE_ETH_BI);
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, core.marketIds.arb, ONE_ETH_BI);
      await expectProtocolBalance(core, vester.address, newAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vester.address, newAccountNumber, core.marketIds.arb, ZERO_BI);

      expectEmptyPosition(await vester.vestingPositions(1));
    });

    it('should fail if not called by position owner', async () => {
      await expectThrow(vester.emergencyWithdraw(1), 'Vester: Invalid position owner');
      await vester.connect(core.hhUser1).vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);
      await expectThrow(vester.connect(core.hhUser2).emergencyWithdraw(1), 'Vester: Invalid position owner');
    });
  });
});
