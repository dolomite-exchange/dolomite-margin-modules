
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import {
  ChainlinkPriceOracleV3,
  ChainlinkPriceOracleV3__factory,
  OracleAggregatorV2,
  OracleAggregatorV2__factory,
  TWAPPriceOracleV2,
  TWAPPriceOracleV2__factory
} from '../src/types';
import { DolomiteRegistryImplementation, DolomiteRegistryImplementation__factory } from '@dolomite-exchange/modules-base/src/types';
import { getChainlinkPriceOracleV3ConstructorParamsFromChainlinkOracleV1, getTWAPPriceOracleV2ConstructorParams } from '../src/oracles-constructors';
import { createContractWithAbi } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network, ONE_DAY_SECONDS } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { TokenInfo } from '../src';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';

const ARB_WETH_POOL = '0xe51635ae8136aBAc44906A8f230C2D235E9c195F';
const ARB_PRICE_WETH_POOL = BigNumber.from('920176763082082501');

const GRAIL_PRICE_USDC_POOL = BigNumber.from('789325473810421340000');
const GRAIL_PRICE_WETH_POOL = BigNumber.from('792088096763836295510');
const FIFTEEN_MINUTES = BigNumber.from('900');

describe('TWAPPriceOracleV2', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let grailUsdcOracle: TWAPPriceOracleV2;
  let grailWethOracle: TWAPPriceOracleV2;
  let chainlinkOracle: ChainlinkPriceOracleV3;
  let oracleAggregator: OracleAggregatorV2;

  before(async () => {
    const blockNumber = 144_700_000;
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

    grailUsdcOracle = await createContractWithAbi<TWAPPriceOracleV2>(
      TWAPPriceOracleV2__factory.abi,
      TWAPPriceOracleV2__factory.bytecode,
      getTWAPPriceOracleV2ConstructorParams(
        core,
        core.tokens.grail!,
        core.camelotEcosystem.grailUsdcV3Pool
      )
    );
    grailWethOracle = await createContractWithAbi<TWAPPriceOracleV2>(
      TWAPPriceOracleV2__factory.abi,
      TWAPPriceOracleV2__factory.bytecode,
      getTWAPPriceOracleV2ConstructorParams(
        core,
        core.tokens.grail!,
        core.camelotEcosystem.grailWethV3Pool
      )
    );

    chainlinkOracle = (await createContractWithAbi<ChainlinkPriceOracleV3>(
      ChainlinkPriceOracleV3__factory.abi,
      ChainlinkPriceOracleV3__factory.bytecode,
      await getChainlinkPriceOracleV3ConstructorParamsFromChainlinkOracleV1(core),
    )).connect(core.governance);

    const tokenInfos: TokenInfo[] = [
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
        decimals: 18,
        token: core.tokens.weth.address
      },
      {
        oracleInfos: [
          { oracle: grailUsdcOracle.address, tokenPair: core.tokens.usdc.address, weight: 100 },
        ],
        decimals: 18,
        token: core.tokens.grail!.address
      },
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

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await grailUsdcOracle.TOKEN()).to.eq(core.tokens.grail!.address);
      expect(await grailUsdcOracle.TOKEN_DECIMALS_FACTOR()).to.eq(parseEther('1'));
      expect(await grailUsdcOracle.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await grailUsdcOracle.observationInterval()).to.eq(FIFTEEN_MINUTES);
      expect(await grailUsdcOracle.PAIR()).to.eq(core.camelotEcosystem.grailUsdcV3Pool.address);
    });
  });

  describe('#getPrice', () => {
    it('should work normally with usdc as output token', async () => {
      const price = await oracleAggregator.getPrice(core.tokens.grail.address);
      expect(price.value).to.eq(GRAIL_PRICE_USDC_POOL);
    });

    it('should work normally when using two pools', async () => {
      const tokenInfo: TokenInfo = {
        oracleInfos: [
          { oracle: grailUsdcOracle.address, tokenPair: core.tokens.usdc.address, weight: 50 },
          { oracle: grailWethOracle.address, tokenPair: core.tokens.weth.address, weight: 50 },
        ],
        decimals: 18,
        token: core.tokens.grail!.address
      };
      await oracleAggregator.connect(core.governance).ownerInsertOrUpdateToken(tokenInfo);
      const price = await oracleAggregator.getPrice(core.tokens.grail.address);
      expect(price.value).to.eq(GRAIL_PRICE_USDC_POOL.add(GRAIL_PRICE_WETH_POOL).div(2));
    });

    // No pool with GRAIL for this so testing with ETH and ARB pool
    it('should work normally when output token is token0', async () => {
      const otherOracle = await createContractWithAbi<TWAPPriceOracleV2>(
        TWAPPriceOracleV2__factory.abi,
        TWAPPriceOracleV2__factory.bytecode,
        [core.tokens.arb.address, ARB_WETH_POOL, core.dolomiteRegistry.address, core.dolomiteMargin.address],
      );
      const tokenInfo: TokenInfo = {
        oracleInfos: [
          { oracle: otherOracle.address, tokenPair: core.tokens.weth.address, weight: 100 },
        ],
        decimals: 18,
        token: core.tokens.arb.address
      };
      await oracleAggregator.connect(core.governance).ownerInsertOrUpdateToken(tokenInfo);
      const price = (await oracleAggregator.getPrice(core.tokens.arb.address)).value;
      expect(price).to.eq(ARB_PRICE_WETH_POOL);
    });

    it('should fail if invalid input token', async () => {
      await expectThrow(
        grailUsdcOracle.connect(core.hhUser1).getPrice(core.tokens.weth.address),
        `TWAPPriceOracleV2: Invalid token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetObservationInterval', () => {
    it('works normally', async () => {
      const stalenessThreshold = ONE_DAY_SECONDS;
      await grailUsdcOracle.connect(core.governance).ownerSetObservationInterval(stalenessThreshold);
      expect(await grailUsdcOracle.observationInterval()).to.eq(stalenessThreshold);
    });

    it('fails when invoked by non-admin', async () => {
      await expectThrow(
        grailUsdcOracle.connect(core.hhUser1).ownerSetObservationInterval(ONE_DAY_SECONDS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });
});
