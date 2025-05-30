import {
  DolomiteRegistryImplementation,
  DolomiteRegistryImplementation__factory,
} from '@dolomite-exchange/modules-base/src/types';
import { createContractWithAbi } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ONE_DAY_SECONDS } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import { TokenInfo } from '../src';
import { PancakeV3PriceOracle, PancakeV3PriceOracle__factory } from '../src/types';

const WBERA_USDC_KODIAK_POOL_PRICE = BigNumber.from('6895047921730619496');
const FIFTEEN_MINUTES = BigNumber.from('900');

// Using CAKE token because it has WETH and USDC pair
const HONEY_WBERA_KODIAK_POOL = '0x8a960A6e5f224D0a88BaD10463bDAD161b68C144';

describe('KodiakPriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let oracle: PancakeV3PriceOracle;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.Berachain,
      blockNumber: 9_562_000,
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
      [core.tokens.wbera.address, HONEY_WBERA_KODIAK_POOL, core.dolomiteRegistry.address, core.dolomiteMargin.address],
    );
    const tokenInfo: TokenInfo = {
      oracleInfos: [{ oracle: oracle.address, tokenPair: core.tokens.honey.address, weight: 100 }],
      decimals: 18,
      token: core.tokens.wbera.address,
    };

    await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken(tokenInfo);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await oracle.TOKEN()).to.eq(core.tokens.wbera.address);
      expect(await oracle.TOKEN_DECIMALS_FACTOR()).to.eq(parseEther('1'));
      expect(await oracle.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await oracle.observationInterval()).to.eq(FIFTEEN_MINUTES);
      expect(await oracle.PAIR()).to.eq(HONEY_WBERA_KODIAK_POOL);
    });
  });

  describe('#getPrice', () => {
    it('should work normally with wbera as output token', async () => {
      const price = await core.oracleAggregatorV2.getPrice(core.tokens.wbera.address);
      expect(price.value).to.eq(WBERA_USDC_KODIAK_POOL_PRICE);
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
