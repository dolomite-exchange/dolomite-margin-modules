import { expect } from 'chai';
import {
  JonesUSDCIsolationModeTokenVaultV1,
  JonesUSDCIsolationModeVaultFactory,
  JonesUSDCRegistry,
  TestGLPIsolationModeTokenVaultV1,
  TestGLPIsolationModeTokenVaultV1__factory,
} from '../../../../src/types';
import { createContractWithAbi } from '../../../../src/utils/dolomite-utils';
import { Network } from '../../../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../../../utils';
import { expectEvent, expectThrow } from '../../../utils/assertions';
import {
  createJonesUSDCIsolationModeVaultFactory,
  createJonesUSDCRegistry,
} from '../../../utils/ecosystem-token-utils/jones';
import { CoreProtocol, setupCoreProtocol } from '../../../utils/setup';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('JonesUSDCIsolationModeVaultFactory', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let jonesUSDCRegistry: JonesUSDCRegistry;
  let vaultImplementation: TestGLPIsolationModeTokenVaultV1;
  let factory: JonesUSDCIsolationModeVaultFactory;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 86413000,
      network: Network.ArbitrumOne,
    });
    jonesUSDCRegistry = await createJonesUSDCRegistry(core);
    vaultImplementation = await createContractWithAbi<TestGLPIsolationModeTokenVaultV1>(
      TestGLPIsolationModeTokenVaultV1__factory.abi,
      TestGLPIsolationModeTokenVaultV1__factory.bytecode,
      [],
    );
    factory = await createJonesUSDCIsolationModeVaultFactory(
      core,
      jonesUSDCRegistry,
      core.plutusEcosystem!.plvGlp,
      (vaultImplementation as any) as JonesUSDCIsolationModeTokenVaultV1,
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#contructor', () => {
    it('should initialize variables properly', async () => {
      expect(await factory.jonesUSDCRegistry()).to.equal(jonesUSDCRegistry.address);
      expect(await factory.UNDERLYING_TOKEN()).to.equal(core.plutusEcosystem!.plvGlp.address);
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
      expect(await factory.allowableCollateralMarketIds()).to.deep.equal([]);
    });
  });

  describe('#allowableDebtMarketIds', () => {
    it('should work normally', async () => {
      expect(await factory.allowableDebtMarketIds()).to.deep.equal([]);
    });
  });
});
