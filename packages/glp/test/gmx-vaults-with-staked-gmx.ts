import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  impersonate,
  revertToSnapshotAndCapture,
  snapshot,
} from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { CoreProtocolArbitrumOne } from '../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { GLPIsolationModeTokenVaultV2__factory } from '../src/types';
import vaultCreatedEvents from './gmx-vaults.json';

describe('gmx-vaults-with-staked-gmx', () => {

  let snapshotId: string;
  let core: CoreProtocolArbitrumOne;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.ArbitrumOne,
      blockNumber: 514843492
    });

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  it('should log vaults whose Dolomite balance exceeds their unstaked GMX balance', async () => {
    const factory = core.gmxEcosystem.live.dGmx;

    let count = 0;
    for (const event of vaultCreatedEvents.result) {
      expect(event.address.toLowerCase()).to.eq(factory.address.toLowerCase());
      const decodedEvent = factory.interface.parseLog(event);
      expect(decodedEvent.name).to.eq('VaultCreated');
      const vaultAddress: string = decodedEvent.args.vault;

      const owner = await factory.getAccountByVault(vaultAddress);
      const glpVaultAddress = await core.gmxEcosystem.live.dGlp.getVaultByAccount(owner);
      const glpVault = GLPIsolationModeTokenVaultV2__factory.connect(
        glpVaultAddress,
        await impersonate(vaultAddress, true),
      );
      const stakedGmx = await glpVault.gmxBalanceOf();
      if (stakedGmx.gt(0)) {
        count++;
        console.log({
          owner,
          vault: vaultAddress,
          gmxBalance: await glpVault.gmxBalanceOf()
        });
      }
    }
    console.log(count);
  });
});
