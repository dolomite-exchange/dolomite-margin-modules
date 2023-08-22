import { expect } from 'chai';
import { GmxRegistryV2 } from 'src/types';
import { createGmxRegistryV2 } from 'test/utils/ecosystem-token-utils/gmx';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol } from '../../utils/setup';
import { Network } from 'src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from 'test/utils';
const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('GmxRegistryV2', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let registry: GmxRegistryV2;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    registry = await createGmxRegistryV2(core);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initialize', () => {
    it('should initialize variables properly', async () => {
      expect(await registry.gmxExchangeRouter()).to.eq(core.gmxEcosystem!.gmxExchangeRouter.address);
      expect(await registry.ethUsdMarketToken()).to.eq(core.gmxEcosystem!.gmxEthUsdMarketToken.address);
      expect(await registry.dolomiteRegistry()).to.eq(core.dolomiteRegistry.address);
    });
  });
})