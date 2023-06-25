import { expect } from 'chai';
import {
  TestGLPIsolationModeTokenVaultV1,
  TestGLPIsolationModeTokenVaultV1__factory,
  UmamiAssetVaultIsolationModeTokenVaultV1,
  UmamiAssetVaultIsolationModeVaultFactory,
  UmamiAssetVaultRegistry,
} from '../../../src/types';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';
import { Network, NONE_MARKET_ID } from '../../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectEvent, expectThrow } from '../../utils/assertions';
import {
  createUmamiAssetVaultIsolationModeVaultFactory,
  createUmamiAssetVaultRegistry,
} from '../../utils/ecosystem-token-utils/umami';
import { CoreProtocol, setupCoreProtocol } from '../../utils/setup';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('UmamiAssetVaultIsolationModeVaultFactory', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let umamiRegistry: UmamiAssetVaultRegistry;
  let vaultImplementation: TestGLPIsolationModeTokenVaultV1;
  let factory: UmamiAssetVaultIsolationModeVaultFactory;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 104861700,
      network: Network.ArbitrumOne,
    });
    umamiRegistry = await createUmamiAssetVaultRegistry(core);
    vaultImplementation = await createContractWithAbi<TestGLPIsolationModeTokenVaultV1>(
      TestGLPIsolationModeTokenVaultV1__factory.abi,
      TestGLPIsolationModeTokenVaultV1__factory.bytecode,
      [],
    );
    factory = await createUmamiAssetVaultIsolationModeVaultFactory(
      core,
      umamiRegistry,
      core.umamiEcosystem!.umUsdc,
      core.usdc,
      (vaultImplementation as any) as UmamiAssetVaultIsolationModeTokenVaultV1,
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#contructor', () => {
    it('should initialize variables properly', async () => {
      expect(await factory.umamiAssetVaultRegistry()).to.equal(umamiRegistry.address);
      expect(await factory.UNDERLYING_TOKEN()).to.equal(core.umamiEcosystem!.umUsdc.address);
      expect(await factory.BORROW_POSITION_PROXY()).to.equal(core.borrowPositionProxyV2.address);
      expect(await factory.userVaultImplementation()).to.equal(vaultImplementation.address);
      expect(await factory.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
    });
  });

  describe('#ownerSetUmamiAssetVaultRegistry', () => {
    it('should work normally', async () => {
      const result = await factory.connect(core.governance).ownerSetUmamiAssetVaultRegistry(OTHER_ADDRESS);
      await expectEvent(factory, result, 'UmamiAssetVaultRegistrySet', {
        umamiRegistry: OTHER_ADDRESS,
      });
      expect(await factory.umamiAssetVaultRegistry()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        factory.connect(core.hhUser1).ownerSetUmamiAssetVaultRegistry(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#allowableCollateralMarketIds', () => {
    it('should work normally', async () => {
      const result = await factory.allowableCollateralMarketIds();
      expect(result.length).to.eql(1);
      expect(result[0]).to.eq(NONE_MARKET_ID);
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
