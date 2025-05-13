import { Network, ONE_ETH_BI } from "packages/base/src/utils/no-deps-constants";
import { getRealLatestBlockNumber, impersonate, revertToSnapshotAndCapture, snapshot } from "packages/base/test/utils";
import { CoreProtocolArbitrumOne } from "packages/base/test/utils/core-protocols/core-protocol-arbitrum-one";
import { setupCoreProtocol } from "packages/base/test/utils/setup";
import { GlvIsolationModeTokenVaultV1, GlvIsolationModeTokenVaultV1__factory } from "../src/types";
import { SignerWithAddressWithSafety } from "packages/base/src/utils/SignerWithAddressWithSafety";
import { BigNumber } from "ethers";
import { expectThrow } from "packages/base/test/utils/assertions";

const vaultAddress = '0x57b3a2D1BC1f0dfa2810a53A43714B43d329d823';
const userAddress = '0x17c8AFd739A175eACF8Af5531671b222102B8083';
const borrowAccountNumber = BigNumber.from('27077895150366778215000510044768640672931845715142645576470821526360536878734');

describe('GlvIsolationModeTokenVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let vault: GlvIsolationModeTokenVaultV1;
  let user: SignerWithAddressWithSafety;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: await getRealLatestBlockNumber(true, Network.ArbitrumOne),
      network: Network.ArbitrumOne,
    });

    user = await impersonate(userAddress, true);
    vault = GlvIsolationModeTokenVaultV1__factory.connect(vaultAddress, user);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#bug', () => {
    it('should work normally', async () => {
      await expectThrow(vault.connect(user).transferFromPositionWithUnderlyingToken(borrowAccountNumber, 0, ONE_ETH_BI));

      await core.glvEcosystem.live.registry.connect(core.governance).ownerSetGlvTokenToGmMarketForWithdrawal(
        core.glvEcosystem.glvTokens.wethUsdc.glvToken.address,
        core.gmxV2Ecosystem.gmTokens.ethUsd.marketToken.address,
      );
      await core.glvEcosystem.live.registry.connect(core.governance).ownerSetGlvTokenToGmMarketForDeposit(
        core.glvEcosystem.glvTokens.wethUsdc.glvToken.address,
        core.gmxV2Ecosystem.gmTokens.ethUsd.marketToken.address,
      );

      await vault.connect(user).transferFromPositionWithUnderlyingToken(borrowAccountNumber, 0, ONE_ETH_BI);
    });
  });
});
