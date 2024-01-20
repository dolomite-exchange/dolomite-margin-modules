import { expect } from 'chai';
import {
  PlutusVaultGLPIsolationModeTokenVaultV1,
  PlutusVaultGLPIsolationModeVaultFactory,
  PlutusVaultRegistry,
} from '../src/types';
import {
  TestGLPIsolationModeTokenVaultV1,
  TestGLPIsolationModeTokenVaultV1__factory,
} from '@dolomite-exchange/modules-glp/src/types';
import { createContractWithAbi } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectEvent, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  createPlutusVaultGLPIsolationModeVaultFactory,
  createPlutusVaultRegistry,
} from './plutus-ecosystem-utils';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('PlutusVaultGLPIsolationModeVaultFactory', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let plutusVaultRegistry: PlutusVaultRegistry;
  let vaultImplementation: TestGLPIsolationModeTokenVaultV1;
  let factory: PlutusVaultGLPIsolationModeVaultFactory;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    plutusVaultRegistry = await createPlutusVaultRegistry(core);
    vaultImplementation = await createContractWithAbi<TestGLPIsolationModeTokenVaultV1>(
      TestGLPIsolationModeTokenVaultV1__factory.abi,
      TestGLPIsolationModeTokenVaultV1__factory.bytecode,
      [],
    );
    factory = await createPlutusVaultGLPIsolationModeVaultFactory(
      core,
      plutusVaultRegistry,
      core.plutusEcosystem!.plvGlp,
      (vaultImplementation as any) as PlutusVaultGLPIsolationModeTokenVaultV1,
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#contructor', () => {
    it('should initialize variables properly', async () => {
      expect(await factory.plutusVaultRegistry()).to.equal(plutusVaultRegistry.address);
      expect(await factory.UNDERLYING_TOKEN()).to.equal(core.plutusEcosystem!.plvGlp.address);
      expect(await factory.BORROW_POSITION_PROXY()).to.equal(core.borrowPositionProxyV2.address);
      expect(await factory.userVaultImplementation()).to.equal(vaultImplementation.address);
      expect(await factory.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
    });
  });

  describe('#ownerSetPlutusVaultRegistry', () => {
    it('should work normally', async () => {
      const result = await factory.connect(core.governance).ownerSetPlutusVaultRegistry(OTHER_ADDRESS);
      await expectEvent(factory, result, 'PlutusVaultRegistrySet', {
        plutusVaultRegistry: OTHER_ADDRESS,
      });
      expect(await factory.plutusVaultRegistry()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        factory.connect(core.hhUser1).ownerSetPlutusVaultRegistry(OTHER_ADDRESS),
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
