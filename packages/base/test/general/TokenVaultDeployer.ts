import { expect } from 'chai';
import { Network, ONE_ETH_BI } from '../../src/utils/no-deps-constants';
import { getRealLatestBlockNumber, revertToSnapshotAndCapture, snapshot } from '../utils';

import { CoreProtocolArbitrumOne } from '../utils/core-protocols/core-protocol-arbitrum-one';
import { setupARBBalance, setupCoreProtocol, setupUserVaultProxy } from '../utils/setup';
import { IERC20Metadata__factory } from 'packages/abracadabra/src/types';
import { createIsolationModeTokenVaultV1ActionsImpl } from '../utils/dolomite';
import { ARBIsolationModeTokenVaultV1__factory } from 'packages/arb/src/types';
import { ARBIsolationModeTokenVaultV1 } from 'packages/arb/src/types';
import { expectProtocolBalance } from '../utils/assertions';

const defaultAccountNumber = 0;

describe('TokenVaultDeployer', () => {
  let snapshotId: string;
  let core: CoreProtocolArbitrumOne;
  let arbVault: ARBIsolationModeTokenVaultV1;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.ArbitrumOne,
      blockNumber: await getRealLatestBlockNumber(true, Network.ArbitrumOne),
    });

    // for (let i = 0; i < (await core.dolomiteMargin.getNumMarkets()).toNumber(); i++) {
    //   console.log(await core.dolomiteMargin.getMarketTokenAddress(i));
    //   console.log(i);
    //   const tokenAddress = await core.dolomiteMargin.getMarketTokenAddress(i);
    //   console.log(await IERC20Metadata__factory.connect(tokenAddress, core.hhUser1).name());
    //   console.log();
    // }

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#upgradeVaultImplementation', () => {
    it('should work normally', async () => {
      const vaultAddress = await core.tokenVaultDeployers[2].upgradeVaultImplementation(core, {});
      expect(await core.arbEcosystem.live.dArb.userVaultImplementation()).to.equal(vaultAddress);

      await core.arbEcosystem.live.dArb.createVault(core.hhUser1.address);
      arbVault = setupUserVaultProxy<ARBIsolationModeTokenVaultV1>(
        await core.arbEcosystem.live.dArb.getVaultByAccount(core.hhUser1.address),
        ARBIsolationModeTokenVaultV1__factory,
        core.hhUser1,
      );
      await setupARBBalance(core, core.hhUser1, ONE_ETH_BI, arbVault);
      await arbVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, ONE_ETH_BI);
      await expectProtocolBalance(core, arbVault, defaultAccountNumber, core.marketIds.dArb, ONE_ETH_BI);
    });

    it('should work normally with new vault library', async () => {
      const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
      const vaultAddress = await core.tokenVaultDeployers[2].upgradeVaultImplementation(core, libraries);
      expect(await core.arbEcosystem.live.dArb.userVaultImplementation()).to.equal(vaultAddress);

      await core.arbEcosystem.live.dArb.createVault(core.hhUser1.address);
      arbVault = setupUserVaultProxy<ARBIsolationModeTokenVaultV1>(
        await core.arbEcosystem.live.dArb.getVaultByAccount(core.hhUser1.address),
        ARBIsolationModeTokenVaultV1__factory,
        core.hhUser1,
      );
      await setupARBBalance(core, core.hhUser1, ONE_ETH_BI, arbVault);
      await arbVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, ONE_ETH_BI);
      await expectProtocolBalance(core, arbVault, defaultAccountNumber, core.marketIds.dArb, ONE_ETH_BI);
    });
  });
});
