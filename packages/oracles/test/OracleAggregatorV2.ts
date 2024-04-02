import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  ChainlinkPriceOracleV3,
  ChainlinkPriceOracleV3__factory,
  OracleAggregatorV2,
  OracleAggregatorV2__factory,
  RedstonePriceOracleV3,
  RedstonePriceOracleV3__factory,
  TestChainlinkAggregator,
  TestChainlinkAggregator__factory,
} from '../src/types';
import {
  CustomTestToken, DolomiteRegistryImplementation, DolomiteRegistryImplementation__factory,
} from '@dolomite-exchange/modules-base/src/types';
import {
  getChainlinkPriceOracleV3ConstructorParamsFromChainlinkOracleV1,
  getRedstonePriceOracleV3ConstructorParams
} from '../src/oracles-constructors';
import { createContractWithAbi, createTestToken } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import {
  ADDRESS_ZERO,
  Network,
  ONE_ETH_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { WE_ETH_ETH_REDSTONE_FEED_MAP } from 'packages/base/src/utils/constants';
import { TokenInfo } from '../src';
import { parseEther } from 'ethers/lib/utils';

const WETH_PRICE = BigNumber.from('2260038782330000000000');
const BTC_PRICE = BigNumber.from('440493939086400000000000000000000');
const USDC_PRICE = BigNumber.from('1000071010000000000000000000000');

describe('OracleAggregatorV2', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;

  let chainlinkOracle: ChainlinkPriceOracleV3;
  let redstoneOracle: RedstonePriceOracleV3;
  let testAggregator: TestChainlinkAggregator;
  let testAggregator2: TestChainlinkAggregator;
  let testToken: CustomTestToken;
  let oracleAggregator: OracleAggregatorV2;

  before(async () => {
    core = await setupCoreProtocol(await getDefaultCoreProtocolConfig(Network.ArbitrumOne));

    testAggregator = await createContractWithAbi<TestChainlinkAggregator>(
      TestChainlinkAggregator__factory.abi,
      TestChainlinkAggregator__factory.bytecode,
      [],
    );
    testAggregator2 = await createContractWithAbi<TestChainlinkAggregator>(
      TestChainlinkAggregator__factory.abi,
      TestChainlinkAggregator__factory.bytecode,
      [],
    );
    testToken = await createTestToken();
    await testAggregator.setLatestAnswer(ONE_ETH_BI);
    await testAggregator.setDecimals(18);
    await testAggregator2.setLatestAnswer(parseEther('2'));
    await testAggregator2.setDecimals(18);

    const dolomiteRegistryImplementation = await createContractWithAbi<DolomiteRegistryImplementation>(
      DolomiteRegistryImplementation__factory.abi,
      DolomiteRegistryImplementation__factory.bytecode,
      [],
    );
    await core.dolomiteRegistryProxy.connect(core.governance).upgradeTo(dolomiteRegistryImplementation.address);

    chainlinkOracle = (await createContractWithAbi<ChainlinkPriceOracleV3>(
      ChainlinkPriceOracleV3__factory.abi,
      ChainlinkPriceOracleV3__factory.bytecode,
      await getChainlinkPriceOracleV3ConstructorParamsFromChainlinkOracleV1(core),
    )).connect(core.governance);
    redstoneOracle = (await createContractWithAbi<RedstonePriceOracleV3>(
      RedstonePriceOracleV3__factory.abi,
      RedstonePriceOracleV3__factory.bytecode,
      await getRedstonePriceOracleV3ConstructorParams(
        [core.tokens.weEth],
        [WE_ETH_ETH_REDSTONE_FEED_MAP[Network.ArbitrumOne]],
        [false],
        core
      )
    )).connect(core.governance);

    const tokenInfos: TokenInfo[] = [
      {
        oracleInfos: [
          { oracle: chainlinkOracle.address, tokenPair: ADDRESS_ZERO, weight: 100 },
        ],
        decimals: 18,
        token: core.tokens.weth.address
      },
      {
        oracleInfos: [
          { oracle: chainlinkOracle.address, tokenPair: ADDRESS_ZERO, weight: 100 },
        ],
        decimals: 6,
        token: core.tokens.usdc.address
      },
      {
        oracleInfos: [
          { oracle: chainlinkOracle.address, tokenPair: ADDRESS_ZERO, weight: 100 },
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
    await core.dolomiteRegistry.connect(core.governance).ownerSetChainlinkPriceOracle(chainlinkOracle.address);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should fail if token weights do not sum to 100', async () => {
      const tokenInfos: TokenInfo[] = [
        {
          oracleInfos: [
            { oracle: chainlinkOracle.address, tokenPair: ADDRESS_ZERO, weight: 100 },
            { oracle: chainlinkOracle.address, tokenPair: ADDRESS_ZERO, weight: 50 },
          ],
          decimals: 18,
          token: core.tokens.weth.address
        },
      ];
      await expectThrow(
        createContractWithAbi<OracleAggregatorV2>(
          OracleAggregatorV2__factory.abi,
          OracleAggregatorV2__factory.bytecode,
          [
            tokenInfos,
            core.dolomiteMargin.address,
          ],
        ),
        'OracleAggregatorV2: Invalid weights',
      );
    });
  });

  describe('#getPrice', () => {
    it('returns the correct value for a token with 18 decimals', async () => {
      const price = await oracleAggregator.getPrice(core.tokens.weth.address);
      expect(price.value).to.eq(WETH_PRICE);
    });

    it('returns the correct value for a token with less than 18 decimals', async () => {
      const price = await oracleAggregator.getPrice(core.tokens.wbtc.address);
      expect(price.value).to.eq(BTC_PRICE);
    });

    it('returns the correct value for a token with less than 18 decimals and non-USD base price', async () => {
      const price = await oracleAggregator.getPrice(core.tokens.usdc.address);
      expect(price.value).to.eq(USDC_PRICE);
    });

    it('returns the correct value for a token with non-USDC base and 18 decimals', async () => {
      await chainlinkOracle.ownerInsertOrUpdateOracleToken(
        testToken.address,
        18,
        testAggregator2.address,
        false
      );
      const tokenInfo: TokenInfo = {
        oracleInfos: [
          { oracle: chainlinkOracle.address, tokenPair: core.tokens.weth.address, weight: 100 },
        ],
        decimals: 18,
        token: testToken.address
      };
      await oracleAggregator.ownerInsertOrUpdateToken(
        tokenInfo
      );
      const price = await oracleAggregator.getPrice(testToken.address);
      expect(price.value).to.eq(WETH_PRICE.mul(2));
    });

    it('returns the correct price with 50/50 token weights', async () => {
      await chainlinkOracle.ownerInsertOrUpdateOracleToken(
        testToken.address,
        18,
        testAggregator.address,
        false
      );
      await redstoneOracle.ownerInsertOrUpdateOracleToken(
        testToken.address,
        18,
        testAggregator2.address,
        false
      );
      const tokenInfo: TokenInfo = {
        oracleInfos: [
          { oracle: chainlinkOracle.address, tokenPair: ADDRESS_ZERO, weight: 50 },
          { oracle: redstoneOracle.address, tokenPair: ADDRESS_ZERO, weight: 50 },
        ],
        decimals: 18,
        token: testToken.address
      };
      await oracleAggregator.ownerInsertOrUpdateToken(
        tokenInfo
      );
      const price = await oracleAggregator.getPrice(testToken.address);
      expect(price.value).to.eq(parseEther('1.5'));
    });

    it('returns the correct price with 25/75 token weights', async () => {
      await chainlinkOracle.ownerInsertOrUpdateOracleToken(
        testToken.address,
        18,
        testAggregator.address,
        false
      );
      await redstoneOracle.ownerInsertOrUpdateOracleToken(
        testToken.address,
        18,
        testAggregator2.address,
        false
      );
      const tokenInfo: TokenInfo = {
        oracleInfos: [
          { oracle: chainlinkOracle.address, tokenPair: ADDRESS_ZERO, weight: 25 },
          { oracle: redstoneOracle.address, tokenPair: ADDRESS_ZERO, weight: 75 },
        ],
        decimals: 18,
        token: testToken.address
      };
      await oracleAggregator.ownerInsertOrUpdateToken(
        tokenInfo
      );
      const price = await oracleAggregator.getPrice(testToken.address);
      expect(price.value).to.eq(parseEther('1.75'));
    });

    it('reverts when an invalid address is passed in', async () => {
      const ONE_ADDRESS = '0x1000000000000000000000000000000000000000';
      await expectThrow(
        oracleAggregator.getPrice(ZERO_ADDRESS),
        `OracleAggregatorV2: No oracles for token <${ZERO_ADDRESS}>`,
      );
      await expectThrow(
        oracleAggregator.getPrice(ONE_ADDRESS),
        `OracleAggregatorV2: No oracles for token <${ONE_ADDRESS}>`,
      );
    });
  });

  describe('#ownerInsertOrUpdateToken', () => {
    it('can insert a new oracle', async () => {
      const tokenAddress = testToken.address;
      await chainlinkOracle.ownerInsertOrUpdateOracleToken(
        tokenAddress,
        18,
        testAggregator.address,
        false
      );
      const tokenInfo: TokenInfo = {
        oracleInfos: [
          { oracle: chainlinkOracle.address, tokenPair: core.tokens.weth.address, weight: 100 },
        ],
        decimals: 18,
        token: testToken.address
      };
      await oracleAggregator.ownerInsertOrUpdateToken(
        tokenInfo
      );
      await expectTokenInfo(oracleAggregator, testToken.address, 18);
      await expectOracleInfo(
        oracleAggregator,
        tokenAddress,
        0,
        chainlinkOracle.address,
        core.tokens.weth.address,
        100,
        1,
      );
    });

    it('can update an existing oracle', async () => {
      let tokenInfo: TokenInfo = {
        oracleInfos: [
          { oracle: chainlinkOracle.address, tokenPair: core.tokens.weth.address, weight: 100 },
        ],
        decimals: 18,
        token: testToken.address
      };
      await chainlinkOracle.ownerInsertOrUpdateOracleToken(
        testToken.address,
        18,
        testAggregator.address,
        false
      );
      await oracleAggregator.ownerInsertOrUpdateToken(tokenInfo);

      await expectTokenInfo(oracleAggregator, testToken.address, 18);
      await expectOracleInfo(
        oracleAggregator,
        testToken.address,
        0,
        chainlinkOracle.address,
        core.tokens.weth.address,
        100,
        1,
      );

      tokenInfo = {
        oracleInfos: [
          { oracle: chainlinkOracle.address, tokenPair: ADDRESS_ZERO, weight: 100 },
        ],
        decimals: 18,
        token: testToken.address
      };
      await oracleAggregator.ownerInsertOrUpdateToken(tokenInfo);
      await expectTokenInfo(oracleAggregator, testToken.address, 18);
      await expectOracleInfo(
        oracleAggregator,
        testToken.address,
        0,
        chainlinkOracle.address,
        ADDRESS_ZERO,
        100,
        1,
      );
    });

    it('fails when invoked by non-admin', async () => {
      const tokenInfo: TokenInfo = {
        oracleInfos: [
          { oracle: chainlinkOracle.address, tokenPair: core.tokens.weth.address, weight: 100 },
        ],
        decimals: 18,
        token: testToken.address
      };
      await expectThrow(
        oracleAggregator.connect(core.hhUser1).ownerInsertOrUpdateToken(
          tokenInfo
        ),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('can be set as the oracle for a market', async () => {
      await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.weth, oracleAggregator.address);
      const price = await core.dolomiteMargin.getMarketPrice(core.marketIds.weth);
      expect(price.value).to.eq(WETH_PRICE);
    });
  });
});

async function expectTokenInfo(
  oracleAggregator: OracleAggregatorV2,
  token: string,
  decimals: number
) {
  const tokenInfo = (await oracleAggregator.getTokenInfo(token));
  expect(tokenInfo.token).to.eq(token);
  expect(tokenInfo.decimals).to.eq(decimals);
}

async function expectOracleInfo(
  oracleAggregator: OracleAggregatorV2,
  token: string,
  index: number,
  oracle: string,
  tokenPair: string,
  weight: number,
  length: number,
) {
  const oracleInfos = await oracleAggregator.getOraclesByToken(token);
  expect(oracleInfos.length).to.eq(length);
  const oracleInfo = oracleInfos[index];
  expect(oracleInfo.oracle).to.eq(oracle);
  expect(oracleInfo.tokenPair).to.eq(tokenPair);
  expect(oracleInfo.weight).to.eq(weight);
}
