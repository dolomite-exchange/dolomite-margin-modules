import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  ChainlinkPriceOracleV3,
  ChainlinkPriceOracleV3__factory,
  OracleAggregatorV2,
  OracleAggregatorV2__factory,
  TestChainlinkAggregator,
  TestChainlinkAggregator__factory,
} from '../src/types';
import {
  CustomTestToken, DolomiteRegistryImplementation, DolomiteRegistryImplementation__factory,
} from '@dolomite-exchange/modules-base/src/types';
import { getChainlinkPriceOracleV3ConstructorParamsFromChainlinkOracleV1 } from '../src/oracles-constructors';
import { createContractWithAbi, createTestToken } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import {
  ADDRESS_ZERO,
  MAX_INT_192_BI,
  Network,
  ONE_BI,
  ONE_DAY_SECONDS,
  TEN_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  impersonate,
  revertToSnapshotAndCapture,
  snapshot,
  waitTime
} from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import { TokenInfo } from '../src';

const WETH_PRICE = BigNumber.from('2260038782330000000000');
const BTC_PRICE = BigNumber.from('440493939086400000000000000000000');

describe('ChainlinkPriceOracleV3', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;

  let oracle: ChainlinkPriceOracleV3;
  let testAggregator: TestChainlinkAggregator;
  let testToken: CustomTestToken;
  let oracleAggregator: OracleAggregatorV2;

  before(async () => {
    core = await setupCoreProtocol(await getDefaultCoreProtocolConfig(Network.ArbitrumOne));

    const dolomiteRegistryImplementation = await createContractWithAbi<DolomiteRegistryImplementation>(
      DolomiteRegistryImplementation__factory.abi,
      DolomiteRegistryImplementation__factory.bytecode,
      [],
    );
    await core.dolomiteRegistryProxy.connect(core.governance).upgradeTo(dolomiteRegistryImplementation.address);
    testAggregator = await createContractWithAbi<TestChainlinkAggregator>(
      TestChainlinkAggregator__factory.abi,
      TestChainlinkAggregator__factory.bytecode,
      [],
    );
    testToken = await createTestToken();
    await testAggregator.setLatestAnswer(TEN_BI.pow(18).div(10)); // 0.1E
    await testAggregator.setDecimals(18);
    oracle = (await createContractWithAbi<ChainlinkPriceOracleV3>(
      ChainlinkPriceOracleV3__factory.abi,
      ChainlinkPriceOracleV3__factory.bytecode,
      await getChainlinkPriceOracleV3ConstructorParamsFromChainlinkOracleV1(core),
    )).connect(core.governance);
    const tokenInfos: TokenInfo[] = [
      {
        oracleInfos: [
          { oracle: oracle.address, tokenPair: ADDRESS_ZERO, weight: 100 },
        ],
        decimals: 18,
        token: core.tokens.weth.address
      },
      {
        oracleInfos: [
          { oracle: oracle.address, tokenPair: ADDRESS_ZERO, weight: 100 },
        ],
        decimals: 6,
        token: core.tokens.usdc.address
      },
      {
        oracleInfos: [
          { oracle: oracle.address, tokenPair: ADDRESS_ZERO, weight: 100 },
        ],
        decimals: 8,
        token: core.tokens.wbtc.address
      }
    ];
    oracleAggregator = (await createContractWithAbi<OracleAggregatorV2>(
      OracleAggregatorV2__factory.abi,
      OracleAggregatorV2__factory.bytecode,
      [
        tokenInfos,
        core.dolomiteMargin.address
      ]
    )).connect(core.governance);
    await core.dolomiteRegistry.connect(core.governance).ownerSetOracleAggregator(oracleAggregator.address);
    await core.dolomiteRegistry.connect(core.governance).ownerSetChainlinkPriceOracle(oracle.address);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should succeed when values are aligned', async () => {
      await createContractWithAbi<ChainlinkPriceOracleV3>(
        ChainlinkPriceOracleV3__factory.abi,
        ChainlinkPriceOracleV3__factory.bytecode,
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
        createContractWithAbi<ChainlinkPriceOracleV3>(
          ChainlinkPriceOracleV3__factory.abi,
          ChainlinkPriceOracleV3__factory.bytecode,
          [
            [ZERO_ADDRESS],
            [ZERO_ADDRESS, ZERO_ADDRESS],
            [false, false],
            core.dolomiteRegistry.address,
            core.dolomiteMargin.address,
          ],
        ),
        'ChainlinkPriceOracleV3: Invalid tokens length',
      );
    });

    it('should fail when aggregator length is not aligned', async () => {
      await expectThrow(
        createContractWithAbi<ChainlinkPriceOracleV3>(
          ChainlinkPriceOracleV3__factory.abi,
          ChainlinkPriceOracleV3__factory.bytecode,
          [
            [ZERO_ADDRESS, ZERO_ADDRESS],
            [ZERO_ADDRESS, ZERO_ADDRESS],
            [false],
            core.dolomiteRegistry.address,
            core.dolomiteMargin.address,
          ],
        ),
        'ChainlinkPriceOracleV3: Invalid aggregators length',
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

    it('returns the inverse if invertPrice is true', async () => {
      await oracle.ownerInsertOrUpdateOracleToken(
        testToken.address,
        testAggregator.address,
        true
      );
      const tokenInfo: TokenInfo = {
        oracleInfos: [
          { oracle: oracle.address, tokenPair: core.tokens.weth.address, weight: 100 },
        ],
        decimals: 18,
        token: testToken.address,
      };
      await oracleAggregator.ownerInsertOrUpdateToken(tokenInfo);
      await testAggregator.setLatestAnswer(parseEther('.5'));
      const price = await oracle.getPrice(testToken.address);
      expect(price.value).to.eq(parseEther('2'));
    });

    it('reverts when and caller is dolomite margin', async () => {
      const doloImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await oracle.ownerInsertOrUpdateOracleToken(
        testToken.address,
        testAggregator.address,
        false
      );
      await expectThrow(
        oracle.connect(doloImpersonator).getPrice(testToken.address),
        'ChainlinkPriceOracleV3: DolomiteMargin cannot call',
      );
    });

    it('reverts when an invalid address is passed in', async () => {
      const ONE_ADDRESS = '0x1000000000000000000000000000000000000000';
      await expectThrow(
        oracle.getPrice(ZERO_ADDRESS),
        `ChainlinkPriceOracleV3: Invalid token <${ZERO_ADDRESS}>`,
      );
      await expectThrow(
        oracle.getPrice(ONE_ADDRESS),
        `ChainlinkPriceOracleV3: Invalid token <${ONE_ADDRESS}>`,
      );
    });

    it('reverts when the price is expired', async () => {
      await oracle.ownerInsertOrUpdateOracleToken(
        testToken.address,
        testAggregator.address,
        false
      );
      await testAggregator.setLatestAnswer(BigNumber.from('20000000000')); // $200
      await waitTime((60 * 60 * 36) + 1); // prices expire in 36 hours by default
      await expectThrow(
        oracle.getPrice(testToken.address),
        `ChainlinkPriceOracleV3: Chainlink price expired <${testToken.address.toLowerCase()}>`,
      );
    });

    it('reverts when the price is too low', async () => {
      await testAggregator.setLatestAnswer(ONE_BI);
      await testAggregator.setMinAnswer(MAX_INT_192_BI);
      await oracle.ownerInsertOrUpdateOracleToken(
        testToken.address,
        testAggregator.address,
        false
      );
      await expectThrow(
        oracle.getPrice(testToken.address),
        'ChainlinkPriceOracleV3: Chainlink price too low',
      );
    });

    it('reverts when the price is too high', async () => {
      await testAggregator.setLatestAnswer(MAX_INT_192_BI);
      await testAggregator.setMaxAnswer(ONE_BI);
      await oracle.ownerInsertOrUpdateOracleToken(
        testToken.address,
        testAggregator.address,
        false
      );
      await expectThrow(
        oracle.getPrice(testToken.address),
        'ChainlinkPriceOracleV3: Chainlink price too high',
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
        `ChainlinkPriceOracleV3: Staleness threshold too low <${stalenessThreshold.toFixed()}>`,
      );
    });

    it('fails when too high', async () => {
      const stalenessThreshold = (ONE_DAY_SECONDS * 7) + 1;
      await expectThrow(
        oracle.ownerSetStalenessThreshold(stalenessThreshold),
        `ChainlinkPriceOracleV3: Staleness threshold too high <${stalenessThreshold.toFixed()}>`,
      );
    });
  });

  describe('#ownerInsertOrUpdateOracleToken', () => {
    it('can insert a new oracle', async () => {
      const tokenAddress = testToken.address;
      await oracle.ownerInsertOrUpdateOracleToken(
        tokenAddress,
        testAggregator.address,
        false
      );
      expect(await oracle.getAggregatorByToken(tokenAddress)).to.eq(testAggregator.address);
      expect(await oracle.getInvertPriceByToken(tokenAddress)).to.eq(false);
    });

    it('can update an existing oracle', async () => {
      const tokenAddress = core.tokens.wbtc.address;
      await oracle.ownerInsertOrUpdateOracleToken(
        tokenAddress,
        testAggregator.address,
        true
      );
      expect(await oracle.getAggregatorByToken(tokenAddress)).to.eq(testAggregator.address);
      expect(await oracle.getInvertPriceByToken(tokenAddress)).to.eq(true);
    });

    it('fails when invoked by non-admin', async () => {
      await expectThrow(
        oracle.connect(core.hhUser1).ownerInsertOrUpdateOracleToken(
          testToken.address,
          testAggregator.address,
          false
        ),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });
});
