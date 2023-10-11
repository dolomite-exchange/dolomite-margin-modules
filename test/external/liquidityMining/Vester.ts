import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { OARB, OARB__factory, TestVester, TestVester__factory } from 'src/types';
import { createContractWithAbi, depositIntoDolomiteMargin } from 'src/utils/dolomite-utils';
import { Network, ONE_BI, ONE_ETH_BI, ZERO_BI } from 'src/utils/no-deps-constants';
import { getBlockTimestamp, impersonate, revertToSnapshotAndCapture, snapshot } from 'test/utils';
import { expectEvent, expectProtocolBalance, expectThrow, expectWalletBalance } from 'test/utils/assertions';
import {
  CoreProtocol,
  disableInterestAccrual,
  getDefaultCoreProtocolConfig,
  setupARBBalance,
  setupCoreProtocol,
  setupUSDCBalance,
} from 'test/utils/setup';
import { expectEmptyPosition } from './liquidityMining-utils';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
const defaultAccountNumber = ZERO_BI;
const usdcAmount = BigNumber.from('100816979'); // Makes par value 100000000
const ONE_WEEK = BigNumber.from('604800');

describe('Vester', () => {
  let snapshotId: string;

  let core: CoreProtocol;

  let vester: TestVester;
  let oARB: OARB;
  let startTime: number;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    await disableInterestAccrual(core, core.marketIds.usdc);
    await disableInterestAccrual(core, core.marketIds.arb);

    oARB = await createContractWithAbi<OARB>(OARB__factory.abi, OARB__factory.bytecode, [core.dolomiteMargin.address]);

    startTime = await getBlockTimestamp(await ethers.provider.getBlockNumber()) + 200;
    vester = await createContractWithAbi<TestVester>(
      TestVester__factory.abi,
      TestVester__factory.bytecode,
      [
        core.dolomiteMargin.address,
        core.dolomiteRegistry.address,
        core.tokens.weth.address,
        core.tokens.arb.address,
        oARB.address,
      ],
    );

    await setupUSDCBalance(core, core.hhUser1, usdcAmount.mul(2), core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.usdc, usdcAmount);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(vester.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(core.hhUser5.address, true);

    await oARB.connect(core.hhUser5).mint(ONE_ETH_BI);
    await oARB.connect(core.hhUser5).transfer(core.hhUser1.address, ONE_ETH_BI);
    await expectWalletBalance(core.hhUser1.address, oARB, ONE_ETH_BI);
    await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, core.marketIds.usdc, usdcAmount);

    await setupARBBalance(core, core.hhUser1, ONE_ETH_BI, core.dolomiteMargin);
    await setupARBBalance(core, core.hhUser2, parseEther('100'), core.dolomiteMargin);
    await core.tokens.arb.connect(core.hhUser2).transfer(vester.address, ONE_ETH_BI);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.arb, ONE_ETH_BI);
    await oARB.connect(core.hhUser1).approve(vester.address, ONE_ETH_BI);
    await vester.connect(core.governance).ownerSetVestingActive(true);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await vester.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await vester.oARB()).to.eq(oARB.address);
      expect(await vester.WETH_MARKET_ID()).to.eq(core.marketIds.weth);
      expect(await vester.ARB_MARKET_ID()).to.eq(core.marketIds.arb);
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

      await expectWalletBalance(core.hhUser1.address, oARB, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, core.marketIds.arb, ZERO_BI);
      const newAccountNumber = BigNumber.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, 1])
      );
      expect(await vester.ownerOf(1)).to.eq(core.hhUser1.address);
      await expectWalletBalance(vester.address, oARB, ONE_ETH_BI);
      await expectProtocolBalance(core, vester.address, newAccountNumber, core.marketIds.arb, ONE_ETH_BI);
      expect(await vester.promisedArbTokens()).to.eq(ONE_ETH_BI);

      const position = await vester.vestingPositions(1);
      expect(position.id).to.eq(1);
      expect(position.startTime).to.eq(await getBlockTimestamp(await ethers.provider.getBlockNumber()));
      expect(position.duration).to.eq(ONE_WEEK);
      expect(position.amount).to.eq(ONE_ETH_BI);
    });

    it('should work with 2 week duration', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK.mul(2), ONE_ETH_BI);

      await expectWalletBalance(core.hhUser1.address, oARB, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, core.marketIds.arb, ZERO_BI);
      const newAccountNumber = BigNumber.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, 1])
      );
      expect(await vester.ownerOf(1)).to.eq(core.hhUser1.address);
      await expectWalletBalance(vester.address, oARB, ONE_ETH_BI);
      await expectProtocolBalance(core, vester.address, newAccountNumber, core.marketIds.arb, ONE_ETH_BI);
      expect(await vester.promisedArbTokens()).to.eq(ONE_ETH_BI);

      const position = await vester.vestingPositions(1);
      expect(position.id).to.eq(1);
      expect(position.startTime).to.eq(await getBlockTimestamp(await ethers.provider.getBlockNumber()));
      expect(position.duration).to.eq(ONE_WEEK.mul(2));
      expect(position.amount).to.eq(ONE_ETH_BI);
    });

    it('should work with 3 week duration', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK.mul(3), ONE_ETH_BI);

      await expectWalletBalance(core.hhUser1.address, oARB, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, core.marketIds.arb, ZERO_BI);
      const newAccountNumber = BigNumber.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, 1])
      );
      expect(await vester.ownerOf(1)).to.eq(core.hhUser1.address);
      await expectWalletBalance(vester.address, oARB, ONE_ETH_BI);
      await expectProtocolBalance(core, vester.address, newAccountNumber, core.marketIds.arb, ONE_ETH_BI);
      expect(await vester.promisedArbTokens()).to.eq(ONE_ETH_BI);

      const position = await vester.vestingPositions(1);
      expect(position.id).to.eq(1);
      expect(position.startTime).to.eq(await getBlockTimestamp(await ethers.provider.getBlockNumber()));
      expect(position.duration).to.eq(ONE_WEEK.mul(3));
      expect(position.amount).to.eq(ONE_ETH_BI);
    });

    it('should work with 4 week duration', async () => {
      await vester.connect(core.hhUser1).vest(defaultAccountNumber, ONE_WEEK.mul(4), ONE_ETH_BI);

      await expectWalletBalance(core.hhUser1.address, oARB, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, core.marketIds.arb, ZERO_BI);
      const newAccountNumber = BigNumber.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, 1])
      );
      expect(await vester.ownerOf(1)).to.eq(core.hhUser1.address);
      await expectWalletBalance(vester.address, oARB, ONE_ETH_BI);
      await expectProtocolBalance(core, vester.address, newAccountNumber, core.marketIds.arb, ONE_ETH_BI);
      expect(await vester.promisedArbTokens()).to.eq(ONE_ETH_BI);

      const position = await vester.vestingPositions(1);
      expect(position.id).to.eq(1);
      expect(position.startTime).to.eq(await getBlockTimestamp(await ethers.provider.getBlockNumber()));
      expect(position.duration).to.eq(ONE_WEEK.mul(4));
      expect(position.amount).to.eq(ONE_ETH_BI);
    });

    it('should fail if vester has insufficient ARB', async () => {
      const vesterSigner = await impersonate(vester.address, true);
      await core.tokens.arb.connect(vesterSigner).transfer(core.hhUser2.address, parseEther('.5'));
      await expectThrow(
        vester.connect(core.hhUser1).vest(defaultAccountNumber, ONE_WEEK.mul(4), ONE_ETH_BI),
        'Vester: Arb tokens currently unavailable',
      );
    });

    it('should fail if duration is less than 1 week', async () => {
      await expectThrow(
        vester.vest(defaultAccountNumber, ONE_WEEK.sub(1), ZERO_BI),
        'Vester: Invalid duration',
      );
    });

    it('should fail if duration is more than 4 weeks', async () => {
      await expectThrow(
        vester.vest(defaultAccountNumber, ONE_WEEK.mul(4).sub(1), ZERO_BI),
        'Vester: Invalid duration',
      );
    });

    it('should fail if duration not 1 week interval', async () => {
      await expectThrow(
        vester.vest(defaultAccountNumber, ONE_WEEK.mul(2).add(1), ZERO_BI),
        'Vester: Invalid duration',
      );
    });

    it('should fail if vesting is not active', async () => {
      await vester.connect(core.governance).ownerSetVestingActive(false);
      await expectThrow(
        vester.vest(defaultAccountNumber, ONE_WEEK.mul(2).add(1), ZERO_BI),
        'Vester: Vesting not active',
      );
    });
  });

  describe('#closePositionAndBuyTokens', () => {
    it('should work normally', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);
      const newAccountNumber = BigNumber.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, 1])
      );
      await increase(ONE_WEEK);

      const result = await vester.closePositionAndBuyTokens(1, { value: parseEther('.001') });
      await expectEvent(vester, result, 'PositionClosed', {
        owner: core.hhUser1.address,
        vestingId: ONE_BI,
      });
      await expectWalletBalance(core.hhUser1.address, oARB, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1.address,
        defaultAccountNumber,
        core.marketIds.arb,
        parseEther('2')
      );
      await expectWalletBalance(vester.address, oARB, ZERO_BI);
      await expectProtocolBalance(core, vester.address, newAccountNumber, core.marketIds.arb, ZERO_BI);
      expect(await vester.promisedArbTokens()).to.eq(ZERO_BI);

      expectEmptyPosition(await vester.vestingPositions(1));
      await expectThrow(
        vester.ownerOf(1),
        'ERC721: invalid token ID',
      );
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

      await vester.closePositionAndBuyTokens(1, { value: parseEther('.975') });
      await expectWalletBalance(core.hhUser1.address, oARB, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1.address,
        defaultAccountNumber,
        core.marketIds.arb,
        parseEther('2')
      );
      await expectWalletBalance(vester.address, oARB, ZERO_BI);
      await expectProtocolBalance(core, vester.address, newAccountNumber, core.marketIds.arb, ZERO_BI);
      expect(await vester.promisedArbTokens()).to.eq(ZERO_BI);

      expectEmptyPosition(await vester.vestingPositions(1));
      await expectThrow(
        vester.ownerOf(1),
        'ERC721: invalid token ID',
      );
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

      await vester.closePositionAndBuyTokens(1, { value: parseEther('.95') });
      await expectWalletBalance(core.hhUser1.address, oARB, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1.address,
        defaultAccountNumber,
        core.marketIds.arb,
        parseEther('2')
      );
      await expectWalletBalance(vester.address, oARB, ZERO_BI);
      await expectProtocolBalance(core, vester.address, newAccountNumber, core.marketIds.arb, ZERO_BI);
      expect(await vester.promisedArbTokens()).to.eq(ZERO_BI);

      expectEmptyPosition(await vester.vestingPositions(1));
      await expectThrow(
        vester.ownerOf(1),
        'ERC721: invalid token ID',
      );
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

      await vester.closePositionAndBuyTokens(1, { value: parseEther('.9') });
      await expectWalletBalance(core.hhUser1.address, oARB, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1.address,
        defaultAccountNumber,
        core.marketIds.arb,
        parseEther('2')
      );
      await expectWalletBalance(vester.address, oARB, ZERO_BI);
      await expectProtocolBalance(core, vester.address, newAccountNumber, core.marketIds.arb, ZERO_BI);
      expect(await vester.promisedArbTokens()).to.eq(ZERO_BI);

      expectEmptyPosition(await vester.vestingPositions(1));
      await expectThrow(
        vester.ownerOf(1),
        'ERC721: invalid token ID',
      );
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

      await vester.closePositionAndBuyTokens(1, { value: parseEther('.8') });
      await expectWalletBalance(core.hhUser1.address, oARB, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1.address,
        defaultAccountNumber,
        core.marketIds.arb,
        parseEther('2')
      );
      await expectWalletBalance(vester.address, oARB, ZERO_BI);
      await expectProtocolBalance(core, vester.address, newAccountNumber, core.marketIds.arb, ZERO_BI);
      expect(await vester.promisedArbTokens()).to.eq(ZERO_BI);

      expectEmptyPosition(await vester.vestingPositions(1));
      await expectThrow(
        vester.ownerOf(1),
        'ERC721: invalid token ID',
      );
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

      await expect(() => vester.closePositionAndBuyTokens(
        1,
        { value: parseEther('.9') }
      )).to.changeEtherBalance(core.hhUser1, parseEther('-.8'));
      await expectWalletBalance(core.hhUser1.address, oARB, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1.address,
        defaultAccountNumber,
        core.marketIds.arb,
        parseEther('2')
      );
      await expectWalletBalance(vester.address, oARB, ZERO_BI);
      await expectProtocolBalance(core, vester.address, newAccountNumber, core.marketIds.arb, ZERO_BI);
      expect(await vester.promisedArbTokens()).to.eq(ZERO_BI);

      expectEmptyPosition(await vester.vestingPositions(1));
      await expectThrow(
        vester.ownerOf(1),
        'ERC721: invalid token ID',
      );
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

    it('should fail if position is expired', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);
      increase(ONE_WEEK.mul(2).add(1));
      await expectThrow(
        vester.connect(core.hhUser1).closePositionAndBuyTokens(1),
        'Vester: Position expired',
      );
    });

    it('should fail if reentered', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);
      await expectThrow(
        vester.connect(core.hhUser1).callClosePositionAndBuyTokensAndTriggerReentrancy(1),
        'ReentrancyGuard: reentrant call',
      );
    });
  });

  describe('#forceClosePosition', () => {
    it('should work normally', async () => {
      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);
      const newAccountNumber = BigNumber.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, 1])
      );
      increase(ONE_WEEK.mul(2).add(1));

      await vester.connect(core.hhUser5).forceClosePosition(1);
      await expectWalletBalance(core.hhUser1.address, oARB, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1.address,
        defaultAccountNumber,
        core.marketIds.arb,
        parseEther('.95')
      );
      await expectWalletBalance(core.governance.address, core.tokens.arb, parseEther('.05'));
      await expectWalletBalance(vester.address, oARB, ZERO_BI);
      await expectProtocolBalance(core, vester.address, newAccountNumber, core.marketIds.arb, ZERO_BI);
      expect(await vester.promisedArbTokens()).to.eq(ZERO_BI);

      expectEmptyPosition(await vester.vestingPositions(1));
      await expectThrow(
        vester.ownerOf(1),
        'ERC721: invalid token ID',
      );
    });

    it('should work normally if tax is zero', async () => {
      await vester.connect(core.governance).ownerSetForceClosePositionTax(0);
      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);
      const newAccountNumber = BigNumber.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, 1])
      );
      increase(ONE_WEEK.mul(2).add(1));

      await vester.connect(core.hhUser5).forceClosePosition(1);
      await expectWalletBalance(core.hhUser1.address, oARB, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1.address,
        defaultAccountNumber,
        core.marketIds.arb,
        ONE_ETH_BI,
      );
      await expectWalletBalance(core.governance.address, core.tokens.arb, ZERO_BI);
      await expectWalletBalance(vester.address, oARB, ZERO_BI);
      await expectProtocolBalance(core, vester.address, newAccountNumber, core.marketIds.arb, ZERO_BI);
      expect(await vester.promisedArbTokens()).to.eq(ZERO_BI);

      expectEmptyPosition(await vester.vestingPositions(1));
      await expectThrow(
        vester.ownerOf(1),
        'ERC721: invalid token ID',
      );
    });

    it('should fail if position is not expired', async () => {
      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);
      increase(ONE_WEEK.mul(2));
      await expectThrow(
        vester.connect(core.hhUser5).forceClosePosition(1),
        'Vester: Position not expired',
      );
    });

    it('should fail if not called by operator', async () => {
      await expectThrow(
        vester.connect(core.hhUser1).forceClosePosition(1),
        `OnlyDolomiteMargin: Caller is not a global operator <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#emergencyWithdraw', () => {
    it('should work normally', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);

      await expectWalletBalance(core.hhUser1.address, oARB, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, core.marketIds.arb, ZERO_BI);
      const newAccountNumber = BigNumber.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, 1])
      );
      await expectWalletBalance(vester.address, oARB, ONE_ETH_BI);
      await expectProtocolBalance(core, vester.address, newAccountNumber, core.marketIds.arb, ONE_ETH_BI);

      const result = await vester.emergencyWithdraw(1);
      await expectEvent(vester, result, 'EmergencyWithdraw', {
        owner: core.hhUser1.address,
        vestingId: ONE_BI,
      });
      await expectWalletBalance(core.hhUser1.address, oARB, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, core.marketIds.arb, ONE_ETH_BI);
      await expectWalletBalance(vester.address, oARB, ZERO_BI);
      await expectProtocolBalance(core, vester.address, newAccountNumber, core.marketIds.arb, ZERO_BI);
      expect(await vester.promisedArbTokens()).to.eq(ZERO_BI);

      expectEmptyPosition(await vester.vestingPositions(1));
      await expectThrow(
        vester.ownerOf(1),
        'ERC721: invalid token ID',
      );
    });

    it('should work normally with tax', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);
      await vester.connect(core.governance).ownerSetEmergencyWithdrawTax(50);

      await expectWalletBalance(core.hhUser1.address, oARB, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, core.marketIds.arb, ZERO_BI);
      const newAccountNumber = BigNumber.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, 1])
      );
      await expectWalletBalance(vester.address, oARB, ONE_ETH_BI);
      await expectProtocolBalance(core, vester.address, newAccountNumber, core.marketIds.arb, ONE_ETH_BI);

      const result = await vester.emergencyWithdraw(1);
      await expectEvent(vester, result, 'EmergencyWithdraw', {
        owner: core.hhUser1.address,
        vestingId: ONE_BI,
      });
      await expectWalletBalance(core.hhUser1.address, oARB, ZERO_BI);
      await expectWalletBalance(core.governance.address, core.tokens.arb, parseEther('.05'));
      await expectProtocolBalance(
        core,
        core.hhUser1.address,
        defaultAccountNumber,
        core.marketIds.arb,
        parseEther('.95')
      );
      await expectWalletBalance(vester.address, oARB, ZERO_BI);
      await expectProtocolBalance(core, vester.address, newAccountNumber, core.marketIds.arb, ZERO_BI);
      expect(await vester.promisedArbTokens()).to.eq(ZERO_BI);

      expectEmptyPosition(await vester.vestingPositions(1));
      await expectThrow(
        vester.ownerOf(1),
        'ERC721: invalid token ID',
      );
    });

    it('should fail if not called by position owner', async () => {
      await expectThrow(
        vester.emergencyWithdraw(1),
        'ERC721: invalid token ID',
      );
      await vester.connect(core.hhUser1).vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);
      await expectThrow(
        vester.connect(core.hhUser2).emergencyWithdraw(1),
        'Vester: Invalid position owner',
      );
    });
  });

  describe('#ownerSetVestingActive', () => {
    it('should work normally', async () => {
      expect(await vester.vestingActive()).to.eq(true);
      const result = await vester.connect(core.governance).ownerSetVestingActive(false);
      await expectEvent(vester, result, 'VestingActiveSet', {
        vestingActive: false,
      });
      expect(await vester.vestingActive()).to.eq(false);
    });

    it('should fail if not called by dolomite margin owner', async () => {
      await expectThrow(
        vester.connect(core.hhUser1).ownerSetVestingActive(false),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetOARB', () => {
    it('should work normally', async () => {
      const result = await vester.connect(core.governance).ownerSetOARB(OTHER_ADDRESS);
      await expectEvent(vester, result, 'OARBSet', {
        oARB: OTHER_ADDRESS,
      });
      expect(await vester.oARB()).to.eq(OTHER_ADDRESS);
    });

    it('should fail promisedArbTokens > 0', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);
      await expectThrow(
        vester.connect(core.governance).ownerSetOARB(OTHER_ADDRESS),
        'Vester: Outstanding vesting positions',
      );
    });

    it('should fail if not called by dolomite margin owner', async () => {
      await expectThrow(
        vester.connect(core.hhUser1).ownerSetOARB(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetClosePositionWindow', () => {
    it('should work normally', async () => {
      const result = await vester.connect(core.governance).ownerSetClosePositionWindow(ONE_WEEK.mul(2));
      await expectEvent(vester, result, 'ClosePositionWindowSet', {
        closePositionWindow: ONE_WEEK.mul(2),
      });
      expect(await vester.closePositionWindow()).to.eq(ONE_WEEK.mul(2));
    });

    it('should fail less than min duration', async () => {
      await expectThrow(
        vester.connect(core.governance).ownerSetClosePositionWindow(ONE_WEEK.sub(1)),
        'Vester: Invalid close position window',
      );
    });

    it('should fail if not called by dolomite margin owner', async () => {
      await expectThrow(
        vester.connect(core.hhUser1).ownerSetClosePositionWindow(ONE_WEEK),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetEmergencyWithdrawTax', () => {
    it('should work normally', async () => {
      const result = await vester.connect(core.governance).ownerSetEmergencyWithdrawTax(100);
      await expectEvent(vester, result, 'EmergencyWithdrawTaxSet', {
        emergencyWithdrawTax: 100,
      });
      expect(await vester.emergencyWithdrawTax()).to.eq(100);
    });

    it('should fail if outside of range', async () => {
      await expectThrow(
        vester.connect(core.governance).ownerSetEmergencyWithdrawTax(1001),
        'Vester: Invalid emergency withdrawal tax',
      );
    });

    it('should fail if not called by dolomite margin owner', async () => {
      await expectThrow(
        vester.connect(core.hhUser1).ownerSetEmergencyWithdrawTax(100),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetForceClosePositionTax', () => {
    it('should work normally', async () => {
      const result = await vester.connect(core.governance).ownerSetForceClosePositionTax(100);
      await expectEvent(vester, result, 'ForceClosePositionTaxSet', {
        forceClosePositionTax: 100,
      });
      expect(await vester.forceClosePositionTax()).to.eq(100);
    });

    it('should fail if outside of range', async () => {
      await expectThrow(
        vester.connect(core.governance).ownerSetForceClosePositionTax(1001),
        'Vester: Invalid force close position tax',
      );
    });

    it('should fail if not called by dolomite margin owner', async () => {
      await expectThrow(
        vester.connect(core.hhUser1).ownerSetForceClosePositionTax(100),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });
});
