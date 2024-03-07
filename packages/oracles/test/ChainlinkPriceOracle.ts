import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  ChainlinkPriceOracle,
  ChainlinkPriceOracle__factory,
  TestChainlinkAggregator,
  TestChainlinkAggregator__factory,
} from '../src/types';
import {
  CustomTestToken,
} from '@dolomite-exchange/modules-base/src/types';
import { getChainlinkPriceOracleConstructorParamsFromOldPriceOracle } from '../src/oracles-constructors';
import { createContractWithAbi, createTestToken } from '@dolomite-exchange/modules-base/../../../packages/base/src/utils/dolomite-utils';
import {
  ADDRESS_ZERO,
  MAX_INT_192_BI,
  Network,
  ONE_BI,
  ONE_DAY_SECONDS,
  TEN_BI,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot, waitTime } from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';

const WETH_PRICE = BigNumber.from('1883923360000000000000');
const BTC_PRICE = BigNumber.from('299800328339800000000000000000000');
const USDC_PRICE = BigNumber.from('999937000000000000000000000000');
const TEST_TOKEN_PRICE = WETH_PRICE.mul(1).div(10);
const TEST_TOKEN_STANDARD_PRICE = TEN_BI.pow(18).div(10);

describe('ChainlinkPriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;

  let oracle: ChainlinkPriceOracle;
  let testAggregator: TestChainlinkAggregator;
  let testToken: CustomTestToken;

  before(async () => {
    const blockNumber = 114_200_000; // DO NOT CHANGE THIS
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
    await testAggregator.setLatestAnswer(TEN_BI.pow(18).div(10)); // 0.1E
    await testAggregator.setDecimals(18);
    oracle = (await createContractWithAbi<ChainlinkPriceOracle>(
      ChainlinkPriceOracle__factory.abi,
      ChainlinkPriceOracle__factory.bytecode,
      await getChainlinkPriceOracleConstructorParamsFromOldPriceOracle(core),
    )).connect(core.governance);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should succeed when values are aligned', async () => {
      await createContractWithAbi<ChainlinkPriceOracle>(
        ChainlinkPriceOracle__factory.abi,
        ChainlinkPriceOracle__factory.bytecode,
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
        createContractWithAbi<ChainlinkPriceOracle>(
          ChainlinkPriceOracle__factory.abi,
          ChainlinkPriceOracle__factory.bytecode,
          [
            [ZERO_ADDRESS],
            [ZERO_ADDRESS, ZERO_ADDRESS],
            [8, 8],
            [ZERO_ADDRESS, ZERO_ADDRESS],
            [false, false],
            core.dolomiteMargin.address,
          ],
        ),
        'ChainlinkPriceOracle: Invalid tokens length',
      );
    });

    it('should fail when aggregator length is not aligned', async () => {
      await expectThrow(
        createContractWithAbi<ChainlinkPriceOracle>(
          ChainlinkPriceOracle__factory.abi,
          ChainlinkPriceOracle__factory.bytecode,
          [
            [ZERO_ADDRESS, ZERO_ADDRESS],
            [ZERO_ADDRESS, ZERO_ADDRESS],
            [8],
            [ZERO_ADDRESS, ZERO_ADDRESS],
            [false, false],
            core.dolomiteMargin.address,
          ],
        ),
        'ChainlinkPriceOracle: Invalid aggregators length',
      );
    });

    it('should fail when token decimal length is not aligned', async () => {
      await expectThrow(
        createContractWithAbi<ChainlinkPriceOracle>(
          ChainlinkPriceOracle__factory.abi,
          ChainlinkPriceOracle__factory.bytecode,
          [
            [ZERO_ADDRESS, ZERO_ADDRESS],
            [ZERO_ADDRESS, ZERO_ADDRESS],
            [8, 8],
            [ZERO_ADDRESS],
            [false, false],
            core.dolomiteMargin.address,
          ],
        ),
        'ChainlinkPriceOracle: Invalid decimals length',
      );
    });

    it('should fail when token pair length is not aligned', async () => {
      await expectThrow(
        createContractWithAbi<ChainlinkPriceOracle>(
          ChainlinkPriceOracle__factory.abi,
          ChainlinkPriceOracle__factory.bytecode,
          [
            [ZERO_ADDRESS, ZERO_ADDRESS],
            [ZERO_ADDRESS, ZERO_ADDRESS],
            [8, 8],
            [ZERO_ADDRESS, ZERO_ADDRESS],
            [false],
            core.dolomiteMargin.address,
          ],
        ),
        'ChainlinkPriceOracle: Invalid pairs length',
      );
    });
  });

  describe('#getPrice', () => {
    it('returns the correct value for a token with 18 decimals', async () => {
      const price = await oracle.getPrice(core.tokens.weth.address);
      expect(price.value).to.eq(WETH_PRICE);
    });

    it('returns the correct value for a token with less than 18 decimals', async () => {
      const price = await oracle.getPrice(core.tokens.wbtc.address);
      expect(price.value).to.eq(BTC_PRICE);
    });

    it('returns the correct value for a token with less than 18 decimals and non-USD base price', async () => {
      const price = await oracle.getPrice(core.tokens.usdc.address);
      expect(price.value).to.eq(USDC_PRICE);
    });

    it('returns the correct value for a token with non-USDC base and 18 decimals', async () => {
      await oracle.ownerInsertOrUpdateOracleToken(
        testToken.address,
        18,
        testAggregator.address,
        core.tokens.weth.address,
        false
      );
      const price = await oracle.getPrice(testToken.address);
      expect(price.value).to.eq(TEST_TOKEN_PRICE);
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
      expect(price.value).to.eq(TEST_TOKEN_STANDARD_PRICE);
    });


    it('reverts when token bypasses USD value and caller is dolomite margin', async () => {
      const doloImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await oracle.ownerInsertOrUpdateOracleToken(
        testToken.address,
        18,
        testAggregator.address,
        core.tokens.weth.address,
        true,
      );
      await expectThrow(
        oracle.connect(doloImpersonator).getPrice(testToken.address),
        `ChainlinkPriceOracle: Token bypasses USD value <${testToken.address.toLowerCase()}>`,
      );
    })

    it('reverts when an invalid address is passed in', async () => {
      const ONE_ADDRESS = '0x1000000000000000000000000000000000000000';
      await expectThrow(
        oracle.getPrice(ZERO_ADDRESS),
        `ChainlinkPriceOracle: Invalid token <${ZERO_ADDRESS}>`,
      );
      await expectThrow(
        oracle.getPrice(ONE_ADDRESS),
        `ChainlinkPriceOracle: Invalid token <${ONE_ADDRESS}>`,
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
        `ChainlinkPriceOracle: Chainlink price expired <${testToken.address.toLowerCase()}>`,
      );
    });

    it('reverts when the price is too low', async () => {
      await testAggregator.setLatestAnswer(ONE_BI);
      await testAggregator.setMinAnswer(MAX_INT_192_BI);
      await oracle.ownerInsertOrUpdateOracleToken(
        testToken.address,
        18,
        testAggregator.address,
        core.tokens.weth.address,
        false
      );
      await expectThrow(
        oracle.getPrice(testToken.address),
        'ChainlinkPriceOracle: Chainlink price too low',
      );
    });

    it('reverts when the price is too high', async () => {
      await testAggregator.setLatestAnswer(MAX_INT_192_BI);
      await testAggregator.setMaxAnswer(ONE_BI);
      await oracle.ownerInsertOrUpdateOracleToken(
        testToken.address,
        18,
        testAggregator.address,
        core.tokens.weth.address,
        false
      );
      await expectThrow(
        oracle.getPrice(testToken.address),
        'ChainlinkPriceOracle: Chainlink price too high',
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
        `ChainlinkPriceOracle: Staleness threshold too low <${stalenessThreshold.toFixed()}>`,
      );
    });

    it('fails when too high', async () => {
      const stalenessThreshold = (ONE_DAY_SECONDS * 7) + 1;
      await expectThrow(
        oracle.ownerSetStalenessThreshold(stalenessThreshold),
        `ChainlinkPriceOracle: Staleness threshold too high <${stalenessThreshold.toFixed()}>`,
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

    it('fails when non-zero paired token does not have an aggregator', async () => {
      const tokenAddress = testToken.address;
      const otherPairAddress = '0x1234567812345678123456781234567812345678';
      await expectThrow(
        oracle.ownerInsertOrUpdateOracleToken(
          tokenAddress,
          9,
          testAggregator.address,
          otherPairAddress,
          false
        ),
        `ChainlinkPriceOracle: Invalid token pair <${otherPairAddress.toLowerCase()}>`,
      );
    });

    it('can be set as the oracle for a market', async () => {
      await oracle.ownerInsertOrUpdateOracleToken(
        testToken.address,
        18,
        testAggregator.address,
        core.tokens.weth.address,
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
