import { AdminClaimExcessTokens__factory, AdminPauseMarket__factory } from 'packages/admin/src/types';
import { IDolomiteRegistry } from '../../../../../base/src/types';
import { DolomiteNetwork } from '../../../../../base/src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '../../../../../base/src/utils/SignerWithAddressWithSafety';
import { DolomiteMargin } from '../../../../../base/test/utils/dolomite';
import { deployContractAndSave, getMaxDeploymentVersionNameByDeploymentKey } from '../../../utils/deploy-utils';

export async function deployDolomiteAdminContracts<T extends DolomiteNetwork>(
  dolomiteMargin: DolomiteMargin<T>,
  dolomiteRegistry: IDolomiteRegistry,
  hhUser1: SignerWithAddressWithSafety,
) {
  await deployContractAndSave('TestPriceOracleForAdmin', [dolomiteMargin.address]);

  const adminClaimExcessTokensAddress = await deployContractAndSave(
    'AdminClaimExcessTokens',
    [dolomiteRegistry.address, dolomiteMargin.address],
    getMaxDeploymentVersionNameByDeploymentKey('AdminClaimExcessTokens', 1),
  );
  const adminClaimExcessTokens = AdminClaimExcessTokens__factory.connect(adminClaimExcessTokensAddress, hhUser1);

  const adminPauseMarketAddress = await deployContractAndSave(
    'AdminPauseMarket',
    [dolomiteRegistry.address, dolomiteMargin.address],
    getMaxDeploymentVersionNameByDeploymentKey('AdminPauseMarket', 1),
  );
  const adminPauseMarket = AdminPauseMarket__factory.connect(adminPauseMarketAddress, hhUser1);

  return {
    adminClaimExcessTokens,
    adminPauseMarket,
  };
}
