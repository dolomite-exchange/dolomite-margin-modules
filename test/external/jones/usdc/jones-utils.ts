import { ethers } from 'ethers';
import { JonesUSDCIsolationModeUnwrapperTraderV2, JonesUSDCIsolationModeWrapperTraderV2 } from '../../../../src/types';
import { impersonate } from '../../../utils';
import { CoreProtocol } from '../../../utils/setup';

export const TRADER_ROLE = ethers.utils.solidityKeccak256(['uint256'], [Date.now()]);

export async function createRoleAndWhitelistTrader(
  core: CoreProtocol,
  unwrapper: JonesUSDCIsolationModeUnwrapperTraderV2,
  wrapper: JonesUSDCIsolationModeWrapperTraderV2,
) {
  const owner = await impersonate(await core.jonesEcosystem!.whitelistController.owner(), true);
  await core.jonesEcosystem!.whitelistController.connect(owner).createRole(TRADER_ROLE, {
    jGLP_BYPASS_CAP: true,
    jUSDC_BYPASS_TIME: true,
    jGLP_RETENTION: '30000000000',
    jUSDC_RETENTION: '9700000000',
  });
  await core.jonesEcosystem!.whitelistController.connect(owner).addToRole(TRADER_ROLE, unwrapper.address);

  await core.jonesEcosystem!.whitelistController.connect(owner).addToWhitelistContracts(unwrapper.address);
  await core.jonesEcosystem!.whitelistController.connect(owner).addToWhitelistContracts(wrapper.address);
}
