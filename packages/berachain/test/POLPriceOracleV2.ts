import { DolomiteERC4626, DolomiteERC4626__factory } from '@dolomite-exchange/modules-base/src/types';
import { Network, ONE_ETH_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import {
  disableInterestAccrual,
  setupCoreProtocol,
  setupTestMarket,
  setupWETHBalance,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { createContractWithAbi, depositIntoDolomiteMargin } from 'packages/base/src/utils/dolomite-utils';
import { expectThrow } from 'packages/base/test/utils/assertions';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import { createLiquidatorProxyV6 } from 'packages/base/test/utils/dolomite';
import {
  BerachainRewardsRegistry,
  InfraredBGTMetaVault,
  InfraredBGTMetaVault__factory,
  POLIsolationModeVaultFactory,
  POLPriceOracleV2,
  POLPriceOracleV2__factory,
} from '../src/types';
import {
  createBerachainRewardsRegistry,
  createPOLIsolationModeTokenVaultV1,
  createPOLIsolationModeVaultFactory,
  createPolLiquidatorProxy,
} from './berachain-ecosystem-utils';

const defaultAccountNumber = ZERO_BI;

describe('POLPriceOracleV2', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;

  let registry: BerachainRewardsRegistry;
  let factory: POLIsolationModeVaultFactory;
  let oracle: POLPriceOracleV2;
  let dToken: DolomiteERC4626;
  let marketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 1_679_500,
      network: Network.Berachain,
    });

    dToken = DolomiteERC4626__factory.connect(core.dolomiteTokens.weth!.address, core.hhUser1);

    const metaVaultImplementation = await createContractWithAbi<InfraredBGTMetaVault>(
      InfraredBGTMetaVault__factory.abi,
      InfraredBGTMetaVault__factory.bytecode,
      [],
    );
    const liquidatorProxyV6 = await createLiquidatorProxyV6(core);
    const polLiquidatorProxy = await createPolLiquidatorProxy(core, liquidatorProxyV6);
    registry = await createBerachainRewardsRegistry(core, metaVaultImplementation, polLiquidatorProxy);

    const vaultImplementation = await createPOLIsolationModeTokenVaultV1();
    factory = await createPOLIsolationModeVaultFactory(core, registry, dToken, vaultImplementation, [], []);

    marketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(factory.address, parseEther('2000')); // same price as WETH
    await setupTestMarket(core, factory, true);

    oracle = await createContractWithAbi<POLPriceOracleV2>(
      POLPriceOracleV2__factory.abi,
      POLPriceOracleV2__factory.bytecode,
      [factory.address, core.dolomiteMargin.address],
    );
    await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
      token: factory.address,
      decimals: 18,
      oracleInfos: [
        {
          oracle: oracle.address,
          tokenPair: core.tokens.weth.address,
          weight: 100,
        },
      ],
    });
    await core.dolomiteMargin.connect(core.governance).ownerSetPriceOracle(marketId, core.oracleAggregatorV2.address);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await factory.connect(core.governance).ownerInitialize([]);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#getPrice', () => {
    it('should work normally', async () => {
      await disableInterestAccrual(core, core.marketIds.weth);
      await setupWETHBalance(core, core.hhUser1, ONE_ETH_BI, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, ONE_ETH_BI);

      const supplyIndex = (await core.dolomiteMargin.getMarketCurrentIndex(core.marketIds.weth)).supply;
      const wethPrice = (await core.dolomiteMargin.getMarketPrice(core.marketIds.weth)).value;
      const expectedPrice = wethPrice.mul(supplyIndex).div(ONE_ETH_BI);
      expect((await core.dolomiteMargin.getMarketPrice(marketId)).value).to.equal(expectedPrice);
    });

    it('should fail with invalid token', async () => {
      await expectThrow(
        oracle.getPrice(core.tokens.weth.address),
        `POLPriceOracleV2: Invalid token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if market is not closing', async () => {
      await core.dolomiteMargin.connect(core.governance).ownerSetIsClosing(marketId, false);
      await expectThrow(oracle.getPrice(factory.address), 'POLPriceOracleV2: POL cannot be borrowable');
    });
  });

  describe('#getDecimalsByToken', () => {
    it('should work normally', async () => {
      expect(await oracle.getDecimalsByToken(factory.address)).to.equal(18);
    });
  });
});
