
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  RedstonePriceOracleV2,
  RedstonePriceOracleV2__factory,
  TestChainlinkAggregator,
  TestChainlinkAggregator__factory,
} from '../src/types';
import {
  CustomTestToken,
} from '@dolomite-exchange/modules-base/src/types';
import { createContractWithAbi, createTestToken } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import {
  ADDRESS_ZERO,
  Network,
  ONE_DAY_SECONDS,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  impersonate,
  revertToSnapshotAndCapture,
  snapshot,
  waitTime
} from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import { getRedstonePriceOracleV2ConstructorParams } from '../src/oracles-constructors';
import { REDSTONE_PRICE_AGGREGATORS_MAP } from 'packages/base/src/utils/constants';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';

const WE_ETH_PRICE = BigNumber.from('3966474866008054000000');
const TEST_TOKEN_PRICE = parseEther('1');
const USDC_PRICE = TEST_TOKEN_PRICE.mul(BigNumber.from(10).pow(12));

describe('RedstonePriceOracleV2', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;

  let oracle: RedstonePriceOracleV2;
  let testAggregator: TestChainlinkAggregator;
  let testToken: CustomTestToken;

  before(async () => {
    const blockNumber = 187_699_000; // DO NOT CHANGE THIS
    core = await setupCoreProtocol({
      blockNumber,
      network: Network.ArbitrumOne,
    });

    testAggregator = await createContractWithAbi<TestChainlinkAggregator>(
      TestChainlinkAggregator__factory.abi,
      TestChainlinkAggregator__factory.bytecode,
      [],
    );
    testToken = await createTestToken();
    await testAggregator.setLatestAnswer(TEST_TOKEN_PRICE); // 0.1E
    await testAggregator.setDecimals(18);
    const aggregators = [
      ADDRESS_ZERO,
      testAggregator.address,
      testAggregator.address,
      testAggregator.address,
      REDSTONE_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][core.tokens.weEth.address]!.aggregatorAddress,
    ];
    oracle = (await createContractWithAbi<RedstonePriceOracleV2>(
      RedstonePriceOracleV2__factory.abi,
      RedstonePriceOracleV2__factory.bytecode,
      await getRedstonePriceOracleV2ConstructorParams(
        [core.tokens.weth, core.tokens.dai, core.tokens.usdc, core.tokens.wbtc, core.tokens.weEth],
        aggregators,
        [ADDRESS_ZERO, ADDRESS_ZERO, ADDRESS_ZERO, core.tokens.dai.address, core.tokens.weth.address],
        [false, false, false, false, false],
        core
      )
    )).connect(core.governance);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should succeed when values are aligned', async () => {
      await createContractWithAbi<RedstonePriceOracleV2>(
        RedstonePriceOracleV2__factory.abi,
        RedstonePriceOracleV2__factory.bytecode,
        [
          [ZERO_ADDRESS],
          [ZERO_ADDRESS],
          [8],
          [ZERO_ADDRESS],
          [false],
          core.dolomiteMargin.address,
        ],
      );
    });

    it('should fail when token length is not aligned', async () => {
      await expectThrow(
        createContractWithAbi<RedstonePriceOracleV2>(
          RedstonePriceOracleV2__factory.abi,
          RedstonePriceOracleV2__factory.bytecode,
          [
            [ZERO_ADDRESS],
            [ZERO_ADDRESS, ZERO_ADDRESS],
            [8, 8],
            [ZERO_ADDRESS, ZERO_ADDRESS],
            [false, false],
            core.dolomiteMargin.address,
          ],
        ),
        'RedstonePriceOracleV2: Invalid tokens length',
      );
    });

    it('should fail when aggregator length is not aligned', async () => {
      await expectThrow(
        createContractWithAbi<RedstonePriceOracleV2>(
          RedstonePriceOracleV2__factory.abi,
          RedstonePriceOracleV2__factory.bytecode,
          [
            [ZERO_ADDRESS, ZERO_ADDRESS],
            [ZERO_ADDRESS, ZERO_ADDRESS],
            [8],
            [ZERO_ADDRESS, ZERO_ADDRESS],
            [false, false],
            core.dolomiteMargin.address,
          ],
        ),
        'RedstonePriceOracleV2: Invalid aggregators length',
      );
    });

    it('should fail when token decimal length is not aligned', async () => {
      await expectThrow(
        createContractWithAbi<RedstonePriceOracleV2>(
          RedstonePriceOracleV2__factory.abi,
          RedstonePriceOracleV2__factory.bytecode,
          [
            [ZERO_ADDRESS, ZERO_ADDRESS],
            [ZERO_ADDRESS, ZERO_ADDRESS],
            [8, 8],
            [ZERO_ADDRESS],
            [false, false],
            core.dolomiteMargin.address,
          ],
        ),
        'RedstonePriceOracleV2: Invalid decimals length',
      );
    });

    it('should fail when token decimal length is not aligned', async () => {
      await expectThrow(
        createContractWithAbi<RedstonePriceOracleV2>(
          RedstonePriceOracleV2__factory.abi,
          RedstonePriceOracleV2__factory.bytecode,
          [
            [ZERO_ADDRESS, ZERO_ADDRESS],
            [ZERO_ADDRESS, ZERO_ADDRESS],
            [8, 8],
            [ZERO_ADDRESS, ZERO_ADDRESS],
            [false],
            core.dolomiteMargin.address,
          ],
        ),
        'RedstonePriceOracleV2: Invalid pairs length',
      );
    });
  });

  describe('#getPrice', () => {
    it('returns the correct value for a token with 18 decimals', async () => {
      const price = await oracle.getPrice(core.tokens.dai.address);
      expect(price.value).to.eq(TEST_TOKEN_PRICE);
    });

    it('returns the correct value for a token with less than 18 decimals', async () => {
      const price = await oracle.getPrice(core.tokens.usdc.address);
      expect(price.value).to.eq(USDC_PRICE);
    });

    it('returns the correct value for a token with less than 18 decimals and non-USD base price', async () => {
      const price = await oracle.getPrice(core.tokens.wbtc.address);
      expect(price.value).to.eq(TEST_TOKEN_PRICE.mul(BigNumber.from('10').pow(10)));
    });

    it('returns the correct value for a token with non-USDC base and 18 decimals', async () => {
      const price = await oracle.getPrice(core.tokens.weEth.address);
      expect(price.value).to.eq(WE_ETH_PRICE);
    });

    it('returns the correct value for usd bypass token', async () => {
      await oracle.connect(core.governance).ownerInsertOrUpdateOracleToken(
        testToken.address,
        18,
        testAggregator.address,
        ADDRESS_ZERO,
        true
      );
      const price = await oracle.getPrice(testToken.address);
      expect(price.value).to.eq(TEST_TOKEN_PRICE);
    });

    it('reverts if dolomite margin calls getPrice on usd bypass token', async () => {
      const doloImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await oracle.connect(core.governance).ownerInsertOrUpdateOracleToken(
        testToken.address,
        18,
        testAggregator.address,
        ADDRESS_ZERO,
        true
      );
      await expectThrow(
        oracle.connect(doloImpersonator).getPrice(testToken.address),
        `RedstonePriceOracleV2: Token bypasses USD value <${testToken.address.toLowerCase()}>`,
      );
    });

    it('reverts when an invalid address is passed in', async () => {
      const ONE_ADDRESS = '0x1000000000000000000000000000000000000000';
      await expectThrow(
        oracle.getPrice(ZERO_ADDRESS),
        `RedstonePriceOracleV2: Invalid token <${ZERO_ADDRESS}>`,
      );
      await expectThrow(
        oracle.getPrice(ONE_ADDRESS),
        `RedstonePriceOracleV2: Invalid token <${ONE_ADDRESS}>`,
      );
    });

    it('reverts when the price is expired', async () => {
      await oracle.ownerInsertOrUpdateOracleToken(
        testToken.address,
        18,
        testAggregator.address,
        core.tokens.weth.address,
        false
      );
      await testAggregator.setLatestAnswer(BigNumber.from('20000000000')); // $200
      await waitTime((60 * 60 * 36) + 1); // prices expire in 36 hours by default
      await expectThrow(
        oracle.getPrice(testToken.address),
        `RedstonePriceOracleV2: Price expired <${testToken.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetStalenessThreshold', () => {
    it('works normally', async () => {
      const stalenessThreshold = ONE_DAY_SECONDS + 1234;
      await oracle.ownerSetStalenessThreshold(stalenessThreshold);
      expect(await oracle.stalenessThreshold()).to.eq(stalenessThreshold);
    });

    it('fails when invoked by non-admin', async () => {
      await expectThrow(
        oracle.connect(core.hhUser1).ownerSetStalenessThreshold(ONE_DAY_SECONDS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('fails when too low', async () => {
      const stalenessThreshold = ONE_DAY_SECONDS - 1;
      await expectThrow(
        oracle.ownerSetStalenessThreshold(stalenessThreshold),
        `RedstonePriceOracleV2: Staleness threshold too low <${stalenessThreshold.toFixed()}>`,
      );
    });

    it('fails when too high', async () => {
      const stalenessThreshold = (ONE_DAY_SECONDS * 7) + 1;
      await expectThrow(
        oracle.ownerSetStalenessThreshold(stalenessThreshold),
        `RedstonePriceOracleV2: Staleness threshold too high <${stalenessThreshold.toFixed()}>`,
      );
    });
  });

  describe('#ownerInsertOrUpdateOracleToken', () => {
    it('can insert a new oracle', async () => {
      const tokenAddress = testToken.address;
      await oracle.ownerInsertOrUpdateOracleToken(
        tokenAddress,
        18,
        testAggregator.address,
        ZERO_ADDRESS,
        false
      );
      expect(await oracle.getDecimalsByToken(tokenAddress)).to.eq(18);
      expect(await oracle.getAggregatorByToken(tokenAddress)).to.eq(testAggregator.address);
      expect(await oracle.getTokenPairByToken(tokenAddress)).to.eq(ZERO_ADDRESS);
    });

    it('can update an existing oracle', async () => {
      const tokenAddress = core.tokens.wbtc.address;
      await oracle.ownerInsertOrUpdateOracleToken(
        tokenAddress,
        11,
        testAggregator.address,
        core.tokens.weth.address,
        false
      );
      expect(await oracle.getDecimalsByToken(tokenAddress)).to.eq(11);
      expect(await oracle.getAggregatorByToken(tokenAddress)).to.eq(testAggregator.address);
      expect(await oracle.getTokenPairByToken(tokenAddress)).to.eq(core.tokens.weth.address);
    });

    it('fails when invoked by non-admin', async () => {
      await expectThrow(
        oracle.connect(core.hhUser1).ownerInsertOrUpdateOracleToken(
          testToken.address,
          9,
          testAggregator.address,
          ZERO_ADDRESS,
          false
        ),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('can be set as the oracle for a market', async () => {
      await oracle.ownerInsertOrUpdateOracleToken(
        testToken.address,
        18,
        testAggregator.address,
        ADDRESS_ZERO,
        false
      );
      const marketId = await core.dolomiteMargin.getNumMarkets();
      await core.dolomiteMargin.ownerAddMarket(
        testToken.address,
        oracle.address,
        core.interestSetters.alwaysZeroInterestSetter.address,
        { value: ZERO_BI },
        { value: ZERO_BI },
        ZERO_BI,
        false,
        false,
      );
      const price = await core.dolomiteMargin.getMarketPrice(marketId);
      expect(price.value).to.eq(TEST_TOKEN_PRICE);
    });
  });
});
