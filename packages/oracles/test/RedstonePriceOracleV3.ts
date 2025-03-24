import {
  CustomTestToken,
  DolomiteRegistryImplementation,
  DolomiteRegistryImplementation__factory,
} from '@dolomite-exchange/modules-base/src/types';
import { createContractWithAbi, createTestToken } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network, ONE_DAY_SECONDS } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  impersonate,
  revertToSnapshotAndCapture,
  snapshot,
  waitTime,
} from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { deployMockContract, MockContract } from 'ethereum-waffle';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { REDSTONE_PRICE_AGGREGATORS_MAP } from 'packages/base/src/utils/constants';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { getRedstonePriceOracleV3ConstructorParams } from '../src/oracles-constructors';
import {
  OracleAggregatorV2__factory,
  RedstonePriceOracleV3,
  RedstonePriceOracleV3__factory,
  TestChainlinkAggregator,
  TestChainlinkAggregator__factory,
} from '../src/types';

const TEST_TOKEN_PRICE = parseEther('1');
const USDC_PRICE = TEST_TOKEN_PRICE.mul(BigNumber.from(10).pow(12));

describe('RedstonePriceOracleV3', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;

  let oracle: RedstonePriceOracleV3;
  let testAggregator: TestChainlinkAggregator;
  let testToken: CustomTestToken;
  let oracleAggregator: MockContract;

  before(async () => {
    const blockNumber = 187_699_000; // DO NOT CHANGE THIS
    core = await setupCoreProtocol({
      blockNumber,
      network: Network.ArbitrumOne,
    });

    const dolomiteRegistryImplementation = await createContractWithAbi<DolomiteRegistryImplementation>(
      DolomiteRegistryImplementation__factory.abi,
      DolomiteRegistryImplementation__factory.bytecode,
      [],
    );
    await core.dolomiteRegistryProxy.connect(core.governance).upgradeTo(dolomiteRegistryImplementation.address);

    oracleAggregator = await deployMockContract(core.governance, OracleAggregatorV2__factory.abi as any);
    await oracleAggregator.mock.getDecimalsByToken.withArgs(core.tokens.weth.address).returns(18);
    await oracleAggregator.mock.getDecimalsByToken.withArgs(core.tokens.dai.address).returns(18);
    await oracleAggregator.mock.getDecimalsByToken.withArgs(core.tokens.usdc.address).returns(6);
    await oracleAggregator.mock.getDecimalsByToken.withArgs(core.tokens.wbtc.address).returns(8);
    await oracleAggregator.mock.getDecimalsByToken.withArgs(core.tokens.weEth.address).returns(18);

    testAggregator = await createContractWithAbi<TestChainlinkAggregator>(
      TestChainlinkAggregator__factory.abi,
      TestChainlinkAggregator__factory.bytecode,
      [],
    );
    testToken = await createTestToken();
    await testAggregator.setLatestAnswer(TEST_TOKEN_PRICE); // 0.1E
    await testAggregator.setDecimals(18);
    const aggregators: any[] = [
      ADDRESS_ZERO,
      testAggregator.address,
      testAggregator.address,
      testAggregator.address,
      REDSTONE_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][core.tokens.weEth.address]!.aggregatorAddress,
    ];
    const tokens = [
      core.tokens.weth.address,
      core.tokens.dai.address,
      core.tokens.usdc.address,
      core.tokens.wbtc.address,
      core.tokens.weEth.address,
    ];
    oracle = (await createContractWithAbi<RedstonePriceOracleV3>(
      RedstonePriceOracleV3__factory.abi,
      RedstonePriceOracleV3__factory.bytecode,
      getRedstonePriceOracleV3ConstructorParams(
        core,
        tokens,
        aggregators,
        [false, false, false, false, false],
      ),
    )).connect(core.governance);
    await core.dolomiteRegistry.connect(core.governance).ownerSetOracleAggregator(oracleAggregator.address);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should succeed when values are aligned', async () => {
      await createContractWithAbi<RedstonePriceOracleV3>(
        RedstonePriceOracleV3__factory.abi,
        RedstonePriceOracleV3__factory.bytecode,
        [
          [ZERO_ADDRESS],
          [ZERO_ADDRESS],
          [false],
          core.dolomiteRegistry.address,
          core.dolomiteMargin.address,
        ],
      );
    });

    it('should fail when token length is not aligned', async () => {
      await expectThrow(
        createContractWithAbi<RedstonePriceOracleV3>(
          RedstonePriceOracleV3__factory.abi,
          RedstonePriceOracleV3__factory.bytecode,
          [
            [ZERO_ADDRESS],
            [ZERO_ADDRESS, ZERO_ADDRESS],
            [false, false],
            core.dolomiteRegistry.address,
            core.dolomiteMargin.address,
          ],
        ),
        'RedstonePriceOracleV3: Invalid tokens length',
      );
    });

    it('should fail when aggregator length is not aligned', async () => {
      await expectThrow(
        createContractWithAbi<RedstonePriceOracleV3>(
          RedstonePriceOracleV3__factory.abi,
          RedstonePriceOracleV3__factory.bytecode,
          [
            [ZERO_ADDRESS, ZERO_ADDRESS],
            [ZERO_ADDRESS, ZERO_ADDRESS],
            [false],
            core.dolomiteRegistry.address,
            core.dolomiteMargin.address,
          ],
        ),
        'RedstonePriceOracleV3: Invalid aggregators length',
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

    it('returns the correct value if invert price is true', async () => {
      await oracleAggregator.mock.getDecimalsByToken.withArgs(testToken.address).returns(18);
      await oracle.connect(core.governance).ownerInsertOrUpdateOracleToken(
        testToken.address,
        testAggregator.address,
        true,
      );
      await testAggregator.setLatestAnswer(parseEther('.5'));
      const price = await oracle.getPrice(testToken.address);
      expect(price.value).to.eq(parseEther('2'));
    });

    it('reverts if dolomite margin calls getPrice', async () => {
      const doloImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await oracle.connect(core.governance).ownerInsertOrUpdateOracleToken(
        testToken.address,
        testAggregator.address,
        false,
      );
      await expectThrow(
        oracle.connect(doloImpersonator).getPrice(testToken.address),
        'RedstonePriceOracleV3: DolomiteMargin cannot call',
      );
    });

    it('reverts when an invalid address is passed in', async () => {
      const ONE_ADDRESS = '0x1000000000000000000000000000000000000000';
      await expectThrow(
        oracle.getPrice(ZERO_ADDRESS),
        `RedstonePriceOracleV3: Invalid token <${ZERO_ADDRESS}>`,
      );
      await expectThrow(
        oracle.getPrice(ONE_ADDRESS),
        `RedstonePriceOracleV3: Invalid token <${ONE_ADDRESS}>`,
      );
    });

    it('reverts when the price is expired', async () => {
      await oracle.ownerInsertOrUpdateOracleToken(
        testToken.address,
        testAggregator.address,
        false,
      );
      await testAggregator.setLatestAnswer(BigNumber.from('20000000000')); // $200
      await waitTime((60 * 60 * 36) + 1); // prices expire in 36 hours by default
      await expectThrow(
        oracle.getPrice(testToken.address),
        `RedstonePriceOracleV3: Price expired <${testToken.address.toLowerCase()}>`,
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
        `RedstonePriceOracleV3: Staleness threshold too low <${stalenessThreshold.toFixed()}>`,
      );
    });

    it('fails when too high', async () => {
      const stalenessThreshold = (ONE_DAY_SECONDS * 7) + 1;
      await expectThrow(
        oracle.ownerSetStalenessThreshold(stalenessThreshold),
        `RedstonePriceOracleV3: Staleness threshold too high <${stalenessThreshold.toFixed()}>`,
      );
    });
  });

  describe('#ownerInsertOrUpdateOracleToken', () => {
    it('can insert a new oracle', async () => {
      const tokenAddress = testToken.address;
      await oracle.ownerInsertOrUpdateOracleToken(
        tokenAddress,
        testAggregator.address,
        false,
      );
      expect(await oracle.getAggregatorByToken(tokenAddress)).to.eq(testAggregator.address);
      expect(await oracle.getInvertPriceByToken(tokenAddress)).to.eq(false);
    });

    it('can update an existing oracle', async () => {
      const tokenAddress = core.tokens.wbtc.address;
      await oracle.ownerInsertOrUpdateOracleToken(
        tokenAddress,
        testAggregator.address,
        true,
      );
      expect(await oracle.getAggregatorByToken(tokenAddress)).to.eq(testAggregator.address);
      expect(await oracle.getInvertPriceByToken(tokenAddress)).to.eq(true);
    });

    it('fails when invoked by non-admin', async () => {
      await expectThrow(
        oracle.connect(core.hhUser1).ownerInsertOrUpdateOracleToken(
          testToken.address,
          testAggregator.address,
          false,
        ),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });
});
