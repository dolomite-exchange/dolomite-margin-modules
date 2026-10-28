import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  impersonate,
  revertToSnapshotAndCapture,
  snapshot,
} from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { CoreProtocolArbitrumOne } from '../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { GLPIsolationModeTokenVaultV2__factory } from '../src/types';
import vaultCreatedEvents from './gmx-vaults.json';

describe('gmx-vaults-with-staked-gmx', () => {

  let snapshotId: string;
  let core: CoreProtocolArbitrumOne;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.ArbitrumOne,
      blockNumber: 514843492,
    });

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  it('should write vaults with staked GMX to a JSON file', async () => {
    const factory = core.gmxEcosystem.live.dGmx;

    const results: { owner: string; vault: string; gmxBalance: string }[] = [];
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
      results.push({
        owner,
        vault: vaultAddress,
        gmxBalance: stakedGmx.toString(),
      });
    }

    const outputPath = join(__dirname, 'gmx-vaults-with-staked-gmx.json');
    await writeFile(outputPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
    console.log(`Wrote ${results.length} vaults to ${outputPath}`);
  });
});
