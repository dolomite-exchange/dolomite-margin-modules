import { ADDRESS_ZERO, MAX_UINT_256_BI, Network, ONE_ETH_BI, ONE_WEEK_SECONDS } from 'packages/base/src/utils/no-deps-constants';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import { setupCoreProtocol, setupUSDCBalance } from 'packages/base/test/utils/setup';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { getBlockTimestamp, impersonate, revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectEvent, expectThrow } from 'packages/base/test/utils/assertions';
import { expect } from 'chai';
import { IDolomitePriceOracle, IERC20, IERC20Metadata__factory, VeExternalVesterImplementationV2, VeExternalVesterImplementationV2__factory } from '../src/types';
import { defaultAbiCoder, parseEther } from 'ethers/lib/utils';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';
import { BigNumber, BigNumberish } from 'ethers';
import { ethers } from 'hardhat';
import { convertToNearestWeek } from './tokenomics-utils';
import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';

const ONE_WEEK = BigNumber.from('604800');
const TWO_YEARS = ONE_WEEK.mul(104);
const NO_MARKET_ID = MAX_UINT_256_BI;

const PAIR_AMOUNT = ONE_ETH_BI;
const MAX_PAIR_AMOUNT = PAIR_AMOUNT.mul(11).div(10); // 10% increase
const FLOOR_PRICE_START_TIMESTAMP = 1_785_124_800; // July 27
const NFT_ID = BigNumber.from('4625');

const PAYMENT_TOKEN_PRICE = BigNumber.from('1000000000000000000000000000000'); // $1.00 in USDC
const REWARD_TOKEN_PRICE = parseEther('.02')

describe('VeExternalVesterV3', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;

  let vesterImplementation: VeExternalVesterImplementationV2;
  let vester: VeExternalVesterImplementationV2;
  let dao: SignerWithAddressWithSafety;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.Berachain,
      blockNumber: 23_467_500,
    });

    vesterImplementation = await createContractWithAbi<VeExternalVesterImplementationV2>(
      VeExternalVesterImplementationV2__factory.abi,
      VeExternalVesterImplementationV2__factory.bytecode,
      [
        core.dolomiteMargin.address,
        core.dolomiteRegistry.address,
        await core.tokenomics.veExternalVester.PAIR_TOKEN(), // dolo
        await core.tokenomics.veExternalVester.PAIR_MARKET_ID(),
        await core.tokenomics.veExternalVester.PAYMENT_TOKEN(), // usdc
        await core.tokenomics.veExternalVester.PAYMENT_MARKET_ID(),
        await core.tokenomics.veExternalVester.REWARD_TOKEN(), // dolo
        await core.tokenomics.veExternalVester.REWARD_MARKET_ID(),
        FLOOR_PRICE_START_TIMESTAMP
      ]
    );

    const testPriceOracle = core.testEcosystem!.testPriceOracle;
    await testPriceOracle.setPrice(core.tokens.usdc.address, PAYMENT_TOKEN_PRICE);
    await testPriceOracle.setPrice(core.tokens.usdc.address, PAYMENT_TOKEN_PRICE);
    await testPriceOracle.setPrice(core.tokens.dolo.address, REWARD_TOKEN_PRICE);
    await testPriceOracle.setPrice(core.tokens.honey.address, ONE_ETH_BI);
    await testPriceOracle.setPrice(core.tokens.usdt.address, ONE_ETH_BI);
    await setPriceOracle(core.tokens.usdc, core.marketIds.usdc, testPriceOracle);
    await setPriceOracle(core.tokens.dolo, core.marketIds.dolo, testPriceOracle);
    await setPriceOracle(core.tokens.honey, core.marketIds.honey, testPriceOracle);
    await setPriceOracle(core.tokens.usdt, core.marketIds.usdt, testPriceOracle);

    // Upgrade the vester
    await core.tokenomics.veExternalVesterProxy.connect(core.governance).upgradeTo(vesterImplementation.address);
    vester = VeExternalVesterImplementationV2__factory.connect(
      core.tokenomics.veExternalVesterProxy.address,
      core.governance
    );

    // Transfer DOLO and oDOLO to core.hhUser1
    const dao = await impersonate(core.daoAddress!, true);
    await core.tokens.dolo.connect(dao).transfer(core.hhUser1.address, PAIR_AMOUNT);
    const rollingClaimsImpersonator = await impersonate(core.tokenomics.rollingClaims.address, true);
    await core.tokenomics.oDolo.connect(rollingClaimsImpersonator).transfer(core.hhUser1.address, PAIR_AMOUNT);

    await setupUSDCBalance(core, core.hhUser1, BigNumber.from('100000000'), vester);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await vester.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await vester.DOLOMITE_REGISTRY()).to.eq(core.dolomiteRegistry.address);
      expect(await vester.PAYMENT_TOKEN()).to.eq(core.tokens.usdc.address);
      expect(await vester.PAIR_TOKEN()).to.eq(core.tokens.dolo.address);
      expect(await vester.REWARD_TOKEN()).to.eq(core.tokens.dolo.address);
      expect(await vester.PAYMENT_MARKET_ID()).to.eq(core.marketIds.usdc);
      expect(await vester.PAIR_MARKET_ID()).to.eq(MAX_UINT_256_BI);
      expect(await vester.REWARD_MARKET_ID()).to.eq(MAX_UINT_256_BI);
      expect(await vester.FLOOR_PRICE_START_TIME()).to.eq(FLOOR_PRICE_START_TIMESTAMP);
    });
  });

  describe('#initializer', () => {
    it('should be initialized', async () => {
      await expectThrow(
        vester.connect(core.governance).initialize(
          defaultAbiCoder.encode(['address'], [core.tokenomics.oDolo.address]),
        ),
        'Initializable: contract is already initialized'
      );
    });
  });

  describe('#lazyInitialize', () => {
    it('should fail', async () => {
      await expectThrow(
        vester.connect(core.governance).lazyInitialize(
          core.tokenomics.veVesterDiscountCalculator.address,
          core.tokenomics.veDolo.address,
        ),
        'VeExternalVesterImplementationV2: veToken already initialized'
      );
    });
  });

  describe('#closePositionAndBuyTokens', () => {
    it('should work normally before floor price start time', async () => {
      await core.tokens.dolo.connect(core.hhUser1).approve(vester.address, PAIR_AMOUNT);
      await core.tokenomics.oDolo.connect(core.hhUser1).approve(vester.address, PAIR_AMOUNT);

      const promisedTokens = await vester.promisedTokens();
      const availableTokens = await vester.availableTokens();
      const result = await vester.connect(core.hhUser1).vest(ONE_WEEK_SECONDS, PAIR_AMOUNT, MAX_PAIR_AMOUNT);

      expect(await vester.promisedTokens()).to.eq(promisedTokens.add(PAIR_AMOUNT));
      expect(await vester.availableTokens()).to.eq(availableTokens.sub(PAIR_AMOUNT));
      await expectEvent(vester, result, 'VestingStarted', {
        owner: core.hhUser1.address,
        duration: ONE_WEEK_SECONDS,
        oTokenAmount: PAIR_AMOUNT,
        pairAmount: PAIR_AMOUNT,
        vestingId: NFT_ID,
      });

      const maxPaymentAmount = BigNumber.from('11000'); // .011 USDC. It is a little less than 50% discount at 2 cent DOLO

      const timestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());
      await increase(ONE_WEEK);
      await vester.connect(core.hhUser1).closePositionAndBuyTokens(
        NFT_ID,
        MAX_UINT_256_BI,
        convertToNearestWeek(BigNumber.from(timestamp), TWO_YEARS),
        maxPaymentAmount,
      );
    });

    it('should work normally after floor price start time', async () => {
      await core.tokens.dolo.connect(core.hhUser1).approve(vester.address, PAIR_AMOUNT);
      await core.tokenomics.oDolo.connect(core.hhUser1).approve(vester.address, PAIR_AMOUNT);

      const promisedTokens = await vester.promisedTokens();
      const availableTokens = await vester.availableTokens();
      const result = await vester.connect(core.hhUser1).vest(ONE_WEEK_SECONDS, PAIR_AMOUNT, MAX_PAIR_AMOUNT);

      expect(await vester.promisedTokens()).to.eq(promisedTokens.add(PAIR_AMOUNT));
      expect(await vester.availableTokens()).to.eq(availableTokens.sub(PAIR_AMOUNT));
      await expectEvent(vester, result, 'VestingStarted', {
        owner: core.hhUser1.address,
        duration: ONE_WEEK_SECONDS,
        oTokenAmount: PAIR_AMOUNT,
        pairAmount: PAIR_AMOUNT,
        vestingId: NFT_ID,
      });

      const timestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());
      await increase(ONE_WEEK.mul(3));
      await expectThrow(
        vester.connect(core.hhUser1).closePositionAndBuyTokens(
          NFT_ID,
          MAX_UINT_256_BI,
          convertToNearestWeek(BigNumber.from(timestamp), TWO_YEARS),
          BigNumber.from('11000'), // .011 USDC - at price of 2 cents, this would pass
        ),
        'VeExternalVesterImplementationV2: Cost exceeds max payment amount'
      );
      await vester.connect(core.hhUser1).closePositionAndBuyTokens(
        NFT_ID,
        MAX_UINT_256_BI,
        convertToNearestWeek(BigNumber.from(timestamp), TWO_YEARS),
        BigNumber.from('30000'), // .03 USDC - floor price
      );
    });
  });

  async function setPriceOracle(token: IERC20, marketId: BigNumberish, priceOracle: IDolomitePriceOracle) {
    await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
      token: token.address,
      decimals: await IERC20Metadata__factory.connect(token.address, core.hhUser1).decimals(),
      oracleInfos: [
        {
          oracle: priceOracle.address,
          weight: 100,
          tokenPair: ADDRESS_ZERO,
        },
      ],
    });

    if (!BigNumber.from(marketId).eq(NO_MARKET_ID)) {
      await core.dolomiteMargin.ownerSetPriceOracle(marketId, core.oracleAggregatorV2.address);
    }
  }
});
