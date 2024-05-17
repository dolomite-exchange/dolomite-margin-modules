import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectEvent, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupTestMarket,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  JonesUSDCIsolationModeTokenVaultV1,
  JonesUSDCIsolationModeVaultFactory,
  JonesUSDCRegistry,
} from '../src/types';
import {
  createJonesUSDCIsolationModeTokenVaultV1,
  createJonesUSDCIsolationModeUnwrapperTraderV2ForLiquidation,
  createJonesUSDCIsolationModeUnwrapperTraderV2ForZap,
  createJonesUSDCIsolationModeVaultFactory,
  createJonesUSDCIsolationModeWrapperTraderV2,
  createJonesUSDCPriceOracle,
  createJonesUSDCRegistry,
} from './jones-ecosystem-utils';
import { createRoleAndWhitelistTraderV2, JONES_CORE_PROTOCOL_CONFIG } from './jones-utils';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('JonesUSDCIsolationModeVaultFactory', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let jonesUSDCRegistry: JonesUSDCRegistry;
  let vaultImplementation: JonesUSDCIsolationModeTokenVaultV1;
  let factory: JonesUSDCIsolationModeVaultFactory;
  let underlyingMarketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol(JONES_CORE_PROTOCOL_CONFIG);
    jonesUSDCRegistry = await createJonesUSDCRegistry(core);
    vaultImplementation = await createJonesUSDCIsolationModeTokenVaultV1();
    factory = await createJonesUSDCIsolationModeVaultFactory(
      core,
      jonesUSDCRegistry,
      core.jonesEcosystem!.jUSDCV1,
      (vaultImplementation as any) as JonesUSDCIsolationModeTokenVaultV1,
    );

    const unwrapperTraderForLiquidation = await createJonesUSDCIsolationModeUnwrapperTraderV2ForLiquidation(
      core,
      jonesUSDCRegistry,
      factory,
    );
    const unwrapperTraderForZap = await createJonesUSDCIsolationModeUnwrapperTraderV2ForZap(
      core,
      jonesUSDCRegistry,
      factory,
    );
    await jonesUSDCRegistry.initializeUnwrapperTraders(
      unwrapperTraderForLiquidation.address,
      unwrapperTraderForZap.address,
    );
    const wrapper = await createJonesUSDCIsolationModeWrapperTraderV2(core, jonesUSDCRegistry, factory);
    await createRoleAndWhitelistTraderV2(core, unwrapperTraderForLiquidation, wrapper);
    const priceOracle = await createJonesUSDCPriceOracle(core, jonesUSDCRegistry, factory);

    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, priceOracle);
    await core.dolomiteMargin.ownerSetPriceOracle(underlyingMarketId, priceOracle.address);

    await factory.connect(core.governance).ownerInitialize([unwrapperTraderForLiquidation.address, wrapper.address]);
    await factory.connect(core.governance).ownerSetAllowableCollateralMarketIds([underlyingMarketId]);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#contructor', () => {
    it('should initialize variables properly', async () => {
      expect(await factory.jonesUSDCRegistry()).to.equal(jonesUSDCRegistry.address);
      expect(await factory.UNDERLYING_TOKEN()).to.equal(core.jonesEcosystem!.jUSDCV1.address);
      expect(await factory.BORROW_POSITION_PROXY()).to.equal(core.borrowPositionProxyV2.address);
      expect(await factory.userVaultImplementation()).to.equal(vaultImplementation.address);
      expect(await factory.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
    });
  });

  describe('#ownerSetJonesUSDCRegistry', () => {
    it('should work normally', async () => {
      const result = await factory.connect(core.governance).ownerSetJonesUSDCRegistry(OTHER_ADDRESS);
      await expectEvent(factory, result, 'JonesUSDCRegistrySet', {
        jonesUSDCRegistry: OTHER_ADDRESS,
      });
      expect(await factory.jonesUSDCRegistry()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        factory.connect(core.hhUser1).ownerSetJonesUSDCRegistry(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#allowableCollateralMarketIds', () => {
    it('should work normally', async () => {
      const result = await factory.allowableCollateralMarketIds();
      expect(result.length).to.eql(1);
      expect(result[0]).to.eq(underlyingMarketId);
    });
  });

  describe('#allowableDebtMarketIds', () => {
    it('should work normally', async () => {
      const result = await factory.allowableDebtMarketIds();
      expect(result.length).to.eql(1);
      expect(result[0].toNumber()).to.eq(core.marketIds.usdc);
    });
  });
});
