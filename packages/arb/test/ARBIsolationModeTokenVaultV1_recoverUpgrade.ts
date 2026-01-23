import { expect } from 'chai';
import {
  ARBIsolationModeTokenVaultV1,
  ARBIsolationModeTokenVaultV1__factory,
} from '../src/types';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  createARBIsolationModeTokenVaultV1,
} from './arb-ecosystem-utils';
import {
  setupCoreProtocol,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { parseEther } from 'ethers/lib/utils';
import { BigNumber } from 'ethers';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';

const ARB_VAULT = '0x63cE15c9284AD87eD8A9E56e689B6479Bb652489';
const VAULT_OWNER = '0x6a58Cf1f1AF73153551E0899990ab52FfE98BE28';

const arbAmount = parseEther('364.108677');
const usdcAmount = BigNumber.from('88566586');

describe('ARBIsolationModeTokenVaultV1_recoverUpgrade', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let arbVault: ARBIsolationModeTokenVaultV1;
  let user: SignerWithAddressWithSafety;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 424_385_900,
      network: Network.ArbitrumOne,
    });

    const newVaultImplementation = await createARBIsolationModeTokenVaultV1();
    await core.arbEcosystem.live.dArb.connect(core.governance).ownerSetUserVaultImplementation(
      newVaultImplementation.address
    );

    arbVault = ARBIsolationModeTokenVaultV1__factory.connect(ARB_VAULT, core.hhUser1);
    user = await impersonate(VAULT_OWNER);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#ownerRecoverToken', () => {
    it('should work', async () => {
      await expect(
        () => arbVault.connect(core.governance).ownerRecoverToken(core.tokens.arb.address, arbAmount)
      ).to.changeTokenBalance(core.tokens.arb, VAULT_OWNER, arbAmount);
      await expect(
        () => arbVault.connect(core.governance).ownerRecoverToken(core.tokens.nativeUsdc.address, usdcAmount)
      ).to.changeTokenBalance(core.tokens.nativeUsdc, VAULT_OWNER, usdcAmount);
    });

    it('should fail if not called by dolomite margin owner', async () => {
      await expectThrow(
        arbVault.connect(user).ownerRecoverToken(core.tokens.arb.address, arbAmount),
        'ARBIsolationModeTokenVaultV1: Only dolomite owner can call',
      );
    });
  });
});
