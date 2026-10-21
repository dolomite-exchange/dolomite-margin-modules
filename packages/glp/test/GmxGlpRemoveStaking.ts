import {
  createContractWithLibrary,
  createContractWithName,
} from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { createIsolationModeTokenVaultV1ActionsImpl } from '@dolomite-exchange/modules-base/test/utils/dolomite';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { CoreProtocolArbitrumOne } from '../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  GLPIsolationModeTokenVaultV5,
  GMXIsolationModeTokenVaultV3,
  IGLPIsolationModeVaultFactoryOld,
  IGMXIsolationModeVaultFactory,
} from '../src/types';

describe('GmxGlpRemoveStaking', () => {
  let core: CoreProtocolArbitrumOne;
  let glpFactory: IGLPIsolationModeVaultFactoryOld;
  let gmxFactory: IGMXIsolationModeVaultFactory;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.ArbitrumOne,
      blockNumber: 514_843_492,
    });

    glpFactory = core.gmxEcosystem.live.dGlp.connect(core.governance);
    gmxFactory = core.gmxEcosystem.live.dGmx.connect(core.governance);

    const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
    const glpActionsLib = await createContractWithName('GLPActionsLib', []);
    const glpVaultImplementation = await createContractWithLibrary<GLPIsolationModeTokenVaultV5>(
      'GLPIsolationModeTokenVaultV5',
      { ...libraries, GLPActionsLib: glpActionsLib.address },
      [],
    );
    const gmxVaultImplementation = await createContractWithLibrary<GMXIsolationModeTokenVaultV3>(
      'GMXIsolationModeTokenVaultV3',
      libraries,
      [],
    );

    await glpFactory.setUserVaultImplementation(glpVaultImplementation.address);
    await gmxFactory.ownerSetUserVaultImplementation(gmxVaultImplementation.address);
  });

  describe('update', () => {
    it('should work normally', async () => {

    });
  });
});
