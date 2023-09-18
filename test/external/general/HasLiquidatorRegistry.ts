import { TestHasLiquidatorRegistry, TestHasLiquidatorRegistry__factory } from '../../../src/types';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';
import { Network } from '../../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectThrow } from '../../utils/assertions';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol } from '../../utils/setup';

describe('HasLiquidatorRegistry', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let registry: TestHasLiquidatorRegistry;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    registry = await createContractWithAbi<TestHasLiquidatorRegistry>(
      TestHasLiquidatorRegistry__factory.abi,
      TestHasLiquidatorRegistry__factory.bytecode,
      [core.liquidatorAssetRegistry.address],
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('validateAssetForLiquidation', () => {
    it('should work', async () => {
      await registry.validateAssetForLiquidation(0);
    });

    it('should fail when validation does not work', async () => {
      await core.liquidatorAssetRegistry.ownerAddLiquidatorToAssetWhitelist(0, core.liquidatorProxyV4.address);
      await expectThrow(
        registry.validateAssetForLiquidation(0),
        'HasLiquidatorRegistry: Asset not whitelisted <0>',
      );
    });
  });

  describe('validateAssetsForLiquidation', () => {
    it('should work', async () => {
      await registry.validateAssetsForLiquidation([0]);
    });

    it('should fail when validation does not work', async () => {
      await core.liquidatorAssetRegistry.ownerAddLiquidatorToAssetWhitelist(0, core.liquidatorProxyV4.address);
      await expectThrow(
        registry.validateAssetsForLiquidation([0]),
        'HasLiquidatorRegistry: Asset not whitelisted <0>',
      );
    });
  });
});
