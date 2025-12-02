import {
  AdminClaimExcessTokens__factory,
  AdminPauseMarket__factory,
  AdminRegistry__factory,
  AdminSetInterestSetter__factory,
  IModularLinearStepFunctionInterestSetter,
} from 'packages/admin/src/types';
import { IDolomiteRegistry, RegistryProxy__factory } from '../../../../../base/src/types';
import { getRegistryProxyConstructorParams } from '../../../../../base/src/utils/constructors/dolomite';
import { DolomiteNetwork } from '../../../../../base/src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '../../../../../base/src/utils/SignerWithAddressWithSafety';
import { DolomiteMargin } from '../../../../../base/test/utils/dolomite';
import { deployContractAndSave, getMaxDeploymentVersionNameByDeploymentKey } from '../../../utils/deploy-utils';

export async function deployDolomiteAdminContracts<T extends DolomiteNetwork>(
  dolomiteMargin: DolomiteMargin<T>,
  dolomiteRegistry: IDolomiteRegistry,
  modularInterestSetter: IModularLinearStepFunctionInterestSetter,
  hhUser1: SignerWithAddressWithSafety,
) {
  await deployContractAndSave('TestPriceOracleForAdmin', [dolomiteMargin.address]);

  const adminRegistryImplementationAddress = await deployContractAndSave(
    'AdminRegistry',
    [dolomiteMargin.address],
    getMaxDeploymentVersionNameByDeploymentKey('AdminRegistryImplementation', 1),
  );
  const adminRegistryImplementation = AdminRegistry__factory.connect(adminRegistryImplementationAddress, hhUser1);

  const adminRegistryProxyAddress = await deployContractAndSave(
    'RegistryProxy',
    getRegistryProxyConstructorParams(
      adminRegistryImplementationAddress,
      (
        await adminRegistryImplementation.populateTransaction.initialize()
      ).data!,
      dolomiteMargin,
    ),
    'AdminRegistryProxy',
  );
  const adminRegistry = AdminRegistry__factory.connect(adminRegistryProxyAddress, hhUser1);
  const adminRegistryProxy = RegistryProxy__factory.connect(adminRegistryProxyAddress, hhUser1);

  const adminClaimExcessTokensAddress = await deployContractAndSave(
    'AdminClaimExcessTokens',
    [adminRegistryProxy.address, dolomiteMargin.address],
    getMaxDeploymentVersionNameByDeploymentKey('AdminClaimExcessTokens', 2),
  );
  const adminClaimExcessTokens = AdminClaimExcessTokens__factory.connect(adminClaimExcessTokensAddress, hhUser1);

  const adminPauseMarketAddress = await deployContractAndSave(
    'AdminPauseMarket',
    [adminRegistryProxy.address, dolomiteRegistry.address, dolomiteMargin.address],
    getMaxDeploymentVersionNameByDeploymentKey('AdminPauseMarket', 2),
  );
  const adminPauseMarket = AdminPauseMarket__factory.connect(adminPauseMarketAddress, hhUser1);

  const adminSetInterestSetterAddress = await deployContractAndSave(
    'AdminSetInterestSetter',
    [modularInterestSetter.address, adminRegistry.address, dolomiteMargin.address],
    getMaxDeploymentVersionNameByDeploymentKey('AdminSetInterestSetter', 2),
  );
  const adminSetInterestSetter = AdminSetInterestSetter__factory.connect(adminSetInterestSetterAddress, hhUser1);

  return {
    adminClaimExcessTokens,
    adminPauseMarket,
    adminRegistryImplementationAddress,
    adminRegistry,
    adminRegistryProxy,
    adminSetInterestSetter,
  };
}
