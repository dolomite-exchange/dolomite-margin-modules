import { impersonate } from '@dolomite-exchange/modules-base/test/utils';
import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
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

export async function createRoleAndWhitelistTraderV1(
  core: CoreProtocolArbitrumOne,
  unwrapper: JonesUSDCIsolationModeUnwrapperTraderV2,
  wrapper: JonesUSDCIsolationModeWrapperTraderV2,
) {
  const owner = await impersonate(await core.jonesEcosystem!.whitelistControllerV1.owner(), true);
  await core.jonesEcosystem!.whitelistControllerV1.connect(owner).createRole(TRADER_ROLE, {
    jGLP_BYPASS_CAP: true,
    jUSDC_BYPASS_TIME: true,
    jGLP_RETENTION: '30000000000',
    jUSDC_RETENTION: '9700000000',
  });
  await core.jonesEcosystem!.whitelistControllerV1.connect(owner).addToRole(TRADER_ROLE, unwrapper.address);

  await core.jonesEcosystem!.whitelistControllerV1.connect(owner).addToWhitelistContracts(unwrapper.address);
  await core.jonesEcosystem!.whitelistControllerV1.connect(owner).addToWhitelistContracts(wrapper.address);
}

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
