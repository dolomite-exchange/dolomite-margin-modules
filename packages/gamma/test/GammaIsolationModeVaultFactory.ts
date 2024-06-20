import { expect } from 'chai';
import { Network, ONE_ETH_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectEvent, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupCoreProtocol, setupTestMarket } from '@dolomite-exchange/modules-base/test/utils/setup';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  GammaIsolationModeTokenVaultV1,
  GammaIsolationModeUnwrapperTraderV2,
  GammaIsolationModeVaultFactory,
  GammaIsolationModeWrapperTraderV2,
  GammaRegistry
} from '../src/types';
import {
  createGammaIsolationModeTokenVaultV1,
  createGammaIsolationModeVaultFactory,
  createGammaRegistry,
  createGammaUnwrapperTraderV2,
  createGammaWrapperTraderV2
} from './gamma-ecosystem-utils';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('GammaIsolationModeVaultFactory', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let gammaRegistry: GammaRegistry;
  let unwrapper: GammaIsolationModeUnwrapperTraderV2;
  let wrapper: GammaIsolationModeWrapperTraderV2;
  let gammaFactory: GammaIsolationModeVaultFactory;
  let vaultImplementation: GammaIsolationModeTokenVaultV1;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 213_000_000,
      network: Network.ArbitrumOne,
    });

    gammaRegistry = await createGammaRegistry(core);

    vaultImplementation = await createGammaIsolationModeTokenVaultV1();
    gammaFactory = await createGammaIsolationModeVaultFactory(
      gammaRegistry,
      core.gammaEcosystem.gammaPools.wethUsdc,
      vaultImplementation,
      core
    );

    unwrapper = await createGammaUnwrapperTraderV2(core, gammaFactory, gammaRegistry);
    wrapper = await createGammaWrapperTraderV2(core, gammaFactory, gammaRegistry);

    await core.testEcosystem!.testPriceOracle.setPrice(gammaFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, gammaFactory, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(gammaFactory.address, true);
    await gammaFactory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);

    await gammaFactory.createVault(core.hhUser1.address);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#contructor', () => {
    it('should initialize variables properly', async () => {
      expect(await gammaFactory.gammaRegistry()).to.equal(gammaRegistry.address);
      expect(await gammaFactory.UNDERLYING_TOKEN()).to.equal(core.gammaEcosystem.gammaPools.wethUsdc.address);
      expect(await gammaFactory.BORROW_POSITION_PROXY()).to.equal(core.borrowPositionProxyV2.address);
      expect(await gammaFactory.userVaultImplementation()).to.equal(vaultImplementation.address);
      expect(await gammaFactory.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
    });
  });

  describe('#setARBRegistry', () => {
    it('should work normally', async () => {
      const result = await gammaFactory.connect(core.governance).setGammaRegistry(OTHER_ADDRESS);
      await expectEvent(gammaFactory, result, 'GammaRegistrySet', {
        gammaRegistry: OTHER_ADDRESS,
      });
      expect(await gammaFactory.gammaRegistry()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        gammaFactory.connect(core.hhUser1).setGammaRegistry(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#allowableCollateralMarketIds', () => {
    it('should work normally', async () => {
      expect(await gammaFactory.allowableCollateralMarketIds()).to.deep.equal([]);
    });
  });

  describe('#allowableDebtMarketIds', () => {
    it('should work normally', async () => {
      expect(await gammaFactory.allowableDebtMarketIds()).to.deep.equal([]);
    });
  });
});
