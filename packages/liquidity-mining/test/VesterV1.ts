import {
  depositIntoDolomiteMargin,
  getPartialRoundHalfUp,
  withdrawFromDolomiteMargin,
} from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import {
  MAX_UINT_256_BI,
  Network,
  ONE_BI,
  ONE_ETH_BI,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  advanceByTimeDelta,
  getBlockTimestamp,
  impersonate,
  revertToSnapshotAndCapture,
  snapshot,
} from '@dolomite-exchange/modules-base/test/utils';
import {
  expectEvent,
  expectProtocolBalance,
  expectThrow,
  expectWalletBalance,
} from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  disableInterestAccrual,
  enableInterestAccrual,
  setupARBBalance,
  setupCoreProtocol,
  setupUSDCBalance,
  setupWETHBalance,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { CoreProtocolArbitrumOne } from '../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { IERC20, OARB, TestVesterImplementationV1 } from '../src/types';
import { createOARB, createTestVesterV1Proxy } from './liquidity-mining-ecosystem-utils';
import { expectEmptyPosition } from './liquidity-mining-utils';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
const defaultAccountNumber = ZERO_BI;
const usdcAmount = BigNumber.from('100816979'); // Makes par value 100000000
const ONE_WEEK = BigNumber.from('604800');
const FORCE_CLOSE_POSITION_TAX = BigNumber.from('500');
const EMERGENCY_WITHDRAW_TAX = BigNumber.from('0');
const BASE_URI = 'oARB LIQUIDITY MINING RULEZ';

const WETH_BALANCE = parseEther('10');

describe('VesterV1', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;

  let vester: TestVesterImplementationV1;
  let oToken: OARB;
  let pairMarketId: BigNumberish;
  let pairToken: IERC20;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 114_200_000,
      network: Network.ArbitrumOne,
    });
    pairMarketId = core.marketIds.arb!;
    pairToken = core.tokens.arb!;
    await disableInterestAccrual(core, core.marketIds.usdc);
    await disableInterestAccrual(core, pairMarketId);
    await disableInterestAccrual(core, core.marketIds.weth);
    await disableInterestAccrual(core, pairMarketId);

    const wethPrice = await core.dolomiteMargin.getMarketPrice(core.marketIds.weth);
    const usdcPrice = await core.dolomiteMargin.getMarketPrice(core.marketIds.usdc);
    const pairPrice = await core.dolomiteMargin.getMarketPrice(pairMarketId);
    await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.weth.address, wethPrice.value);
    await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.usdc.address, usdcPrice.value);
    await core.testEcosystem!.testPriceOracle.setPrice(pairToken.address, pairPrice.value);
    await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.weth, core.testEcosystem!.testPriceOracle.address);
    await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.usdc, core.testEcosystem!.testPriceOracle.address);
    await core.dolomiteMargin.ownerSetPriceOracle(pairMarketId, core.testEcosystem!.testPriceOracle.address);

    oToken = await createOARB(core);
    vester = await createTestVesterV1Proxy(core, oToken, BASE_URI);

    await setupUSDCBalance(core, core.hhUser1, usdcAmount.mul(2), core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.usdc, usdcAmount);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(vester.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(core.hhUser5.address, true);

    await oToken.connect(core.hhUser5).mint(ONE_ETH_BI);
    await oToken.connect(core.hhUser5).transfer(core.hhUser1.address, ONE_ETH_BI);
    await expectWalletBalance(core.hhUser1.address, oToken, ONE_ETH_BI);
    await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, core.marketIds.usdc, usdcAmount);

    await setupARBBalance(core, core.hhUser1, ONE_ETH_BI, core.dolomiteMargin);
    await setupARBBalance(core, core.hhUser2, parseEther('100'), core.dolomiteMargin);
    await setupWETHBalance(core, core.hhUser1, parseEther('10'), core.dolomiteMargin);
    await pairToken.connect(core.hhUser2).transfer(vester.address, ONE_ETH_BI);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, pairMarketId, ONE_ETH_BI);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, WETH_BALANCE);
    await oToken.connect(core.hhUser1).approve(vester.address, ONE_ETH_BI);

    await expectWalletBalance(core.governance, core.tokens.weth, ZERO_BI);
    await expectWalletBalance(core.governance, pairToken, ZERO_BI);
    await expectWalletBalance(core.governance, oToken, ZERO_BI);
    await expectProtocolBalance(core, core.governance, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
    await expectProtocolBalance(core, core.governance, defaultAccountNumber, pairMarketId, ZERO_BI);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initializer', () => {
    it('should work normally', async () => {
      expect(await vester.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await vester.oToken()).to.eq(oToken.address);
      expect(await vester.WETH_MARKET_ID()).to.eq(core.marketIds.weth);
      expect(await vester.PAIR_MARKET_ID()).to.eq(pairMarketId);
      expect(await vester.availableTokens()).to.eq(ONE_ETH_BI);
      expect(await vester.availableTokens()).to.eq(ONE_ETH_BI);
      expect(await vester.isVestingActive()).to.be.true;
      expect(await vester.forceClosePositionTax()).to.eq(FORCE_CLOSE_POSITION_TAX);
      expect(await vester.emergencyWithdrawTax()).to.eq(EMERGENCY_WITHDRAW_TAX);
      expect(await vester.baseURI()).to.eq(BASE_URI);
    });

    it('should fail if already initialized', async () => {
      const bytes = ethers.utils.defaultAbiCoder.encode(['address', 'string'], [ZERO_ADDRESS, 'hello there']);
      await expectThrow(
        vester.connect(core.governance).initialize(bytes),
        'Initializable: contract is already initialized',
      );
    });
  });

  describe('#vest', () => {
    it('should work normally', async () => {
      const result = await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);
      await expectEvent(vester, result, 'VestingStarted', {
        owner: core.hhUser1.address,
        duration: ONE_WEEK,
        amount: ONE_ETH_BI,
        vestingId: ONE_BI,
      });
    });

    it('should work with 1 week duration', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);

      await expectWalletBalance(core.hhUser1.address, oToken, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, pairMarketId, ZERO_BI);
      const vesterAccountNumber = BigNumber.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, 1]),
      );
      expect(await vester.ownerOf(1)).to.eq(core.hhUser1.address);
      await expectWalletBalance(vester, oToken, ONE_ETH_BI);
      await expectProtocolBalance(core, vester, vesterAccountNumber, pairMarketId, ONE_ETH_BI);
      expect(await vester.promisedTokens()).to.eq(ONE_ETH_BI);
      expect(await vester.availableTokens()).to.eq(ZERO_BI);

      const position = await vester.vestingPositions(1);
      expect(position.id).to.eq(1);
      expect(position.startTime).to.eq(await getBlockTimestamp(await ethers.provider.getBlockNumber()));
      expect(position.duration).to.eq(ONE_WEEK);
      expect(position.amount).to.eq(ONE_ETH_BI);
    });

    it('should work with 2 week duration', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK.mul(2), ONE_ETH_BI);

      await expectWalletBalance(core.hhUser1.address, oToken, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, pairMarketId, ZERO_BI);
      const vesterAccountNumber = BigNumber.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, 1]),
      );
      expect(await vester.ownerOf(1)).to.eq(core.hhUser1.address);
      await expectWalletBalance(vester, oToken, ONE_ETH_BI);
      await expectProtocolBalance(core, vester, vesterAccountNumber, pairMarketId, ONE_ETH_BI);
      expect(await vester.promisedTokens()).to.eq(ONE_ETH_BI);
      expect(await vester.availableTokens()).to.eq(ZERO_BI);

      const position = await vester.vestingPositions(1);
      expect(position.id).to.eq(1);
      expect(position.startTime).to.eq(await getBlockTimestamp(await ethers.provider.getBlockNumber()));
      expect(position.duration).to.eq(ONE_WEEK.mul(2));
      expect(position.amount).to.eq(ONE_ETH_BI);
    });

    it('should work with 3 week duration', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK.mul(3), ONE_ETH_BI);

      await expectWalletBalance(core.hhUser1.address, oToken, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, pairMarketId, ZERO_BI);
      const vesterAccountNumber = BigNumber.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, 1]),
      );
      expect(await vester.ownerOf(1)).to.eq(core.hhUser1.address);
      await expectWalletBalance(vester, oToken, ONE_ETH_BI);
      await expectProtocolBalance(core, vester, vesterAccountNumber, pairMarketId, ONE_ETH_BI);
      expect(await vester.promisedTokens()).to.eq(ONE_ETH_BI);
      expect(await vester.availableTokens()).to.eq(ZERO_BI);

      const position = await vester.vestingPositions(1);
      expect(position.id).to.eq(1);
      expect(position.startTime).to.eq(await getBlockTimestamp(await ethers.provider.getBlockNumber()));
      expect(position.duration).to.eq(ONE_WEEK.mul(3));
      expect(position.amount).to.eq(ONE_ETH_BI);
    });

    it('should work with 4 week duration', async () => {
      await vester.connect(core.hhUser1).vest(defaultAccountNumber, ONE_WEEK.mul(4), ONE_ETH_BI);

      await expectWalletBalance(core.hhUser1.address, oToken, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, pairMarketId, ZERO_BI);
      const vesterAccountNumber = BigNumber.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, 1]),
      );
      expect(await vester.ownerOf(1)).to.eq(core.hhUser1.address);
      await expectWalletBalance(vester, oToken, ONE_ETH_BI);
      await expectProtocolBalance(core, vester, vesterAccountNumber, pairMarketId, ONE_ETH_BI);
      expect(await vester.promisedTokens()).to.eq(ONE_ETH_BI);
      expect(await vester.availableTokens()).to.eq(ZERO_BI);

      const position = await vester.vestingPositions(1);
      expect(position.id).to.eq(1);
      expect(position.startTime).to.eq(await getBlockTimestamp(await ethers.provider.getBlockNumber()));
      expect(position.duration).to.eq(ONE_WEEK.mul(4));
      expect(position.amount).to.eq(ONE_ETH_BI);
    });

    it('should fail if vester has insufficient PAIR_TOKEN', async () => {
      const vesterSigner = await impersonate(vester.address, true);
      await pairToken.connect(vesterSigner).transfer(core.hhUser2.address, parseEther('.5'));
      await expectThrow(
        vester.connect(core.hhUser1).vest(defaultAccountNumber, ONE_WEEK.mul(4), ONE_ETH_BI),
        'VesterImplementationV1: Not enough rewards available',
      );
    });

    it('should fail if duration is less than 1 week', async () => {
      await expectThrow(
        vester.vest(defaultAccountNumber, ONE_WEEK.sub(1), ZERO_BI),
        'VesterImplementationV1: Invalid duration',
      );
    });

    it('should fail if duration is more than 4 weeks', async () => {
      await expectThrow(
        vester.vest(defaultAccountNumber, ONE_WEEK.mul(4).add(1), ZERO_BI),
        'VesterImplementationV1: Invalid duration',
      );
    });

    it('should fail if duration not 1 week interval', async () => {
      await expectThrow(
        vester.vest(defaultAccountNumber, ONE_WEEK.mul(2).add(1), ZERO_BI),
        'VesterImplementationV1: Invalid duration',
      );
    });

    it('should fail if vesting is not active', async () => {
      await vester.connect(core.governance).ownerSetIsVestingActive(false);
      await expectThrow(
        vester.vest(defaultAccountNumber, ONE_WEEK.mul(2).add(1), ZERO_BI),
        'VesterImplementationV1: Vesting not active',
      );
    });
  });

  describe('#closePositionAndBuyTokens', () => {
    it('should work normally', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);
      const vesterAccountNumber = BigNumber.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, 1]),
      );
      await increase(ONE_WEEK);

      const ethPrice = (await core.dolomiteMargin.getMarketPrice(core.marketIds.weth)).value;
      const pairPrice = (await core.dolomiteMargin.getMarketPrice(pairMarketId)).value;
      const ethCost = ONE_ETH_BI.mul(pairPrice).div(ethPrice).mul('9750').div('10000');

      const pairPar = await core.dolomiteMargin.getAccountPar(
        { owner: vester.address, number: vesterAccountNumber },
        pairMarketId,
      );
      await enableInterestAccrual(core, pairMarketId);
      await advanceByTimeDelta(86400);

      const result = await vester.closePositionAndBuyTokens(
        1,
        defaultAccountNumber,
        defaultAccountNumber,
        MAX_UINT_256_BI,
      );
      await disableInterestAccrual(core, pairMarketId);

      const index = await core.dolomiteMargin.getMarketCurrentIndex(pairMarketId);
      const pairWei = getPartialRoundHalfUp(pairPar.value, index.supply, ONE_ETH_BI);
      expect(pairWei).to.be.gt(ONE_ETH_BI);
      await expectEvent(vester, result, 'PositionClosed', {
        owner: core.hhUser1.address,
        vestingId: ONE_BI,
        ethCostPaid: ethCost,
      });
      await expectWalletBalance(core.hhUser1.address, oToken, ZERO_BI);
      await expectWalletBalance(vester.address, oToken, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        pairMarketId,
        pairWei.add(ONE_ETH_BI),
      );
      await expectProtocolBalance(core, vester, vesterAccountNumber, pairMarketId, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        core.marketIds.weth,
        WETH_BALANCE.sub(ethCost),
      );
      await expectProtocolBalance(core, core.governance, ZERO_BI, core.marketIds.weth, ethCost);
      expect(await vester.promisedTokens()).to.eq(ZERO_BI);
      expect(await vester.availableTokens()).to.eq(ZERO_BI);

      expectEmptyPosition(await vester.vestingPositions(1));
      await expectThrow(
        vester.ownerOf(1),
        'ERC721: invalid token ID',
      );
    });

    it('should work normally with one week', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);
      const vesterAccountNumber = BigNumber.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, 1]),
      );
      await increase(ONE_WEEK);

      await core.testEcosystem?.testPriceOracle.setPrice(pairToken.address, ONE_ETH_BI);
      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.weth.address, ONE_ETH_BI);
      await core.dolomiteMargin.ownerSetPriceOracle(pairMarketId, core.testEcosystem!.testPriceOracle.address);
      await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.weth, core.testEcosystem!.testPriceOracle.address);

      await vester.closePositionAndBuyTokens(1, defaultAccountNumber, defaultAccountNumber, MAX_UINT_256_BI);
      await expectWalletBalance(core.hhUser1.address, oToken, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        pairMarketId,
        parseEther('2'),
      );
      await expectWalletBalance(vester, oToken, ZERO_BI);
      await expectProtocolBalance(core, vester, vesterAccountNumber, pairMarketId, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        core.marketIds.weth,
        WETH_BALANCE.sub(parseEther('0.975')),
      );
      await expectProtocolBalance(core, core.governance, ZERO_BI, core.marketIds.weth, parseEther('0.975'));
      expect(await vester.promisedTokens()).to.eq(ZERO_BI);
      expect(await vester.availableTokens()).to.eq(ZERO_BI);

      expectEmptyPosition(await vester.vestingPositions(1));
      await expectThrow(
        vester.ownerOf(1),
        'ERC721: invalid token ID',
      );
    });

    it('should work normally with two weeks', async () => {
      const duration = ONE_WEEK.mul(2);
      await vester.vest(defaultAccountNumber, duration, ONE_ETH_BI);
      const vesterAccountNumber = BigNumber.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, 1]),
      );
      await increase(duration);

      await core.testEcosystem?.testPriceOracle.setPrice(pairToken.address, ONE_ETH_BI);
      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.weth.address, ONE_ETH_BI);
      await core.dolomiteMargin.ownerSetPriceOracle(pairMarketId, core.testEcosystem!.testPriceOracle.address);
      await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.weth, core.testEcosystem!.testPriceOracle.address);

      await vester.closePositionAndBuyTokens(1, defaultAccountNumber, defaultAccountNumber, MAX_UINT_256_BI);
      await expectWalletBalance(core.hhUser1.address, oToken, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        pairMarketId,
        parseEther('2'),
      );
      await expectWalletBalance(vester, oToken, ZERO_BI);
      await expectProtocolBalance(core, vester, vesterAccountNumber, pairMarketId, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        core.marketIds.weth,
        WETH_BALANCE.sub(parseEther('0.95')),
      );
      await expectProtocolBalance(core, core.governance, ZERO_BI, core.marketIds.weth, parseEther('0.95'));
      expect(await vester.promisedTokens()).to.eq(ZERO_BI);
      expect(await vester.availableTokens()).to.eq(ZERO_BI);

      expectEmptyPosition(await vester.vestingPositions(1));
      await expectThrow(
        vester.ownerOf(1),
        'ERC721: invalid token ID',
      );
    });

    it('should work normally with three weeks', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK.mul(3), ONE_ETH_BI);
      const vesterAccountNumber = BigNumber.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, 1]),
      );
      await increase(ONE_WEEK.mul(3));

      await core.testEcosystem?.testPriceOracle.setPrice(pairToken.address, ONE_ETH_BI);
      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.weth.address, ONE_ETH_BI);
      await core.dolomiteMargin.ownerSetPriceOracle(pairMarketId, core.testEcosystem!.testPriceOracle.address);
      await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.weth, core.testEcosystem!.testPriceOracle.address);

      await vester.closePositionAndBuyTokens(1, defaultAccountNumber, defaultAccountNumber, MAX_UINT_256_BI);
      await expectWalletBalance(core.hhUser1.address, oToken, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        pairMarketId,
        parseEther('2'),
      );
      await expectWalletBalance(vester, oToken, ZERO_BI);
      await expectProtocolBalance(core, vester, vesterAccountNumber, pairMarketId, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        core.marketIds.weth,
        WETH_BALANCE.sub(parseEther('0.90')),
      );
      await expectProtocolBalance(core, core.governance, ZERO_BI, core.marketIds.weth, parseEther('0.90'));
      expect(await vester.promisedTokens()).to.eq(ZERO_BI);
      expect(await vester.availableTokens()).to.eq(ZERO_BI);

      expectEmptyPosition(await vester.vestingPositions(1));
      await expectThrow(
        vester.ownerOf(1),
        'ERC721: invalid token ID',
      );
    });

    it('should work normally with four weeks', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK.mul(4), ONE_ETH_BI);
      const vesterAccountNumber = BigNumber.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, 1]),
      );
      await increase(ONE_WEEK.mul(4));

      await core.testEcosystem?.testPriceOracle.setPrice(pairToken.address, ONE_ETH_BI);
      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.weth.address, ONE_ETH_BI);
      await core.dolomiteMargin.ownerSetPriceOracle(pairMarketId, core.testEcosystem!.testPriceOracle.address);
      await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.weth, core.testEcosystem!.testPriceOracle.address);

      await vester.closePositionAndBuyTokens(1, defaultAccountNumber, defaultAccountNumber, MAX_UINT_256_BI);
      await expectWalletBalance(core.hhUser1.address, oToken, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        pairMarketId,
        parseEther('2'),
      );
      await expectWalletBalance(vester, oToken, ZERO_BI);
      await expectProtocolBalance(core, vester, vesterAccountNumber, pairMarketId, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        core.marketIds.weth,
        WETH_BALANCE.sub(parseEther('0.8')),
      );
      await expectProtocolBalance(core, core.governance, ZERO_BI, core.marketIds.weth, parseEther('0.8'));
      expect(await vester.promisedTokens()).to.eq(ZERO_BI);
      expect(await vester.availableTokens()).to.eq(ZERO_BI);

      expectEmptyPosition(await vester.vestingPositions(1));
      await expectThrow(
        vester.ownerOf(1),
        'ERC721: invalid token ID',
      );
    });

    it('should work normally with refund', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK.mul(4), ONE_ETH_BI);
      const vesterAccountNumber = BigNumber.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, 1]),
      );
      await increase(ONE_WEEK.mul(4));

      await core.testEcosystem?.testPriceOracle.setPrice(pairToken.address, ONE_ETH_BI);
      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.weth.address, ONE_ETH_BI);
      await core.dolomiteMargin.ownerSetPriceOracle(pairMarketId, core.testEcosystem!.testPriceOracle.address);
      await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.weth, core.testEcosystem!.testPriceOracle.address);

      await vester.closePositionAndBuyTokens(1, defaultAccountNumber, defaultAccountNumber, MAX_UINT_256_BI);
      await expectWalletBalance(core.hhUser1.address, oToken, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        core.marketIds.weth,
        parseEther('9.2'),
      );
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        pairMarketId,
        parseEther('2'),
      );
      await expectWalletBalance(vester, oToken, ZERO_BI);
      await expectProtocolBalance(core, vester, vesterAccountNumber, pairMarketId, ZERO_BI);
      expect(await vester.promisedTokens()).to.eq(ZERO_BI);
      expect(await vester.availableTokens()).to.eq(ZERO_BI);

      expectEmptyPosition(await vester.vestingPositions(1));
      await expectThrow(
        vester.ownerOf(1),
        'ERC721: invalid token ID',
      );
    });

    it('should fail if cost is too high for max payment', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);
      await withdrawFromDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, parseEther('10'));
      await increase(ONE_WEEK);
      await expectThrow(
        vester.closePositionAndBuyTokens(1, defaultAccountNumber, defaultAccountNumber, ONE_BI),
        'VesterImplementationV1: Cost exceeds max payment amount',
      );
    });

    it('should fail if dolomite balance is not sufficient', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);
      await withdrawFromDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, parseEther('10'));
      await increase(ONE_WEEK);
      await expectThrow(
        vester.closePositionAndBuyTokens(1, defaultAccountNumber, defaultAccountNumber, MAX_UINT_256_BI),
        `AccountBalanceLib: account cannot go negative <${core.hhUser1.address.toLowerCase()}, ${defaultAccountNumber}, 0>`,
      );
    });

    it('should fail if not called by position owner', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);
      await expectThrow(
        vester.connect(core.hhUser2)
          .closePositionAndBuyTokens(1, defaultAccountNumber, defaultAccountNumber, MAX_UINT_256_BI),
        'VesterImplementationV1: Invalid position owner',
      );
    });

    it('should fail if before vesting time', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);
      await expectThrow(
        vester.connect(core.hhUser1)
          .closePositionAndBuyTokens(1, defaultAccountNumber, defaultAccountNumber, MAX_UINT_256_BI),
        'VesterImplementationV1: Position not vested',
      );
    });

    it('should fail if position is expired', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);
      await increase(ONE_WEEK.mul(2).add(1));
      await expectThrow(
        vester.connect(core.hhUser1)
          .closePositionAndBuyTokens(1, defaultAccountNumber, defaultAccountNumber, MAX_UINT_256_BI),
        'VesterImplementationV1: Position expired',
      );
    });

    it('should fail if reentered', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);
      await expectThrow(
        vester.connect(core.hhUser1).callClosePositionAndBuyTokensAndTriggerReentrancy(
          1,
          defaultAccountNumber,
          defaultAccountNumber,
          MAX_UINT_256_BI,
        ),
        'ReentrancyGuard: reentrant call',
      );
    });
  });

  describe('#forceClosePosition', () => {
    it('should work normally', async () => {
      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);
      const vesterAccountNumber = BigNumber.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, 1]),
      );
      await increase(ONE_WEEK.mul(2).add(1));

      const pairPar = await core.dolomiteMargin.getAccountPar(
        { owner: vester.address, number: vesterAccountNumber },
        pairMarketId,
      );
      await enableInterestAccrual(core, pairMarketId);
      await advanceByTimeDelta(86400);

      const result = await vester.connect(core.hhUser5).forceClosePosition(1);
      await disableInterestAccrual(core, pairMarketId);

      const index = await core.dolomiteMargin.getMarketCurrentIndex(pairMarketId);
      const pairWei = getPartialRoundHalfUp(pairPar.value, index.supply, ONE_ETH_BI);
      expect(pairWei).to.be.gt(ONE_ETH_BI);
      await expectEvent(vester, result, 'PositionForceClosed', {
        owner: core.hhUser1.address,
        id: 1,
        pairTax: parseEther('0.05'),
      });

      await expectWalletBalance(core.hhUser1.address, oToken, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        pairMarketId,
        pairWei.sub(parseEther('0.05')),
      );
      await expectProtocolBalance(core, core.governance, ZERO_BI, pairMarketId, parseEther('.05'));
      await expectWalletBalance(core.governance.address, pairToken, ZERO_BI);
      await expectWalletBalance(vester, oToken, ZERO_BI);
      await expectProtocolBalance(core, vester, vesterAccountNumber, pairMarketId, ZERO_BI);
      expect(await vester.promisedTokens()).to.eq(ZERO_BI);
      expect(await vester.availableTokens()).to.eq(ONE_ETH_BI);

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
      const vesterAccountNumber = BigNumber.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, 1]),
      );
      await increase(ONE_WEEK.mul(2).add(1));

      await vester.connect(core.hhUser5).forceClosePosition(1);
      await expectWalletBalance(core.hhUser1.address, oToken, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        pairMarketId,
        ONE_ETH_BI,
      );
      await expectWalletBalance(core.governance, pairToken, ZERO_BI);
      await expectProtocolBalance(core, core.governance, ZERO_BI, pairMarketId, ZERO_BI);
      await expectWalletBalance(vester, oToken, ZERO_BI);
      await expectProtocolBalance(core, vester, vesterAccountNumber, pairMarketId, ZERO_BI);
      expect(await vester.promisedTokens()).to.eq(ZERO_BI);
      expect(await vester.availableTokens()).to.eq(ONE_ETH_BI);

      expectEmptyPosition(await vester.vestingPositions(1));
      await expectThrow(
        vester.ownerOf(1),
        'ERC721: invalid token ID',
      );
    });

    it('should fail if position is not expired', async () => {
      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);
      await increase(ONE_WEEK.mul(2).sub(2)); // Not sure why this is off by a bit
      await expectThrow(
        vester.connect(core.hhUser5).forceClosePosition(1),
        'VesterImplementationV1: Position not expired',
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

      await expectWalletBalance(core.hhUser1.address, oToken, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, pairMarketId, ZERO_BI);
      const vesterAccountNumber = BigNumber.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, 1]),
      );
      await expectWalletBalance(vester, oToken, ONE_ETH_BI);
      await expectProtocolBalance(core, vester, vesterAccountNumber, pairMarketId, ONE_ETH_BI);

      const pairPar = await core.dolomiteMargin.getAccountPar(
        { owner: vester.address, number: vesterAccountNumber },
        pairMarketId,
      );
      await enableInterestAccrual(core, pairMarketId);
      await advanceByTimeDelta(86400);

      const result = await vester.emergencyWithdraw(1);
      await disableInterestAccrual(core, pairMarketId);

      const index = await core.dolomiteMargin.getMarketCurrentIndex(pairMarketId);
      const pairWei = getPartialRoundHalfUp(pairPar.value, index.supply, ONE_ETH_BI);
      expect(pairWei).to.be.gt(ONE_ETH_BI);

      await expectEvent(vester, result, 'EmergencyWithdraw', {
        owner: core.hhUser1.address,
        vestingId: ONE_BI,
        pairTax: ZERO_BI,
      });
      await expectWalletBalance(core.hhUser1.address, oToken, ZERO_BI);
      await expectWalletBalance(vester, oToken, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, pairMarketId, pairWei);
      await expectProtocolBalance(core, vester, vesterAccountNumber, pairMarketId, ZERO_BI);
      expect(await vester.promisedTokens()).to.eq(ZERO_BI);
      expect(await vester.availableTokens()).to.eq(ONE_ETH_BI);

      expectEmptyPosition(await vester.vestingPositions(1));
      await expectThrow(
        vester.ownerOf(1),
        'ERC721: invalid token ID',
      );
    });

    it('should work normally with tax', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);
      await vester.connect(core.governance).ownerSetEmergencyWithdrawTax(500);

      await expectWalletBalance(core.hhUser1.address, oToken, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, pairMarketId, ZERO_BI);
      const vesterAccountNumber = BigNumber.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, 1]),
      );
      await expectWalletBalance(vester, oToken, ONE_ETH_BI);
      await expectProtocolBalance(core, vester, vesterAccountNumber, pairMarketId, ONE_ETH_BI);

      const result = await vester.emergencyWithdraw(1);
      await expectEvent(vester, result, 'EmergencyWithdraw', {
        owner: core.hhUser1.address,
        vestingId: ONE_BI,
        pairTax: parseEther('0.05'),
      });
      await expectWalletBalance(core.hhUser1.address, oToken, ZERO_BI);
      await expectProtocolBalance(core, core.governance, ZERO_BI, pairMarketId, parseEther('.05'));
      await expectWalletBalance(core.governance.address, pairToken, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        pairMarketId,
        parseEther('.95'),
      );
      await expectWalletBalance(vester, oToken, ZERO_BI);
      await expectProtocolBalance(core, vester, vesterAccountNumber, pairMarketId, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.governance,
        defaultAccountNumber,
        pairMarketId,
        parseEther('.05'),
      );
      await expectWalletBalance(core.governance, pairToken, ZERO_BI);
      expect(await vester.promisedTokens()).to.eq(ZERO_BI);
      expect(await vester.availableTokens()).to.eq(ONE_ETH_BI);

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
        'VesterImplementationV1: Invalid position owner',
      );
    });
  });

  describe('#ownerSetForceClosePositionTax', () => {
    it('should fail if tax is greater than base', async () => {
      await expectThrow(
        vester.connect(core.governance).ownerSetForceClosePositionTax(100_000),
        'VesterImplementationV1: Invalid force close position tax',
      );
    });

    it('should fail if not called by dolomite margin owner', async () => {
      await expectThrow(
        vester.connect(core.hhUser1).ownerSetForceClosePositionTax(500),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerWithdrawToken', () => {
    it('should work normally when bypasses available amount', async () => {
      await expectWalletBalance(vester, pairToken, ONE_ETH_BI);
      await vester.connect(core.governance).ownerWithdrawToken(core.governance.address, ONE_ETH_BI, true);
      await expectWalletBalance(vester, pairToken, ZERO_BI);
    });

    it('should work normally when bypasses available amount', async () => {
      await expectWalletBalance(vester, pairToken, ONE_ETH_BI);
      await expectWalletBalance(core.hhUser3, pairToken, ZERO_BI);

      await vester.connect(core.hhUser1).vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI.div(2));
      await vester.connect(core.governance).ownerWithdrawToken(core.hhUser3.address, ONE_ETH_BI.div(2), false);
      await expectWalletBalance(vester, pairToken, ONE_ETH_BI.div(2));
      await expectWalletBalance(core.hhUser3, pairToken, ONE_ETH_BI.div(2));

      await expectThrow(
        vester.connect(core.governance).ownerWithdrawToken(core.governance.address, ONE_ETH_BI.div(2), false),
        'VesterImplementationV1: Insufficient available tokens',
      );
    });

    it('should fail if not called by dolomite margin owner', async () => {
      await expectThrow(
        vester.connect(core.hhUser1).ownerWithdrawToken(core.governance.address, ONE_ETH_BI, true),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetIsVestingActive', () => {
    it('should work normally', async () => {
      expect(await vester.isVestingActive()).to.eq(true);
      const result = await vester.connect(core.governance).ownerSetIsVestingActive(false);
      await expectEvent(vester, result, 'VestingActiveSet', {
        isVestingActive: false,
      });
      expect(await vester.isVestingActive()).to.eq(false);
    });

    it('should fail if not called by dolomite margin owner', async () => {
      await expectThrow(
        vester.connect(core.hhUser1).ownerSetIsVestingActive(false),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetOToken', () => {
    it('should work normally', async () => {
      const result = await vester.connect(core.governance).ownerSetOToken(OTHER_ADDRESS);
      await expectEvent(vester, result, 'OTokenSet', {
        oToken: OTHER_ADDRESS,
      });
      expect(await vester.oToken()).to.eq(OTHER_ADDRESS);
    });

    it('should fail promisedTokens > 0', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);
      await expectThrow(
        vester.connect(core.governance).ownerSetOToken(OTHER_ADDRESS),
        'VesterImplementationV1: Outstanding vesting positions',
      );
    });

    it('should fail if not called by dolomite margin owner', async () => {
      await expectThrow(
        vester.connect(core.hhUser1).ownerSetOToken(OTHER_ADDRESS),
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
        'VesterImplementationV1: Invalid close position window',
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
        vester.connect(core.governance).ownerSetEmergencyWithdrawTax(10_001),
        'VesterImplementationV1: Invalid emergency withdrawal tax',
      );
    });

    it('should fail if not called by dolomite margin owner', async () => {
      await expectThrow(
        vester.connect(core.hhUser1).ownerSetEmergencyWithdrawTax(100),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetBaseURI', () => {
    const baseURI = 'hello';
    it('should work normally', async () => {
      const result = await vester.connect(core.governance).ownerSetBaseURI(baseURI);
      await expectEvent(vester, result, 'BaseURISet', {
        baseURI,
      });
      expect(await vester.baseURI()).to.eq(baseURI);
    });

    it('should fail if not called by dolomite margin owner', async () => {
      await expectThrow(
        vester.connect(core.hhUser1).ownerSetBaseURI(baseURI),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#tokenURI', () => {
    it('should work normally', async () => {
      const baseURI = 'hello';
      await vester.connect(core.governance).ownerSetBaseURI(baseURI);
      await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);
      expect(await vester.tokenURI(1)).to.eq('hello');
    });

    it('should fail if tokenId is not minted', async () => {
      await expectThrow(
        vester.tokenURI(1),
        'ERC721: invalid token ID',
      );
    });
  });
});
