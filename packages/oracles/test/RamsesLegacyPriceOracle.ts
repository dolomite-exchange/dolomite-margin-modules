import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import {
  RamsesLegacyPriceOracle,
  RamsesLegacyPriceOracle__factory,
} from '../src/types';
import { createContractWithAbi } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { TokenInfo } from '../src';
import { increaseTo } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';

const GRAI_TOKEN = '0x894134a25a5faC1c2C26F1d8fBf05111a3CB9487';
const FRAX_TOKEN = '0x17FC002b466eEc40DaE837Fc4bE5c67993ddBd6F';
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
        GRAI_TOKEN,
        GRAI_FRAX_POOL,
        core.dolomiteRegistry.address,
        core.dolomiteMargin.address,
      ]
    );

    const tokenInfo: TokenInfo = {
      oracleInfos: [
        { oracle: graiFraxOracle.address, tokenPair: FRAX_TOKEN, weight: 100 },
      ],
      decimals: 18,
      token: GRAI_TOKEN
    };
    await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken(tokenInfo);
    const frax: TokenInfo = {
      oracleInfos: [
        { oracle: core.chainlinkPriceOracleV3.address, tokenPair: ADDRESS_ZERO, weight: 100 },
      ],
      decimals: 18,
      token: FRAX_TOKEN
    };
    await core.chainlinkPriceOracleV3.connect(core.governance).ownerInsertOrUpdateOracleToken(
      FRAX_TOKEN,
      FRAX_PRICE_FEED,
      false
    );
    await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken(frax);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await graiFraxOracle.TOKEN()).to.eq(GRAI_TOKEN);
      expect(await graiFraxOracle.TOKEN_DECIMALS_FACTOR()).to.eq(parseEther('1'));
      expect(await graiFraxOracle.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await graiFraxOracle.PAIR()).to.eq(GRAI_FRAX_POOL);
    });
  });

  describe('#getPrice', () => {
    it('should work normally', async () => {
      await increaseTo(1_715_107_400);
      const price = await core.oracleAggregatorV2.getPrice(GRAI_TOKEN);
      expect(price.value).to.eq(GRAI_PRICE_FRAX_POOL);
    });

    it('should fail if invalid input token', async () => {
      await expectThrow(
        graiFraxOracle.connect(core.hhUser1).getPrice(core.tokens.weth.address),
        `RamsesLegacyPriceOracle: Invalid token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });
  });
});
