import { CoreProtocolPolygonZkEvm } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import {
  ChainlinkPriceOracleV3,
  ChainlinkPriceOracleV3__factory,
  OracleAggregator2,
  OracleAggregator2__factory,
  PancakeV3PriceOracle,
  PancakeV3PriceOracle__factory
} from '../src/types';
import { DolomiteRegistryImplementation, DolomiteRegistryImplementation__factory } from '@dolomite-exchange/modules-base/src/types';
import { getChainlinkPriceOracleV3ConstructorParamsFromChainlinkOracleV1ZkEvm } from '../src/oracles-constructors';
import { createContractWithAbi } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network, ONE_DAY_SECONDS } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { TokenInfo } from '../src';

const CAKE_PRICE_USDC_POOL = BigNumber.from('4051451897684840000');
const MATIC_WETH_PRICE = BigNumber.from('293570325619366');
const MATIC_PRICE = BigNumber.from('1016261890000000000');
const FIFTEEN_MINUTES = BigNumber.from('900');

// Using CAKE token because it has WETH and USDC pair
const CAKE_TOKEN = '0x0D1E753a25eBda689453309112904807625bEFBe';
const LEGACY_USDC = '0xA8CE8aee21bC2A48a5EF670afCc9274C7bbbC035';
const CAKE_USDC_PAIR = '0xb4BAB40e5a869eF1b5ff440a170A57d9feb228e9';
const WETH_MATIC_PAIR = '0xaE30fcdEE41dC9eC265e841D8185d055B87d1B7a';

describe('PancakeV3PriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocolPolygonZkEvm;
  let oracle: PancakeV3PriceOracle;
  let maticOracle: PancakeV3PriceOracle;
  let chainlinkOracle: ChainlinkPriceOracleV3;
  let oracleAggregator: OracleAggregator2;

  before(async () => {
    const blockNumber = 10_863_200;
    core = await setupCoreProtocol({
      blockNumber,
      network: Network.PolygonZkEvm,
    });

    const dolomiteRegistryImplementation = await createContractWithAbi<DolomiteRegistryImplementation>(
      DolomiteRegistryImplementation__factory.abi,
      DolomiteRegistryImplementation__factory.bytecode,
      [],
    );
    await core.dolomiteRegistryProxy.connect(core.governance).upgradeTo(dolomiteRegistryImplementation.address);

    oracle = await createContractWithAbi<PancakeV3PriceOracle>(
      PancakeV3PriceOracle__factory.abi,
      PancakeV3PriceOracle__factory.bytecode,
      [
        CAKE_TOKEN,
        CAKE_USDC_PAIR,
        core.dolomiteRegistry.address,
        core.dolomiteMargin.address,
      ]
    );
    maticOracle = await createContractWithAbi<PancakeV3PriceOracle>(
      PancakeV3PriceOracle__factory.abi,
      PancakeV3PriceOracle__factory.bytecode,
      [
        core.tokens.matic.address,
        WETH_MATIC_PAIR,
        core.dolomiteRegistry.address,
        core.dolomiteMargin.address
      ],
    );

    chainlinkOracle = (await createContractWithAbi<ChainlinkPriceOracleV3>(
      ChainlinkPriceOracleV3__factory.abi,
      ChainlinkPriceOracleV3__factory.bytecode,
      await getChainlinkPriceOracleV3ConstructorParamsFromChainlinkOracleV1ZkEvm(core),
    )).connect(core.governance);

    const tokenInfos: TokenInfo[] = [
      {
        oracleInfos: [
          { oracle: chainlinkOracle.address, tokenPair: ADDRESS_ZERO, weight: 100 },
        ],
        decimals: 6,
        token: LEGACY_USDC
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
          { oracle: oracle.address, tokenPair: LEGACY_USDC, weight: 100 },
        ],
        decimals: 18,
        token: CAKE_TOKEN
      },
      {
        oracleInfos: [
          { oracle: maticOracle.address, tokenPair: core.tokens.matic.address, weight: 100 },
        ],
        decimals: 18,
        token: core.tokens.matic.address
      }
    ];
    oracleAggregator = (await createContractWithAbi<OracleAggregator2>(
      OracleAggregator2__factory.abi,
      OracleAggregator2__factory.bytecode,
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
      expect(await oracle.TOKEN()).to.eq(CAKE_TOKEN);
      expect(await oracle.TOKEN_DECIMALS_FACTOR()).to.eq(parseEther('1'));
      expect(await oracle.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await oracle.observationInterval()).to.eq(FIFTEEN_MINUTES);
      expect(await oracle.pair()).to.eq(CAKE_USDC_PAIR);
    });
  });

  describe('#getPrice', () => {
    it('should work normally with usdc as output token', async () => {
      const price = await oracleAggregator.getPrice(CAKE_TOKEN);
      expect(price.value).to.eq(CAKE_PRICE_USDC_POOL);
    });

    // Using USDT and WETH pool to test with token0 as output token
    it('should work normally when output token is token0', async () => {
      const otherOracle = await createContractWithAbi<PancakeV3PriceOracle>(
        PancakeV3PriceOracle__factory.abi,
        PancakeV3PriceOracle__factory.bytecode,
        [core.tokens.matic.address, WETH_MATIC_PAIR, core.dolomiteRegistry.address, core.dolomiteMargin.address],
      );
      const price = (await otherOracle.getPrice(core.tokens.matic.address)).value;
      expect(price).to.eq(MATIC_WETH_PRICE);

      const dolomitePrice = (await core.dolomiteMargin.getMarketPrice(core.marketIds.matic)).value;
      expect(dolomitePrice).to.eq(MATIC_PRICE);
    });

    it('should fail if invalid input token', async () => {
      await expectThrow(
        oracle.connect(core.hhUser1).getPrice(core.tokens.weth.address),
        `PancakeV3PriceOracle: Invalid token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetObservationInterval', () => {
    it('works normally', async () => {
      const stalenessThreshold = ONE_DAY_SECONDS;
      await oracle.connect(core.governance).ownerSetObservationInterval(stalenessThreshold);
      expect(await oracle.observationInterval()).to.eq(stalenessThreshold);
    });

    it('fails when invoked by non-admin', async () => {
      await expectThrow(
        oracle.connect(core.hhUser1).ownerSetObservationInterval(ONE_DAY_SECONDS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });
});
