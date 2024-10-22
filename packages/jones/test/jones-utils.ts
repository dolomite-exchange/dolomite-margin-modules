import { impersonate } from '@dolomite-exchange/modules-base/test/utils';
import { CoreProtocolSetupConfig } from '@dolomite-exchange/modules-base/test/utils/setup';
import { ethers } from 'ethers';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { JonesUSDCIsolationModeUnwrapperTraderV2, JonesUSDCIsolationModeWrapperTraderV2 } from '../src/types';

export const DEFAULT_BLOCK_NUMBER_FOR_JUSDC_V2 = 206_403_800;

export const JONES_CORE_PROTOCOL_CONFIG: CoreProtocolSetupConfig<Network.ArbitrumOne> = {
  network: Network.ArbitrumOne,
  blockNumber: DEFAULT_BLOCK_NUMBER_FOR_JUSDC_V2,
};

export const TRADER_ROLE = ethers.utils.solidityKeccak256(['uint256'], [Date.now()]);

export const JONES_V2_WHITELIST_ADMIN = '0xc8ce0aC725f914dBf1D743D51B6e222b79F479f1';

export async function createRoleAndWhitelistTraderV2(
  core: CoreProtocolArbitrumOne,
  unwrapper: JonesUSDCIsolationModeUnwrapperTraderV2,
  wrapper: JonesUSDCIsolationModeWrapperTraderV2,
) {
  const owner = await impersonate(JONES_V2_WHITELIST_ADMIN, true);
  await core.jonesEcosystem!.whitelistControllerV2.connect(owner).createRole(TRADER_ROLE, {
    BYPASS_COOLDOWN: true,
    INCENTIVE_RETENTION: '9700000000',
  });
  await core.jonesEcosystem!.whitelistControllerV2.connect(owner).addToRole(TRADER_ROLE, unwrapper.address);

  await core.jonesEcosystem!.whitelistControllerV2.connect(owner).addToWhitelist(unwrapper.address);
  await core.jonesEcosystem!.whitelistControllerV2.connect(owner).addToWhitelist(wrapper.address);
}
