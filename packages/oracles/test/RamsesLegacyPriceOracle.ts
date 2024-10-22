import { createContractWithAbi } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network, ONE_ETH_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { increaseTo } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { TokenInfo } from '../src';
import { IRamsesPool__factory, RamsesLegacyPriceOracle, RamsesLegacyPriceOracle__factory } from '../src/types';

const GRAI_FRAX_POOL = '0x6E0Ced11922386900BE369cBBF3cdb971dc58487';
const FRAX_PRICE_FEED = '0x0809E3d38d1B4214958faf06D8b1B1a2b73f2ab8';

const GRAI_PRICE_FRAX_POOL = BigNumber.from('984896046600106887');

describe('RamsesLegacyPriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let graiFraxOracle: RamsesLegacyPriceOracle;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 208_866_174,
      network: Network.ArbitrumOne,
    });

    graiFraxOracle = await createContractWithAbi<RamsesLegacyPriceOracle>(
      RamsesLegacyPriceOracle__factory.abi,
      RamsesLegacyPriceOracle__factory.bytecode,
      [
        core.tokens.grai.address,
        GRAI_FRAX_POOL,
        core.dolomiteRegistry.address,
        core.dolomiteMargin.address,
      ],
    );

    const tokenInfo: TokenInfo = {
      oracleInfos: [
        { oracle: graiFraxOracle.address, tokenPair: core.tokens.frax.address, weight: 100 },
      ],
      decimals: 18,
      token: core.tokens.grai.address,
    };
    await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken(tokenInfo);
    const frax: TokenInfo = {
      oracleInfos: [
        { oracle: core.chainlinkPriceOracleV3.address, tokenPair: ADDRESS_ZERO, weight: 100 },
      ],
      decimals: 18,
      token: core.tokens.frax.address,
    };
    await core.chainlinkPriceOracleV3.connect(core.governance).ownerInsertOrUpdateOracleToken(
      core.tokens.frax.address,
      FRAX_PRICE_FEED,
      false,
    );
    await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken(frax);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await graiFraxOracle.TOKEN()).to.eq(core.tokens.grai.address);
      expect(await graiFraxOracle.TOKEN_DECIMALS_FACTOR()).to.eq(parseEther('1'));
      expect(await graiFraxOracle.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await graiFraxOracle.PAIR()).to.eq(GRAI_FRAX_POOL);
    });
  });

  describe('#getPrice', () => {
    it('should work normally', async () => {
      await increaseTo(1_715_107_400);
      const price = await core.oracleAggregatorV2.getPrice(core.tokens.grai.address);
      expect(price.value).to.eq(GRAI_PRICE_FRAX_POOL);
    });

    it('should work normally for token1', async () => {
      const oracle = await createContractWithAbi<RamsesLegacyPriceOracle>(
        RamsesLegacyPriceOracle__factory.abi,
        RamsesLegacyPriceOracle__factory.bytecode,
        [
          core.tokens.frax.address,
          GRAI_FRAX_POOL,
          core.dolomiteRegistry.address,
          core.dolomiteMargin.address,
        ],
      );
      const pair = IRamsesPool__factory.connect(GRAI_FRAX_POOL, core.hhUser1);
      const price = await oracle.getPrice(core.tokens.frax.address);
      expect(await pair.current(core.tokens.frax.address, ONE_ETH_BI)).to.eq(price.value);
    });

    it('should fail if invalid input token', async () => {
      await expectThrow(
        graiFraxOracle.connect(core.hhUser1).getPrice(core.tokens.weth.address),
        `RamsesLegacyPriceOracle: Invalid token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });
  });
});
