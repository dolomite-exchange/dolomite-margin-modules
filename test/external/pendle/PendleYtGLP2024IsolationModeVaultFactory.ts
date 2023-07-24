import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  PendleYtGLP2024IsolationModeTokenVaultV1,
  PendleYtGLP2024IsolationModeVaultFactory,
  PendleGLPRegistry,
} from '../../../src/types';
import { Network } from '../../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectEvent, expectThrow, expectArrayEq } from '../../utils/assertions';
import {
  createPendleYtGLP2024IsolationModeTokenVaultV1,
  createPendleYtGLP2024IsolationModeVaultFactory,
  createPendleGLPRegistry,
} from '../../utils/ecosystem-token-utils/pendle';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol, setupTestMarket } from '../../utils/setup';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
const YT_EXPIRY_TIME = BigNumber.from('1711584000');
const initialAllowableDebtMarketIds = [0, 1];
const initialAllowableCollateralMarketIds = [2, 3];
const newAllowableDebtMarketIds = [1, 2, 3];

describe('PendleYtGLP2024IsolationModeVaultFactory', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let pendleRegistry: PendleGLPRegistry;
  let vaultImplementation: PendleYtGLP2024IsolationModeTokenVaultV1;
  let factory: PendleYtGLP2024IsolationModeVaultFactory;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    pendleRegistry = await createPendleGLPRegistry(core);
    vaultImplementation = await createPendleYtGLP2024IsolationModeTokenVaultV1();
    factory = await createPendleYtGLP2024IsolationModeVaultFactory(
      pendleRegistry,
      initialAllowableDebtMarketIds,
      initialAllowableCollateralMarketIds,
      core,
      core.pendleEcosystem!.ytGlpToken,
      vaultImplementation,
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#contructor', () => {
    it('should initialize variables properly', async () => {
      expect(await factory.pendleGLPRegistry()).to.equal(pendleRegistry.address);
      expectArrayEq(await factory.allowableDebtMarketIds(), initialAllowableDebtMarketIds);
      expectArrayEq(await factory.allowableCollateralMarketIds(), initialAllowableCollateralMarketIds);
      expect(await factory.ytMaturityDate()).to.equal(YT_EXPIRY_TIME);
      expect(await factory.UNDERLYING_TOKEN()).to.equal(core.pendleEcosystem!.ytGlpToken.address);
      expect(await factory.BORROW_POSITION_PROXY()).to.equal(core.borrowPositionProxyV2.address);
      expect(await factory.userVaultImplementation()).to.equal(vaultImplementation.address);
      expect(await factory.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
    });
  });

  describe('#ownerSetPendleGLPRegistry', () => {
    it('should work normally', async () => {
      const result = await factory.connect(core.governance).ownerSetPendleGLPRegistry(OTHER_ADDRESS);
      await expectEvent(factory, result, 'PendleGLPRegistrySet', {
        pendleGLPRegistry: OTHER_ADDRESS,
      });
      expect(await factory.pendleGLPRegistry()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        factory.connect(core.hhUser1).ownerSetPendleGLPRegistry(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetYtMaturityDate', () => {
    it('should work normally', async () => {
      const result = await factory.connect(core.governance).ownerSetYtMaturityDate(100);
      await expectEvent(factory, result, 'YtMaturityDateSet', {
        ytMaturityDate: 100,
      });
      expect(await factory.ytMaturityDate()).to.equal(100);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        factory.connect(core.hhUser1).ownerSetYtMaturityDate(100),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetAllowableDebtMarketIds', () => {
    it('should work normally', async () => {
      expectArrayEq(await factory.allowableDebtMarketIds(), initialAllowableDebtMarketIds);

      const result = await factory.connect(core.governance).ownerSetAllowableDebtMarketIds(newAllowableDebtMarketIds);
      await expectEvent(factory, result, 'AllowableDebtMarketIdsSet', {
        allowableDebtMarketIds: newAllowableDebtMarketIds
      });
      expectArrayEq(await factory.allowableDebtMarketIds(), newAllowableDebtMarketIds);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        factory.connect(core.hhUser1).ownerSetAllowableDebtMarketIds(newAllowableDebtMarketIds),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail when passed an empty array', async () => {
      await expectThrow(
        factory.connect(core.governance).ownerSetAllowableDebtMarketIds([]),
        'PendleYtGLP2024VaultFactory: invalid allowableDebtMarketIds',
      );
    });
  });
});
