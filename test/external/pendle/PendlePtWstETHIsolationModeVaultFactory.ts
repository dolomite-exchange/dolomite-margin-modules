import { expect } from 'chai';
import {
  PendleWstETHRegistry,
  PendlePtWstETHIsolationModeTokenVaultV1,
  PendlePtWstETHIsolationModeVaultFactory,
} from '../../../src/types';
import { Network } from '../../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectEvent, expectThrow } from '../../utils/assertions';
import {
  createPendleWstETHRegistry,
  createPendlePtWstETHIsolationModeTokenVaultV1,
  createPendlePtWstETHIsolationModeVaultFactory,
} from '../../utils/ecosystem-token-utils/pendle';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol } from '../../utils/setup';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('PendlePtWstETHIsolationModeVaultFactory', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let pendleRegistry: PendleWstETHRegistry;
  let vaultImplementation: PendlePtWstETHIsolationModeTokenVaultV1;
  let factory: PendlePtWstETHIsolationModeVaultFactory;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    pendleRegistry = await createPendleWstETHRegistry(core);
    vaultImplementation = await createPendlePtWstETHIsolationModeTokenVaultV1();
    factory = await createPendlePtWstETHIsolationModeVaultFactory(
      core,
      pendleRegistry,
      core.pendleEcosystem!.ptWstEth2024Market,
      core.pendleEcosystem!.ptWstEth2024Token,
      vaultImplementation,
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#contructor', () => {
    it('should initialize variables properly', async () => {
      expect(await factory.pendleWstETHRegistry()).to.equal(pendleRegistry.address);
      expect(await factory.pendlePtWstEthMarket()).to.equal(core.pendleEcosystem!.ptWstEth2024Market.address);
      expect(await factory.UNDERLYING_TOKEN()).to.equal(core.pendleEcosystem!.ptWstEth2024Token.address);
      expect(await factory.BORROW_POSITION_PROXY()).to.equal(core.borrowPositionProxyV2.address);
      expect(await factory.userVaultImplementation()).to.equal(vaultImplementation.address);
      expect(await factory.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
    });
  });

  describe('#ownerSetPendleGLPRegistry', () => {
    it('should work normally', async () => {
      const result = await factory.connect(core.governance).ownerSetPendleWstETHRegistry(OTHER_ADDRESS);
      await expectEvent(factory, result, 'PendleWstETHRegistrySet', {
        pendlePtGLP2024Registry: OTHER_ADDRESS,
      });
      expect(await factory.pendleWstETHRegistry()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        factory.connect(core.hhUser1).ownerSetPendleWstETHRegistry(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#allowableCollateralMarketIds', () => {
    it('should work normally', async () => {
      expect(await factory.allowableCollateralMarketIds()).to.deep.equal([]);
    });
  });

  describe('#allowableDebtMarketIds', () => {
    it('should work normally', async () => {
      expect(await factory.allowableDebtMarketIds()).to.deep.equal([]);
    });
  });
});
