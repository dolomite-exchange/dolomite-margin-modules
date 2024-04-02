import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  ChainlinkPriceOracleV3,
  ChainlinkPriceOracleV3__factory,
  OracleAggregatorV1,
  OracleAggregatorV1__factory,
  RedstonePriceOracleV3,
  RedstonePriceOracleV3__factory,
  TestChainlinkAggregator,
  TestChainlinkAggregator__factory,
} from '../src/types';
import {
  CustomTestToken,
} from '@dolomite-exchange/modules-base/src/types';
import {
  getChainlinkPriceOracleV3ConstructorParamsFromChainlinkOracleV1,
  getOracleAggregatorV1ConstructorParams,
  getRedstonePriceOracleV3ConstructorParams
} from '../src/oracles-constructors';
import { createContractWithAbi, createTestToken } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import {
  Network,
  TEN_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { WE_ETH_ETH_REDSTONE_FEED_MAP } from 'packages/base/src/utils/constants';

const WETH_PRICE = BigNumber.from('2260038782330000000000');
const BTC_PRICE = BigNumber.from('440493939086400000000000000000000');
const USDC_PRICE = BigNumber.from('1000071010000000000000000000000');
const TEST_TOKEN_PRICE = WETH_PRICE.mul(1).div(10);

xdescribe('OracleAggregatorV1', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;

  let chainlinkOracle: ChainlinkPriceOracleV3;
  let redstoneOracle: RedstonePriceOracleV3;
  let testAggregator: TestChainlinkAggregator;
  let testToken: CustomTestToken;
  let oracleAggregator: OracleAggregatorV1;

  before(async () => {
    core = await setupCoreProtocol(await getDefaultCoreProtocolConfig(Network.ArbitrumOne));

    testAggregator = await createContractWithAbi<TestChainlinkAggregator>(
      TestChainlinkAggregator__factory.abi,
      TestChainlinkAggregator__factory.bytecode,
      [],
    );
    testToken = await createTestToken();
    await testAggregator.setLatestAnswer(TEN_BI.pow(18).div(10)); // 0.1E
    await testAggregator.setDecimals(18);

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

    oracleAggregator = (await createContractWithAbi<OracleAggregatorV1>(
      OracleAggregatorV1__factory.abi,
      OracleAggregatorV1__factory.bytecode,
      await getOracleAggregatorV1ConstructorParams(core, chainlinkOracle, redstoneOracle),
    )).connect(core.governance);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should succeed when values are aligned', async () => {
      await createContractWithAbi<OracleAggregatorV1>(
        OracleAggregatorV1__factory.abi,
        OracleAggregatorV1__factory.bytecode,
        [
          [ZERO_ADDRESS],
          [ZERO_ADDRESS],
          [ZERO_ADDRESS],
          core.dolomiteMargin.address,
        ],
      );
    });

    it('should fail when token length is not aligned', async () => {
      await expectThrow(
        createContractWithAbi<OracleAggregatorV1>(
          OracleAggregatorV1__factory.abi,
          OracleAggregatorV1__factory.bytecode,
          [
            [ZERO_ADDRESS],
            [ZERO_ADDRESS, ZERO_ADDRESS],
            [ZERO_ADDRESS],
            core.dolomiteMargin.address,
          ],
        ),
        'OracleAggregatorV1: Invalid tokens length',
      );
    });

    it('should fail when token length is not aligned', async () => {
      await expectThrow(
        createContractWithAbi<OracleAggregatorV1>(
          OracleAggregatorV1__factory.abi,
          OracleAggregatorV1__factory.bytecode,
          [
            [ZERO_ADDRESS],
            [ZERO_ADDRESS],
            [ZERO_ADDRESS, ZERO_ADDRESS],
            core.dolomiteMargin.address,
          ],
        ),
        'OracleAggregatorV1: Invalid oracles length',
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
        testAggregator.address,
        false
      );
      await oracleAggregator.ownerInsertOrUpdateOracle(
        testToken.address,
        chainlinkOracle.address,
        core.tokens.weth.address
      );
      const price = await oracleAggregator.getPrice(testToken.address);
      expect(price.value).to.eq(TEST_TOKEN_PRICE);
    });

    it('reverts when an invalid address is passed in', async () => {
      const ONE_ADDRESS = '0x1000000000000000000000000000000000000000';
      await expectThrow(
        oracleAggregator.getPrice(ZERO_ADDRESS),
        `OracleAggregatorV1: Invalid token <${ZERO_ADDRESS}>`,
      );
      await expectThrow(
        oracleAggregator.getPrice(ONE_ADDRESS),
        `OracleAggregatorV1: Invalid token <${ONE_ADDRESS}>`,
      );
    });
  });

  describe('#ownerInsertOrUpdateOracle', () => {
    it('can insert a new oracle', async () => {
      const tokenAddress = testToken.address;
      await chainlinkOracle.ownerInsertOrUpdateOracleToken(
        tokenAddress,
        18,
        testAggregator.address,
        false
      );
      await oracleAggregator.ownerInsertOrUpdateOracle(
        tokenAddress,
        chainlinkOracle.address,
        ZERO_ADDRESS
      );
      expect(await oracleAggregator.getOracleByToken(tokenAddress)).to.eq(chainlinkOracle.address);
      expect(await oracleAggregator.getTokenPairByToken(tokenAddress)).to.eq(ZERO_ADDRESS);
    });

    it('can update an existing oracle', async () => {
      const tokenAddress = testToken.address;
      await chainlinkOracle.ownerInsertOrUpdateOracleToken(
        tokenAddress,
        18,
        testAggregator.address,
        false
      );
      await oracleAggregator.ownerInsertOrUpdateOracle(
        tokenAddress,
        chainlinkOracle.address,
        core.tokens.usdc.address,
      );
      expect(await oracleAggregator.getOracleByToken(tokenAddress)).to.eq(chainlinkOracle.address);
      expect(await oracleAggregator.getTokenPairByToken(tokenAddress)).to.eq(core.tokens.usdc.address);
      await oracleAggregator.ownerInsertOrUpdateOracle(
        tokenAddress,
        redstoneOracle.address,
        ZERO_ADDRESS,
      );
      expect(await oracleAggregator.getOracleByToken(tokenAddress)).to.eq(redstoneOracle.address);
      expect(await oracleAggregator.getTokenPairByToken(tokenAddress)).to.eq(ZERO_ADDRESS);
    });

    it('fails when invoked by non-admin', async () => {
      await expectThrow(
        oracleAggregator.connect(core.hhUser1).ownerInsertOrUpdateOracle(
          testToken.address,
          ZERO_ADDRESS,
          ZERO_ADDRESS,
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
