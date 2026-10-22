import { SUBGRAPH_URL_MAP } from '@dolomite-exchange/modules-base/src/utils/constants';
import {
  createContractWithAbi,
  createContractWithLibrary,
  createContractWithName,
} from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { createIsolationModeTokenVaultV1ActionsImpl } from '@dolomite-exchange/modules-base/test/utils/dolomite';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import axios from 'axios';
import { expect } from 'chai';
import { CoreProtocolArbitrumOne } from '../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  GLPIsolationModeTokenVaultV4,
  GMXIsolationModeTokenVaultV2,
  GmxRegistryV1,
  GmxRegistryV1__factory,
  IGLPIsolationModeTokenVaultV4,
  IGLPIsolationModeTokenVaultV4__factory,
  IGLPIsolationModeVaultFactoryOld,
  IGMXIsolationModeTokenVaultV2,
  IGMXIsolationModeTokenVaultV2__factory,
  IGMXIsolationModeVaultFactory,
} from '../src/types';

import gmxVaults from './all-staked-gmx-vaults.json';
import { impersonate, revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectThrow } from 'packages/base/test/utils/assertions';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';
import { PlutusVaultGLPIsolationModeWrapperTraderV1__factory } from 'packages/plutus/src/types';

const blockNumber = 517_014_000;
const borrowPositionsQuery = `
  query borrowPositions($blockNumber: Int!, $walletAddress: String!) {
    borrowPositions(
      block: {number: $blockNumber}
      where: {
        effectiveUser: $walletAddress
        status_not: "CLOSED"
        marginAccount_: {accountNumber_not: 0}
      }
      orderBy: openTimestamp
      orderDirection: desc
      first: 1000
    ) {
      marginAccount {
        user { id }
        accountNumber
      }
    }
  }
`;

interface BorrowPositionsResponse {
  data?: {
    borrowPositions: {
      marginAccount: {
        user: { id: string };
        accountNumber: string;
      };
    }[];
  };
  errors?: { message: string }[];
}

const userWithStakedGmx = '0x52256ef863a713Ef349ae6E97A7E8f35785145dE';

describe('GmxGlpRemoveStaking', () => {

  let snapshotId: string;
  let core: CoreProtocolArbitrumOne;

  let glpFactory: IGLPIsolationModeVaultFactoryOld;
  let gmxFactory: IGMXIsolationModeVaultFactory;

  let user: SignerWithAddressWithSafety;
  let glpVault: IGLPIsolationModeTokenVaultV4;
  let gmxVault: IGMXIsolationModeTokenVaultV2;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber,
      network: Network.ArbitrumOne,
    });

    user = await impersonate(userWithStakedGmx, true);
    glpFactory = core.gmxEcosystem.live.dGlp.connect(core.governance);
    gmxFactory = core.gmxEcosystem.live.dGmx.connect(core.governance);
    glpVault = IGLPIsolationModeTokenVaultV4__factory.connect(
      await glpFactory.getVaultByAccount(userWithStakedGmx),
      user
    );
    gmxVault = IGMXIsolationModeTokenVaultV2__factory.connect(
      await gmxFactory.getVaultByAccount(userWithStakedGmx),
      user
    );

    const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
    const glpActionsLib = await createContractWithName('GLPActionsLib', []);
    const glpVaultImplementation = await createContractWithLibrary<GLPIsolationModeTokenVaultV4>(
      'GLPIsolationModeTokenVaultV4',
      { ...libraries, GLPActionsLib: glpActionsLib.address },
      [],
    );
    const gmxVaultImplementation = await createContractWithLibrary<GMXIsolationModeTokenVaultV2>(
      'GMXIsolationModeTokenVaultV2',
      libraries,
      [],
    );

    const gmxRegistryImplementation = await createContractWithAbi<GmxRegistryV1>(
      GmxRegistryV1__factory.abi,
      GmxRegistryV1__factory.bytecode,
      [],
    );
    await core.gmxEcosystem.live.gmxRegistryProxy.connect(core.governance).upgradeTo(gmxRegistryImplementation.address);

    await glpFactory.setUserVaultImplementation(glpVaultImplementation.address);
    await gmxFactory.ownerSetUserVaultImplementation(gmxVaultImplementation.address);

    await core.gmxEcosystem.live.gmxRegistry.connect(core.governance).ownerSetIsHandler(core.hhUser4.address, true);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#ownerUnstakeGmx', () => {
    it.only('should work for all vaults', async () => {
      for (const gmxVault of gmxVaults) {
        const vault = IGMXIsolationModeTokenVaultV2__factory.connect(
          gmxVault.vault,
          core.hhUser4,
        );

        await vault.ownerUnstakeGmx();

        const response = await axios.post<BorrowPositionsResponse>(SUBGRAPH_URL_MAP[Network.ArbitrumOne], {
          operationName: 'borrowPositions',
          variables: { blockNumber, walletAddress: gmxVault.owner.toLowerCase() },
          query: borrowPositionsQuery,
        });
        if (response.data.errors?.length) {
          throw new Error(`Subgraph query failed for ${gmxVault.owner}: ${
            response.data.errors.map(error => error.message).join('; ')
          }`);
        }
        if (!response.data.data) {
          throw new Error(`Subgraph returned no data for ${gmxVault.owner}`);
        }

        const accountNumbers = new Set(['0']);
        for (const position of response.data.data.borrowPositions) {
          if (position.marginAccount.user.id.toLowerCase() === vault.address.toLowerCase()) {
            accountNumbers.add(position.marginAccount.accountNumber);
          }
        }

        let totalGmxBalance = ZERO_BI;
        for (const accountNumber of accountNumbers) {
          const balance = await core.dolomiteMargin.getAccountWei(
            { owner: vault.address, number: accountNumber },
            core.marketIds.dGmx,
          );
          totalGmxBalance = totalGmxBalance.add(balance.value);
        }

        const vaultGmxBalance = await core.gmxEcosystem.gmx.balanceOf(vault.address);
        try {
          expect(totalGmxBalance, `GMX balance mismatch for vault ${vault.address}`).to.eq(vaultGmxBalance);
          console.log('Balances equal for vault: ', vault.address);
        } catch (e) {
          console.log();
          console.log('Balances UNEQUAL for vault: ', vault.address);
          console.log();
        }
      }
    });

    it('should fail if not called by handler', async () => {
      await expectThrow(
        gmxVault.connect(core.hhUser1).ownerUnstakeGmx(),
        `GMXIsolationModeTokenVaultV2: Invalid handler <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('account transfers', () => {
    it('should work normally after gmx is unstaked', async () => {
      await gmxVault.connect(core.hhUser4).ownerUnstakeGmx();

      const esGmxBal = await core.gmxEcosystem.esGmx.balanceOf(glpVault.address);
      await glpVault.signalAccountTransfer(core.hhUser5.address);

      await core.gmxEcosystem.gmxRewardsRouterV4.connect(core.hhUser5).acceptTransfer(glpVault.address);
      expect(await core.gmxEcosystem.esGmx.balanceOf(core.hhUser5.address)).to.eq(esGmxBal);
      expect(await core.gmxEcosystem.esGmx.balanceOf(glpVault.address)).to.eq(ZERO_BI);
    });

    it('should fail if user has gmx', async () => {
      await expectThrow(
        glpVault.signalAccountTransfer(core.hhUser5.address),
        'GLPIsolationModeTokenVaultV4: Cannot transfer'
      );
    });

    it('should fail if user has glp', async () => {
      const vaultOwner = await impersonate('0xD7040140B51125fBff24f6b6d3Df096c9757fb85');
      const glp = IGLPIsolationModeTokenVaultV4__factory.connect(
        '0x40d1BF27c134b05928C1Bb497C1740E5E56e234a',
        vaultOwner
      );
      const gmx = IGMXIsolationModeTokenVaultV2__factory.connect(
        await gmxFactory.getVaultByAccount(vaultOwner.address),
        vaultOwner
      );

      await gmx.connect(core.hhUser4).ownerUnstakeGmx();
      await expectThrow(
        glp.signalAccountTransfer(core.hhUser5.address),
        'GLPIsolationModeTokenVaultV4: Cannot transfer'
      );
    });
  });
});
