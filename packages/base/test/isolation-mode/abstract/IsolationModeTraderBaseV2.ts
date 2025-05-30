import {
  CustomTestToken,
  TestIsolationModeVaultFactory,
  TestIsolationModeTokenVaultV1,
  TestIsolationModeTraderBaseV2,
  TestIsolationModeTraderBaseV2__factory,
} from '@dolomite-exchange/modules-base/src/types';
import {
  createContractWithAbi,
  createContractWithLibrary,
  createTestToken,
} from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { createIsolationModeTokenVaultV1ActionsImpl } from '@dolomite-exchange/modules-base/test/utils/dolomite';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { getDefaultCoreProtocolConfig, setupCoreProtocol, setupTestMarket } from 'packages/base/test/utils/setup';

import { CoreProtocolArbitrumOne } from '../../utils/core-protocols/core-protocol-arbitrum-one';
import { createTestIsolationModeVaultFactory } from '../../utils/ecosystem-utils/testers';

describe('IsolationModeTraderBaseV2', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let trader: TestIsolationModeTraderBaseV2;
  let underlyingToken: CustomTestToken;
  let underlyingMarketId: BigNumber;
  let factory: TestIsolationModeVaultFactory;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    underlyingToken = await createTestToken();
    const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
    const userVaultImplementation = await createContractWithLibrary<TestIsolationModeTokenVaultV1>(
      'TestIsolationModeTokenVaultV1',
      libraries,
      [],
    );
    factory = await createTestIsolationModeVaultFactory(core, underlyingToken, userVaultImplementation);
    await core.testEcosystem!.testPriceOracle.setPrice(
      factory.address,
      '1000000000000000000', // $1.00
    );
    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true);

    trader = await createContractWithAbi<TestIsolationModeTraderBaseV2>(
      TestIsolationModeTraderBaseV2__factory.abi,
      TestIsolationModeTraderBaseV2__factory.bytecode,
      [factory.address, core.dolomiteMargin.address, core.dolomiteRegistry.address],
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await trader.VAULT_FACTORY()).to.eq(factory.address);
      expect(await trader.DOLOMITE_REGISTRY()).to.eq(core.dolomiteRegistry.address);
      expect(await trader.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
    });
  });

  describe('#testIsValidLiquidator', () => {
    it('should work normally', async () => {
      await core.liquidatorAssetRegistry.ownerAddLiquidatorToAssetWhitelist(underlyingMarketId, core.hhUser5.address);
      expect(await trader.connect(core.hhUser5).testIsValidLiquidator(underlyingMarketId)).to.eq(true);
    });

    it('should fail if not valid liquidator', async () => {
      expect(await trader.connect(core.hhUser5).testIsValidLiquidator(underlyingMarketId)).to.eq(false);
    });
  });

  describe('#testOnlyGenericTraderOrTrustedLiquidator', async () => {
    it('should work if generic trader', async () => {
      const genericTraderImpersonator = await impersonate(await core.dolomiteRegistry.genericTraderProxy(), true);
      await trader.connect(genericTraderImpersonator).testOnlyGenericTraderOrTrustedLiquidator();
    });

    it('should work if trusted liquidator', async () => {
      await core.liquidatorAssetRegistry.ownerAddLiquidatorToAssetWhitelist(underlyingMarketId, core.hhUser5.address);
      await trader.connect(core.hhUser5).testOnlyGenericTraderOrTrustedLiquidator();
    });

    it('should fail if not generic trader or trusted liquidator', async () => {
      await expectThrow(
        trader.connect(core.hhUser5).testOnlyGenericTraderOrTrustedLiquidator(),
        `IsolationModeTraderBaseV2: Caller is not authorized <${core.hhUser5.address.toLowerCase()}>`,
      );
    });
  });
});
