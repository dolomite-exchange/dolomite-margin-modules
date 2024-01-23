import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { IERC20, OARB, OARB__factory, TestVesterImplementationV2 } from '../src/types';
import { depositIntoDolomiteMargin, getPartialRoundHalfUp, withdrawFromDolomiteMargin } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { MAX_UINT_256_BI, Network, ONE_BI, ONE_ETH_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { advanceByTimeDelta, getBlockTimestamp, impersonate, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectEvent, expectProtocolBalance, expectThrow, expectWalletBalance } from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  CoreProtocol,
  disableInterestAccrual,
  enableInterestAccrual,
  setupARBBalance,
  setupCoreProtocol,
  setupUSDCBalance,
  setupWETHBalance,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { createTestVesterV2Proxy } from './liquidity-mining-ecosystem-utils';
import { expectEmptyPosition } from './liquidityMining-utils';

const oldWalletWithPosition = '0x52256ef863a713Ef349ae6E97A7E8f35785145dE';
const oldWalletWithPositionNftId = '266';
const defaultAccountNumber = ZERO_BI;
const usdcAmount = BigNumber.from('100816979'); // Makes par value 100000000
const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
const ONE_WEEK = BigNumber.from('604800');
const FOUR_WEEKS = BigNumber.from('2419200');
const FORCE_CLOSE_POSITION_TAX = BigNumber.from('500');
const EMERGENCY_WITHDRAW_TAX = BigNumber.from('0');
const BASE_URI = 'ipfs://QmRVGdohkNCLeKyX6dYrxWnwcUe9EpKfRG7PxmUgsYTNSk';
const OARB_VESTER_BALANCE = BigNumber.from('198909817975055247400827'); // 198,909.817975055247400827
const ARB_VESTER_BALANCE = BigNumber.from('280014293719809481013141'); // 280,014.293719809481013141
const AVAILABLE_ARB_VESTER_BALANCE = ARB_VESTER_BALANCE.sub(OARB_VESTER_BALANCE);
const PROMISED_ARB_VESTER_BALANCE = OARB_VESTER_BALANCE;

const WETH_BALANCE = parseEther('10');

describe('VesterV2', () => {
  let snapshotId: string;

  let core: CoreProtocol;

  let vester: TestVesterImplementationV2;
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

    handler = core.hhUser5;
    vester = await createTestVesterV2Proxy(core, handler);
    nextNftId = (await vester.nextNftId()).add(1);

    oARB = await OARB__factory.connect(await vester.oARB(), core.hhUser1);

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
    await setupWETHBalance(core, core.hhUser1, parseEther('10'), core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.arb!!, ONE_ETH_BI);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, WETH_BALANCE);
    await oARB.connect(core.hhUser1).approve(vester.address, ONE_ETH_BI);

    await withdrawFromDolomiteMargin(
      core,
      core.governance,
      defaultAccountNumber,
      core.marketIds.weth,
      MAX_UINT_256_BI,
      OTHER_ADDRESS,
    );
    await expectWalletBalance(core.governance, core.tokens.weth, ZERO_BI);
    await expectWalletBalance(core.governance, core.tokens.arb!!, ZERO_BI);
    await expectWalletBalance(core.governance, oARB, ZERO_BI);
    await expectWalletBalance(vester, oARB, OARB_VESTER_BALANCE);
    await expectProtocolBalance(core, core.governance, defaultAccountNumber, core.marketIds.weth, ZERO_BI);
    await expectProtocolBalance(core, core.governance, defaultAccountNumber, core.marketIds.arb!!, ZERO_BI);

    await freezeAndGetOraclePrice(core.tokens.usdc);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initializer', () => {
    it('should work normally', async () => {
      expect(await vester.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await vester.oARB()).to.eq(oARB.address);
      expect(await vester.WETH_MARKET_ID()).to.eq(core.marketIds.weth);
      expect(await vester.ARB_MARKET_ID()).to.eq(core.marketIds.arb!);
      expect(await vester.availableArbTokens()).to.eq(AVAILABLE_ARB_VESTER_BALANCE);
      expect(await vester.promisedArbTokens()).to.eq(PROMISED_ARB_VESTER_BALANCE);
      expect(await vester.isVestingActive()).to.be.true;
      expect(await vester.forceClosePositionTax()).to.eq(FORCE_CLOSE_POSITION_TAX);
      expect(await vester.emergencyWithdrawTax()).to.eq(EMERGENCY_WITHDRAW_TAX);
      expect(await vester.baseURI()).to.eq(BASE_URI);
      expect(await vester.closePositionWindow()).to.eq(ONE_WEEK);
      expect(await vester.levelExpirationWindow()).to.eq(FOUR_WEEKS);
      expect(await vester.isHandler(core.hhUser5.address)).to.eq(true);
      expect(await vester.grandfatheredIdCutoff()).to.eq(await vester.nextNftId());
      expect(await vester.levelRequestFee()).to.eq(parseEther('0.0003'));
      expect(await vester.levelBoostThreshold()).to.eq(4);
    });

    it('should fail if already initialized', async () => {
      const bytes = ethers.utils.defaultAbiCoder.encode(['address'], [core.hhUser5.address]);
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
        vestingId: nextNftId,
      });
    });

    it('should work with different durations', async () => {
      const amount = parseEther('10');
      await oARB.connect(core.hhUser5).mint(amount);
      await oARB.connect(core.hhUser5).transfer(core.hhUser1.address, amount);

      await setupARBBalance(core, core.hhUser1, amount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.arb!!, amount);

      for (let i = 0; i <= 10; i++) {
        const duration = ONE_WEEK.mul(i === 0 ? 1 : 4);
        await oARB.connect(core.hhUser1).approve(vester.address, ONE_ETH_BI);
        await vester.connect(core.hhUser1).vest(defaultAccountNumber, duration, ONE_ETH_BI);

        await expectWalletBalance(core.hhUser1.address, oARB, parseEther((10 - i).toString()));
        await expectProtocolBalance(
          core,
          core.hhUser1.address,
          defaultAccountNumber,
          core.marketIds.arb!!,
          parseEther((10 - i).toString()),
        );
        const nextId = await vester.nextNftId();
        const vesterAccountNumber = BigNumber.from(
          ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, nextId]),
        );
        expect(await vester.ownerOf(nextId)).to.eq(core.hhUser1.address);

        const amountAtIndex = ONE_ETH_BI.mul(i + 1);
        await expectWalletBalance(vester, oARB, OARB_VESTER_BALANCE.add(amountAtIndex));
        await expectProtocolBalance(core, vester, vesterAccountNumber, core.marketIds.arb!!, ONE_ETH_BI);
        expect(await vester.promisedArbTokens()).to.eq(PROMISED_ARB_VESTER_BALANCE.add(amountAtIndex));
        expect(await vester.availableArbTokens()).to.eq(AVAILABLE_ARB_VESTER_BALANCE.sub(amountAtIndex));

        const position = await vester.vestingPositions(nextId);
        expect(position.id).to.eq(nextId);
        expect(position.startTime).to.eq(await getBlockTimestamp(await ethers.provider.getBlockNumber()));
        expect(position.duration).to.eq(duration);
        expect(position.amount).to.eq(ONE_ETH_BI);
      }
    });

    it('should fail if vester has insufficient ARB', async () => {
      const vesterSigner = await impersonate(vester.address, true);
      await core.tokens.arb!!.connect(vesterSigner).transfer(core.hhUser2.address, ARB_VESTER_BALANCE);
      await expectThrow(
        vester.connect(core.hhUser1).vest(defaultAccountNumber, ONE_WEEK.mul(4), ONE_ETH_BI),
        'VesterImplementationV2: Not enough ARB tokens available',
      );
    });

    it('should fail if duration is less than 1 week', async () => {
      await expectThrow(
        vester.vest(defaultAccountNumber, ONE_WEEK.sub(1), ZERO_BI),
        'VesterImplementationV2: Invalid duration',
      );
    });

    it('should fail if duration is more than 40 weeks', async () => {
      await expectThrow(
        vester.vest(defaultAccountNumber, ONE_WEEK.mul(40).add(1), ZERO_BI),
        'VesterImplementationV2: Invalid duration',
      );
      await expectThrow(
        vester.vest(defaultAccountNumber, ONE_WEEK.mul(41), ZERO_BI),
        'VesterImplementationV2: Invalid duration',
      );
    });

    it('should fail if duration not 1 week interval', async () => {
      await expectThrow(
        vester.vest(defaultAccountNumber, ONE_WEEK.mul(2).add(1), ZERO_BI),
        'VesterImplementationV2: Invalid duration',
      );
    });

    it('should fail if vesting is not active', async () => {
      await vester.connect(core.governance).ownerSetIsVestingActive(false);
      await expectThrow(
        vester.vest(defaultAccountNumber, ONE_WEEK.mul(2).add(1), ZERO_BI),
        'VesterImplementationV2: Vesting not active',
      );
    });
  });

  describe('#extendDurationForGrandfatheredPosition', () => {
    it('should work when the account is grandfathered', async () => {
      const signer = await impersonate(oldWalletWithPosition);
      const result = await vester.connect(signer)
        .extendDurationForGrandfatheredPosition(oldWalletWithPositionNftId, ONE_WEEK.mul(8));
      await expectEvent(vester, result, 'PositionDurationExtended', {
        id: oldWalletWithPositionNftId,
        duration: ONE_WEEK.mul(8),
      });
      const position = await vester.vestingPositions(oldWalletWithPositionNftId);
      expect(position.duration).to.eq(ONE_WEEK.mul(8));
    });

    it('should fail for invalid position owner', async () => {
      await expectThrow(
        vester.connect(core.hhUser1)
          .extendDurationForGrandfatheredPosition(oldWalletWithPositionNftId, ONE_WEEK.mul(8)),
        'VesterImplementationLibForV2: Invalid position owner',
      );
    });

    it('should fail for invalid duration increase', async () => {
      const signer = await impersonate(oldWalletWithPosition);
      await expectThrow(
        vester.connect(signer).extendDurationForGrandfatheredPosition(oldWalletWithPositionNftId, ONE_WEEK.mul(7)),
        'VesterImplementationLibForV2: Invalid duration',
      );
      await expectThrow(
        vester.connect(signer).extendDurationForGrandfatheredPosition(oldWalletWithPositionNftId, ONE_WEEK.mul(41)),
        'VesterImplementationLibForV2: Invalid duration',
      );
      await expectThrow(
        vester.connect(signer)
          .extendDurationForGrandfatheredPosition(oldWalletWithPositionNftId, ONE_WEEK.mul(8).add(1)),
        'VesterImplementationLibForV2: Invalid duration',
      );
    });

    it('should fail when position is not grandfathered', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);
      await expectThrow(
        vester.extendDurationForGrandfatheredPosition(nextNftId, ONE_WEEK.mul(8)),
        'VesterImplementationLibForV2: Invalid NFT ID',
      );
    });

    it('should fail if the position is already extended', async () => {
      const signer = await impersonate(oldWalletWithPosition);
      await vester.connect(signer).extendDurationForGrandfatheredPosition(oldWalletWithPositionNftId, ONE_WEEK.mul(8));
      const position = await vester.vestingPositions(oldWalletWithPositionNftId);
      expect(position.duration).to.eq(ONE_WEEK.mul(8));

      await expectThrow(
        vester.connect(signer).extendDurationForGrandfatheredPosition(oldWalletWithPositionNftId, ONE_WEEK.mul(9)),
        'VesterImplementationLibForV2: Position already upgraded',
      );
    });
  });

  describe('#closePositionAndBuyTokens', () => {
    it('should work normally', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);
      const vesterAccountNumber = BigNumber.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, nextNftId]),
      );

      const [ethPrice, arbPrice] = await Promise.all([
        freezeAndGetOraclePrice(core.tokens.weth),
        freezeAndGetOraclePrice(core.tokens.arb!!),
      ]);
      const arbPriceAdj = arbPrice.mul('9750').div('10000');
      const ethCost = ONE_ETH_BI.mul(arbPriceAdj).div(ethPrice);

      await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.weth.address, ethPrice);
      await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.arb!!.address, arbPrice);
      await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.weth, core.testEcosystem!.testPriceOracle.address);
      await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.arb!!, core.testEcosystem!.testPriceOracle.address);

      await increase(ONE_WEEK);

      const arbPar = await core.dolomiteMargin.getAccountPar(
        { owner: vester.address, number: vesterAccountNumber },
        core.marketIds.arb!!,
      );
      await enableInterestAccrual(core, core.marketIds.arb!!);
      await advanceByTimeDelta(86400);

      const result = await vester.closePositionAndBuyTokens(
        nextNftId,
        defaultAccountNumber,
        defaultAccountNumber,
        MAX_UINT_256_BI,
      );
      await disableInterestAccrual(core, core.marketIds.arb!!);

      const index = await core.dolomiteMargin.getMarketCurrentIndex(core.marketIds.arb!!);
      const arbWei = getPartialRoundHalfUp(arbPar.value, index.supply, ONE_ETH_BI);
      expect(arbWei).to.be.gt(ONE_ETH_BI);
      await expectEvent(vester, result, 'PositionClosed', {
        owner: core.hhUser1.address,
        vestingId: nextNftId,
        ethCostPaid: ethCost,
      });
      await expectWalletBalance(core.hhUser1.address, oARB, ZERO_BI);
      await expectWalletBalance(vester.address, oARB, PROMISED_ARB_VESTER_BALANCE);
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        core.marketIds.arb!!,
        arbWei.add(ONE_ETH_BI),
      );
      await expectProtocolBalance(core, vester, vesterAccountNumber, core.marketIds.arb!!, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        core.marketIds.weth,
        WETH_BALANCE.sub(ethCost),
      );
      await expectProtocolBalance(core, core.governance, ZERO_BI, core.marketIds.weth, ethCost);
      expect(await vester.promisedArbTokens()).to.eq(PROMISED_ARB_VESTER_BALANCE);
      expect(await vester.availableArbTokens()).to.eq(AVAILABLE_ARB_VESTER_BALANCE.sub(ONE_ETH_BI));

      expectEmptyPosition(await vester.vestingPositions(nextNftId));
      await expectThrow(
        vester.ownerOf(nextNftId),
        'ERC721: invalid token ID',
      );
    });

    it('should work normally with one week', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);
      const vesterAccountNumber = BigNumber.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, nextNftId]),
      );
      await increase(ONE_WEEK);

      await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.arb!!.address, ONE_ETH_BI);
      await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.weth.address, ONE_ETH_BI);
      await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.arb!!, core.testEcosystem!.testPriceOracle.address);
      await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.weth, core.testEcosystem!.testPriceOracle.address);

      await vester.closePositionAndBuyTokens(nextNftId, defaultAccountNumber, defaultAccountNumber, MAX_UINT_256_BI);
      await expectWalletBalance(core.hhUser1.address, oARB, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        core.marketIds.arb!!,
        parseEther('2'),
      );
      await expectWalletBalance(vester, oARB, OARB_VESTER_BALANCE);
      await expectProtocolBalance(core, vester, vesterAccountNumber, core.marketIds.arb!!, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        core.marketIds.weth,
        WETH_BALANCE.sub(parseEther('0.975')),
      );
      await expectProtocolBalance(core, core.governance, ZERO_BI, core.marketIds.weth, parseEther('0.975'));
      expect(await vester.promisedArbTokens()).to.eq(PROMISED_ARB_VESTER_BALANCE);
      expect(await vester.availableArbTokens()).to.eq(AVAILABLE_ARB_VESTER_BALANCE.sub(ONE_ETH_BI));

      expectEmptyPosition(await vester.vestingPositions(nextNftId));
      await expectThrow(
        vester.ownerOf(nextNftId),
        'ERC721: invalid token ID',
      );
    });

    it('should work normally with grandfathered position', async () => {
      const arbAmount = BigNumber.from('3365502733260383981');
      const oldSigner = await impersonate(oldWalletWithPosition);
      const vesterAccountNumber = BigNumber.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [oldSigner.address, oldWalletWithPositionNftId]),
      );
      await increase(ONE_WEEK.mul(4));

      await vester.connect(oldSigner).transferFrom(oldSigner.address, core.hhUser1.address, oldWalletWithPositionNftId);
      await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.arb!.address, ONE_ETH_BI);
      await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.weth.address, ONE_ETH_BI);
      await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.arb!, core.testEcosystem!.testPriceOracle.address);
      await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.weth, core.testEcosystem!.testPriceOracle.address);

      await vester.closePositionAndBuyTokens(
        oldWalletWithPositionNftId,
        defaultAccountNumber,
        defaultAccountNumber,
        MAX_UINT_256_BI,
      );
      await expectWalletBalance(core.hhUser1.address, oARB, ONE_ETH_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        core.marketIds.arb!,
        arbAmount.mul(2).add(ONE_ETH_BI),
      );
      await expectWalletBalance(vester, oARB, OARB_VESTER_BALANCE.sub(arbAmount));
      await expectProtocolBalance(core, vester, vesterAccountNumber, core.marketIds.arb!, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        core.marketIds.weth,
        WETH_BALANCE.sub(arbAmount.mul(8).div(10)),
      );
      await expectProtocolBalance(core, core.governance, ZERO_BI, core.marketIds.weth, arbAmount.mul(8).div(10));
      expect(await vester.promisedArbTokens()).to.eq(PROMISED_ARB_VESTER_BALANCE.sub(arbAmount));
      expect(await vester.availableArbTokens()).to.eq(AVAILABLE_ARB_VESTER_BALANCE);

      expectEmptyPosition(await vester.vestingPositions(nextNftId));
      await expectThrow(
        vester.ownerOf(nextNftId),
        'ERC721: invalid token ID',
      );
    });

    it('should work normally with accelerated vesting', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);
      const vesterAccountNumber = BigNumber.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, nextNftId]),
      );
      await increase(ONE_WEEK.mul(2).div(3));

      await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.arb!!.address, ONE_ETH_BI);
      await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.weth.address, ONE_ETH_BI);
      await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.arb!!, core.testEcosystem!.testPriceOracle.address);
      await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.weth, core.testEcosystem!.testPriceOracle.address);

      const level = 4;
      await vester.connect(handler).handlerUpdateLevel(0, core.hhUser1.address, level);
      expect(await vester.getEffectiveLevelByUser(core.hhUser1.address)).to.eq(level);

      await vester.closePositionAndBuyTokens(nextNftId, defaultAccountNumber, defaultAccountNumber, MAX_UINT_256_BI);
      await expectWalletBalance(core.hhUser1.address, oARB, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        core.marketIds.arb!,
        parseEther('2'),
      );
      await expectWalletBalance(vester, oARB, OARB_VESTER_BALANCE);
      await expectProtocolBalance(core, vester, vesterAccountNumber, core.marketIds.arb!, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        core.marketIds.weth,
        WETH_BALANCE.sub(parseEther('0.975')),
      );
      await expectProtocolBalance(core, core.governance, ZERO_BI, core.marketIds.weth, parseEther('0.975'));
      expect(await vester.promisedArbTokens()).to.eq(PROMISED_ARB_VESTER_BALANCE);
      expect(await vester.availableArbTokens()).to.eq(AVAILABLE_ARB_VESTER_BALANCE.sub(ONE_ETH_BI));

      expectEmptyPosition(await vester.vestingPositions(nextNftId));
      await expectThrow(
        vester.ownerOf(nextNftId),
        'ERC721: invalid token ID',
      );
    });

    it('should work normally with 100% discounted vesting', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK.mul(40), ONE_ETH_BI);
      const vesterAccountNumber = BigNumber.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, nextNftId]),
      );
      await increase(ONE_WEEK.mul(40).mul(2).div(3));

      await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.arb!!.address, ONE_ETH_BI);
      await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.weth.address, ONE_ETH_BI);
      await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.arb!!, core.testEcosystem!.testPriceOracle.address);
      await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.weth, core.testEcosystem!.testPriceOracle.address);

      const level = 4;
      await vester.connect(handler).handlerUpdateLevel(0, core.hhUser1.address, level);
      expect(await vester.getEffectiveLevelByUser(core.hhUser1.address)).to.eq(level);

      await vester.closePositionAndBuyTokens(nextNftId, defaultAccountNumber, defaultAccountNumber, MAX_UINT_256_BI);
      await expectWalletBalance(core.hhUser1.address, oARB, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        core.marketIds.arb!,
        parseEther('2'),
      );
      await expectWalletBalance(vester, oARB, OARB_VESTER_BALANCE);
      await expectProtocolBalance(core, vester, vesterAccountNumber, core.marketIds.arb!, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        core.marketIds.weth,
        WETH_BALANCE,
      );
      await expectProtocolBalance(core, core.governance, ZERO_BI, core.marketIds.weth, ZERO_BI);
      expect(await vester.promisedArbTokens()).to.eq(PROMISED_ARB_VESTER_BALANCE);
      expect(await vester.availableArbTokens()).to.eq(AVAILABLE_ARB_VESTER_BALANCE.sub(ONE_ETH_BI));

      expectEmptyPosition(await vester.vestingPositions(nextNftId));
      await expectThrow(
        vester.ownerOf(nextNftId),
        'ERC721: invalid token ID',
      );
    });

    it('should work normally with refund', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK.mul(4), ONE_ETH_BI);
      const vesterAccountNumber = BigNumber.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, nextNftId]),
      );
      await increase(ONE_WEEK.mul(4));

      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.arb!!.address, ONE_ETH_BI);
      await core.testEcosystem?.testPriceOracle.setPrice(core.tokens.weth.address, ONE_ETH_BI);
      await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.arb!!, core.testEcosystem!.testPriceOracle.address);
      await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.weth, core.testEcosystem!.testPriceOracle.address);

      await vester.closePositionAndBuyTokens(nextNftId, defaultAccountNumber, defaultAccountNumber, MAX_UINT_256_BI);
      await expectWalletBalance(core.hhUser1.address, oARB, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        core.marketIds.weth,
        parseEther('9.1'),
      );
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        core.marketIds.arb!,
        parseEther('2'),
      );
      await expectWalletBalance(vester, oARB, OARB_VESTER_BALANCE);
      await expectProtocolBalance(core, vester, vesterAccountNumber, core.marketIds.arb!, ZERO_BI);
      await expectProtocolBalance(core, core.governance, defaultAccountNumber, core.marketIds.weth, parseEther('0.9'));
      expect(await vester.promisedArbTokens()).to.eq(PROMISED_ARB_VESTER_BALANCE);
      expect(await vester.availableArbTokens()).to.eq(AVAILABLE_ARB_VESTER_BALANCE.sub(ONE_ETH_BI));

      expectEmptyPosition(await vester.vestingPositions(nextNftId));
      await expectThrow(
        vester.ownerOf(nextNftId),
        'ERC721: invalid token ID',
      );
    });

    it('should fail if cost is too high for max payment', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);
      await withdrawFromDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, parseEther('10'));
      await freezeAndGetOraclePrice(core.tokens.weth);
      await freezeAndGetOraclePrice(core.tokens.arb!!);
      await increase(ONE_WEEK);
      await expectThrow(
        vester.closePositionAndBuyTokens(nextNftId, defaultAccountNumber, defaultAccountNumber, ONE_BI),
        'VesterImplementationV2: Cost exceeds max payment amount',
      );
    });

    it('should fail if dolomite balance is not sufficient', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);
      await withdrawFromDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, parseEther('10'));
      await freezeAndGetOraclePrice(core.tokens.weth);
      await freezeAndGetOraclePrice(core.tokens.arb!!);
      await increase(ONE_WEEK);
      await expectThrow(
        vester.closePositionAndBuyTokens(nextNftId, defaultAccountNumber, defaultAccountNumber, MAX_UINT_256_BI),
        `AccountBalanceLib: account cannot go negative <${core.hhUser1.address.toLowerCase()}, ${defaultAccountNumber}, 0>`,
      );
    });

    it('should fail if not called by position owner', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);
      await expectThrow(
        vester.connect(core.hhUser2)
          .closePositionAndBuyTokens(nextNftId, defaultAccountNumber, defaultAccountNumber, MAX_UINT_256_BI),
        'VesterImplementationV2: Invalid position owner',
      );
    });

    it('should fail if before vesting time', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);
      await expectThrow(
        vester.connect(core.hhUser1)
          .closePositionAndBuyTokens(nextNftId, defaultAccountNumber, defaultAccountNumber, MAX_UINT_256_BI),
        'VesterImplementationV2: Position not vested',
      );
    });

    it('should fail if reentered', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);
      await expectThrow(
        vester.connect(core.hhUser1).callClosePositionAndBuyTokensAndTriggerReentrancy(
          nextNftId,
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
        ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, nextNftId]),
      );

      await freezeAndGetOraclePrice(core.tokens.weth);
      await freezeAndGetOraclePrice(core.tokens.arb!!);
      await increase(ONE_WEEK.mul(2).add(1));

      const arbPar = await core.dolomiteMargin.getAccountPar(
        { owner: vester.address, number: vesterAccountNumber },
        core.marketIds.arb!,
      );
      await enableInterestAccrual(core, core.marketIds.arb!!);
      await advanceByTimeDelta(86400);

      const result = await vester.connect(core.hhUser5).forceClosePosition(nextNftId);
      await disableInterestAccrual(core, core.marketIds.arb!!);

      const index = await core.dolomiteMargin.getMarketCurrentIndex(core.marketIds.arb!);
      const arbWei = getPartialRoundHalfUp(arbPar.value, index.supply, ONE_ETH_BI);
      expect(arbWei).to.be.gt(ONE_ETH_BI);
      await expectEvent(vester, result, 'PositionForceClosed', {
        owner: core.hhUser1.address,
        id: nextNftId,
        arbTax: parseEther('0.05'),
      });

      await expectWalletBalance(core.hhUser1.address, oARB, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        core.marketIds.arb!,
        arbWei.sub(parseEther('0.05')),
      );
      await expectProtocolBalance(core, core.governance, ZERO_BI, core.marketIds.arb!, parseEther('.05'));
      await expectWalletBalance(core.governance.address, core.tokens.arb!, ZERO_BI);
      await expectWalletBalance(vester, oARB, OARB_VESTER_BALANCE);
      await expectProtocolBalance(core, vester, vesterAccountNumber, core.marketIds.arb!, ZERO_BI);
      expect(await vester.promisedArbTokens()).to.eq(PROMISED_ARB_VESTER_BALANCE);
      expect(await vester.availableArbTokens()).to.eq(AVAILABLE_ARB_VESTER_BALANCE);

      expectEmptyPosition(await vester.vestingPositions(nextNftId));
      await expectThrow(
        vester.ownerOf(nextNftId),
        'ERC721: invalid token ID',
      );
    });

    it('should work normally if tax is zero', async () => {
      await vester.connect(core.governance).ownerSetForceClosePositionTax(0);
      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);
      const vesterAccountNumber = BigNumber.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, nextNftId]),
      );

      await freezeAndGetOraclePrice(core.tokens.weth);
      await freezeAndGetOraclePrice(core.tokens.arb!!);
      await increase(ONE_WEEK.mul(2).add(1));

      await vester.connect(core.hhUser5).forceClosePosition(nextNftId);
      await expectWalletBalance(core.hhUser1.address, oARB, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        core.marketIds.arb!,
        ONE_ETH_BI,
      );
      await expectWalletBalance(core.governance, core.tokens.arb!, ZERO_BI);
      await expectProtocolBalance(core, core.governance, ZERO_BI, core.marketIds.arb!, ZERO_BI);
      await expectWalletBalance(vester, oARB, OARB_VESTER_BALANCE);
      await expectProtocolBalance(core, vester, vesterAccountNumber, core.marketIds.arb!, ZERO_BI);
      expect(await vester.promisedArbTokens()).to.eq(PROMISED_ARB_VESTER_BALANCE);
      expect(await vester.availableArbTokens()).to.eq(AVAILABLE_ARB_VESTER_BALANCE);

      expectEmptyPosition(await vester.vestingPositions(nextNftId));
      await expectThrow(
        vester.ownerOf(nextNftId),
        'ERC721: invalid token ID',
      );
    });

    it('should fail if position is not expired', async () => {
      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);
      await increase(ONE_WEEK.mul(2).sub(2)); // Not sure why this is off by a bit
      await expectThrow(
        vester.connect(core.hhUser5).forceClosePosition(nextNftId),
        'VesterImplementationV2: Position not expired',
      );
    });

    it('should fail if not called by operator', async () => {
      await expectThrow(
        vester.connect(core.hhUser1).forceClosePosition(nextNftId),
        `OnlyDolomiteMargin: Caller is not a global operator <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#emergencyWithdraw', () => {
    it('should work normally', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);

      await expectWalletBalance(core.hhUser1.address, oARB, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, core.marketIds.arb!, ZERO_BI);
      const vesterAccountNumber = BigNumber.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, nextNftId]),
      );
      await expectWalletBalance(vester, oARB, OARB_VESTER_BALANCE.add(ONE_ETH_BI));
      await expectProtocolBalance(core, vester, vesterAccountNumber, core.marketIds.arb!, ONE_ETH_BI);

      const arbPar = await core.dolomiteMargin.getAccountPar(
        { owner: vester.address, number: vesterAccountNumber },
        core.marketIds.arb!,
      );
      await enableInterestAccrual(core, core.marketIds.arb!!);
      await advanceByTimeDelta(86400);

      const result = await vester.emergencyWithdraw(nextNftId);
      await disableInterestAccrual(core, core.marketIds.arb!!);

      const index = await core.dolomiteMargin.getMarketCurrentIndex(core.marketIds.arb!);
      const arbWei = getPartialRoundHalfUp(arbPar.value, index.supply, ONE_ETH_BI);
      expect(arbWei).to.be.gt(ONE_ETH_BI);

      await expectEvent(vester, result, 'EmergencyWithdraw', {
        owner: core.hhUser1.address,
        vestingId: nextNftId,
        arbTax: ZERO_BI,
      });
      await expectWalletBalance(core.hhUser1.address, oARB, ZERO_BI);
      await expectWalletBalance(vester, oARB, OARB_VESTER_BALANCE);
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, core.marketIds.arb!, arbWei);
      await expectProtocolBalance(core, vester, vesterAccountNumber, core.marketIds.arb!, ZERO_BI);
      expect(await vester.promisedArbTokens()).to.eq(PROMISED_ARB_VESTER_BALANCE);
      expect(await vester.availableArbTokens()).to.eq(AVAILABLE_ARB_VESTER_BALANCE);

      expectEmptyPosition(await vester.vestingPositions(nextNftId));
      await expectThrow(
        vester.ownerOf(nextNftId),
        'ERC721: invalid token ID',
      );
    });

    it('should work normally with tax', async () => {
      await vester.vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);
      await vester.connect(core.governance).ownerSetEmergencyWithdrawTax(500);

      await expectWalletBalance(core.hhUser1.address, oARB, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, core.marketIds.arb!, ZERO_BI);
      const vesterAccountNumber = BigNumber.from(
        ethers.utils.solidityKeccak256(['address', 'uint256'], [core.hhUser1.address, nextNftId]),
      );
      await expectWalletBalance(vester, oARB, OARB_VESTER_BALANCE.add(ONE_ETH_BI));
      await expectProtocolBalance(core, vester, vesterAccountNumber, core.marketIds.arb!, ONE_ETH_BI);

      const result = await vester.emergencyWithdraw(nextNftId);
      await expectEvent(vester, result, 'EmergencyWithdraw', {
        owner: core.hhUser1.address,
        vestingId: nextNftId,
        arbTax: parseEther('0.05'),
      });
      await expectWalletBalance(core.hhUser1.address, oARB, ZERO_BI);
      await expectProtocolBalance(core, core.governance, ZERO_BI, core.marketIds.arb!, parseEther('.05'));
      await expectWalletBalance(core.governance.address, core.tokens.arb!, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        core.marketIds.arb!,
        parseEther('.95'),
      );
      await expectWalletBalance(vester, oARB, OARB_VESTER_BALANCE);
      await expectProtocolBalance(core, vester, vesterAccountNumber, core.marketIds.arb!, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.governance,
        defaultAccountNumber,
        core.marketIds.arb!,
        parseEther('.05'),
      );
      await expectWalletBalance(core.governance, core.tokens.arb!, ZERO_BI);
      expect(await vester.promisedArbTokens()).to.eq(PROMISED_ARB_VESTER_BALANCE);
      expect(await vester.availableArbTokens()).to.eq(AVAILABLE_ARB_VESTER_BALANCE);

      expectEmptyPosition(await vester.vestingPositions(nextNftId));
      await expectThrow(
        vester.ownerOf(nextNftId),
        'ERC721: invalid token ID',
      );
    });

    it('should fail if not called by position owner', async () => {
      await expectThrow(
        vester.emergencyWithdraw(nextNftId),
        'ERC721: invalid token ID',
      );
      await vester.connect(core.hhUser1).vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI);

      const nftId = await getNftId(core.hhUser1);
      await expectThrow(
        vester.connect(core.hhUser2).emergencyWithdraw(nftId),
        'VesterImplementationV2: Invalid position owner',
      );
    });
  });

  describe('#initiateLevelRequest', () => {
    const EXECUTION_FEE = parseEther('0.0003');
    it('should work normally', async () => {
      const requestId = ONE_BI;
      expect(await vester.nextRequestId()).to.eq(0);

      const result = await vester.initiateLevelRequest(core.hhUser1.address, { value: EXECUTION_FEE });
      await expectEvent(vester, result, 'LevelRequestInitiated', {
        user: core.hhUser1.address,
        requestId: ONE_BI,
      });

      expect(await vester.nextRequestId()).to.eq(requestId);
      expect(await vester.getLevelRequestByUser(core.hhUser1.address)).to.eq(requestId);
    });

    it('should fail when the fee is invalid', async () => {
      await expectThrow(
        vester.initiateLevelRequest(core.hhUser1.address, { value: EXECUTION_FEE.sub(1) }),
        'VesterImplementationV2: Invalid fee',
      );
    });

    it('should fail when a request is already initiated', async () => {
      await vester.initiateLevelRequest(core.hhUser1.address, { value: EXECUTION_FEE });
      await expectThrow(
        vester.initiateLevelRequest(core.hhUser1.address, { value: EXECUTION_FEE }),
        'VesterImplementationV2: Request already initiated',
      );
    });
  });

  describe('#ownerWithdrawArb', () => {
    it('should work normally when bypasses available amount', async () => {
      await expectWalletBalance(vester, core.tokens.arb!, ARB_VESTER_BALANCE);
      await vester.connect(core.governance).ownerWithdrawArb(core.governance.address, ONE_ETH_BI, true);
      await expectWalletBalance(vester, core.tokens.arb!, ARB_VESTER_BALANCE.sub(ONE_ETH_BI));
    });

    it('should fail when cannot bypass available amount', async () => {
      await expectWalletBalance(vester, core.tokens.arb!, ARB_VESTER_BALANCE);
      await expectWalletBalance(core.hhUser3, core.tokens.arb!, ZERO_BI);

      await vester.connect(core.hhUser1).vest(defaultAccountNumber, ONE_WEEK, ONE_ETH_BI.div(2));
      await vester.connect(core.governance)
        .ownerWithdrawArb(core.hhUser3.address, AVAILABLE_ARB_VESTER_BALANCE.sub(ONE_ETH_BI.div(2)), false);
      await expectWalletBalance(vester, core.tokens.arb!, PROMISED_ARB_VESTER_BALANCE.add(ONE_ETH_BI.div(2)));
      await expectWalletBalance(core.hhUser3, core.tokens.arb!, AVAILABLE_ARB_VESTER_BALANCE.sub(ONE_ETH_BI.div(2)));

      await expectThrow(
        vester.connect(core.governance).ownerWithdrawArb(core.governance.address, ONE_ETH_BI.div(2), false),
        'VesterImplementationV2: Insufficient available tokens',
      );
    });

    it('should fail if not called by dolomite margin owner', async () => {
      await expectThrow(
        vester.connect(core.hhUser1).ownerWithdrawArb(core.governance.address, ONE_ETH_BI, true),
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
        'VesterImplementationV2: Invalid close position window',
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
        'VesterImplementationV2: Invalid emergency withdrawal tax',
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

  describe('#ownerSetLevelExpirationWindow', () => {

    const levelExpirationWindow = ONE_WEEK.mul(2);
    it('should work normally', async () => {
      const result = await vester.connect(core.governance).ownerSetLevelExpirationWindow(levelExpirationWindow);
      await expectEvent(vester, result, 'LevelExpirationWindowSet', {
        levelExpirationWindow,
      });
      expect(await vester.levelExpirationWindow()).to.eq(levelExpirationWindow);
    });

    it('should fail if not called by dolomite margin owner', async () => {
      await expectThrow(
        vester.connect(core.hhUser1).ownerSetLevelExpirationWindow(levelExpirationWindow),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if too small', async () => {
      await expectThrow(
        vester.connect(core.governance).ownerSetLevelExpirationWindow(ONE_WEEK.sub(1)),
        'VesterImplementationV2: Invalid level expiration window',
      );
    });
  });

  describe('#ownerSetLevelRequestFee', () => {
    const levelRequestFee = parseEther('0.0004');
    it('should work normally', async () => {
      const result = await vester.connect(core.governance).ownerSetLevelRequestFee(levelRequestFee);
      await expectEvent(vester, result, 'LevelRequestFeeSet', {
        levelRequestFee,
      });
      expect(await vester.levelRequestFee()).to.eq(levelRequestFee);
    });

    it('should fail if not called by dolomite margin owner', async () => {
      await expectThrow(
        vester.connect(core.hhUser1).ownerSetLevelRequestFee(levelRequestFee),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if too large', async () => {
      await expectThrow(
        vester.connect(core.governance).ownerSetLevelRequestFee(parseEther('0.1')),
        'VesterImplementationV2: Level request fee too large',
      );
    });
  });

  describe('#ownerSetLevelBoostThreshold', () => {
    const boostThreshold = 5;
    it('should work normally', async () => {
      const result = await vester.connect(core.governance).ownerSetLevelBoostThreshold(boostThreshold);
      await expectEvent(vester, result, 'LevelBoostThresholdSet', {
        boostThreshold,
      });
      expect(await vester.levelBoostThreshold()).to.eq(boostThreshold);
    });

    it('should fail if not called by dolomite margin owner', async () => {
      await expectThrow(
        vester.connect(core.hhUser1).ownerSetLevelBoostThreshold(boostThreshold),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetHandler', () => {
    let handler: string;
    before(() => {
      handler = core.hhUser4.address;
    });

    it('should work normally', async () => {
      const result1 = await vester.connect(core.governance).ownerSetHandler(handler, true);
      await expectEvent(vester, result1, 'HandlerSet', {
        handler,
        isHandler: true,
      });
      expect(await vester.isHandler(handler)).to.eq(true);

      const result2 = await vester.connect(core.governance).ownerSetHandler(handler, false);
      await expectEvent(vester, result2, 'HandlerSet', {
        handler,
        isHandler: false,
      });
      expect(await vester.isHandler(handler)).to.eq(false);
    });

    it('should fail if not called by dolomite margin owner', async () => {
      await expectThrow(
        vester.connect(core.hhUser1).ownerSetHandler(handler, true),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#handlerUpdateLevel', () => {
    it('should work normally', async () => {
      const requestId = 1;
      const level = 5;
      await vester.connect(handler).initiateLevelRequest(core.hhUser1.address, { value: parseEther('0.0003') });
      expect(await vester.getLevelRequestByUser(core.hhUser1.address)).to.eq(requestId);

      const result = await vester.connect(handler).handlerUpdateLevel(requestId, core.hhUser1.address, level);
      await expectEvent(vester, result, 'LevelRequestFinalized', {
        user: core.hhUser1.address,
        _requestId: requestId,
        _level: level,
      });

      expect(await vester.getLevelRequestByUser(core.hhUser1.address)).to.eq(0);
      expect(await vester.getLevelByUser(core.hhUser1.address)).to.eq(level);
      expect(await vester.getEffectiveLevelByUser(core.hhUser1.address)).to.eq(level);

      await advanceByTimeDelta(ONE_WEEK.mul(4).add(1).toNumber());
      expect(await vester.getEffectiveLevelByUser(core.hhUser1.address)).to.eq(0);
    });

    it('should work when forced update', async () => {
      const requestId = 0;
      const level = 5;
      expect(await vester.getLevelRequestByUser(core.hhUser1.address)).to.eq(requestId);

      const result = await vester.connect(handler).handlerUpdateLevel(requestId, core.hhUser1.address, level);
      await expectEvent(vester, result, 'LevelRequestFinalized', {
        user: core.hhUser1.address,
        _requestId: requestId,
        _level: level,
      });

      expect(await vester.getLevelRequestByUser(core.hhUser1.address)).to.eq(0);
      expect(await vester.getLevelByUser(core.hhUser1.address)).to.eq(level);
    });

    it('should fail when called with an invalid request ID', async () => {
      await expectThrow(
        vester.connect(handler).handlerUpdateLevel(123, core.hhUser1.address, 5),
        'VesterImplementationV2: Invalid request ID',
      );
    });

    it('should fail when not called by handler', async () => {
      await expectThrow(
        vester.handlerUpdateLevel(0, core.hhUser1.address, 5),
        `VesterImplementationV2: Invalid handler <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#handlerWithdrawETH', () => {
    it('should work normally', async () => {
      const value = parseEther('0.0003');
      await vester.connect(handler).initiateLevelRequest(core.hhUser1.address, { value });

      await vester.connect(handler).handlerWithdrawETH(OTHER_ADDRESS);
      expect(await ethers.provider.getBalance(OTHER_ADDRESS)).to.eq(value);
    });

    it('should fail when not called by handler', async () => {
      await expectThrow(
        vester.handlerWithdrawETH(core.hhUser1.address),
        `VesterImplementationV2: Invalid handler <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  async function getNftId(signer: SignerWithAddress): Promise<BigNumber> {
    const filter = vester.filters.VestingStarted(signer.address);
    return (await vester.queryFilter(filter))[0].args.vestingId;
  }

  async function freezeAndGetOraclePrice(token: IERC20): Promise<BigNumber> {
    const marketId = await core.dolomiteMargin.getMarketIdByTokenAddress(token.address);
    const price = await core.dolomiteMargin.getMarketPrice(marketId);
    await core.testEcosystem!.testPriceOracle.setPrice(token.address, price.value);
    await core.dolomiteMargin.ownerSetPriceOracle(marketId, core.testEcosystem!.testPriceOracle.address);
    return price.value;
  }
});
