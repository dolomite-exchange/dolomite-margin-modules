import { MAX_UINT_256_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import {
  IUmamiAggregateVault__factory,
  IUmamiAssetVaultRegistry,
  IUmamiAssetVaultStorageViewer__factory,
  IUmamiAssetVaultWhitelist__factory,
  UmamiAssetVaultRegistry,
} from '../src/types';

export async function setupWhitelistAndAggregateVault(
  core: CoreProtocolArbitrumOne,
  umamiRegistry: UmamiAssetVaultRegistry | IUmamiAssetVaultRegistry,
) {
  const aggregateVault = IUmamiAggregateVault__factory.connect(
    await core.umamiEcosystem!.glpUsdc.connect(core.hhUser1).aggregateVault(),
    core.umamiEcosystem!.configurator,
  );
  await aggregateVault.connect(core.umamiEcosystem!.configurator).setVaultCaps([
    MAX_UINT_256_BI,
    MAX_UINT_256_BI,
    MAX_UINT_256_BI,
    MAX_UINT_256_BI,
    MAX_UINT_256_BI,
  ]);
  const storageViewer = IUmamiAssetVaultStorageViewer__factory.connect(
    await umamiRegistry.storageViewer(),
    core.hhUser1,
  );
  const vaultFees = await storageViewer.getVaultFees();
  await aggregateVault.connect(core.umamiEcosystem!.configurator).setVaultFees(
    ZERO_BI,
    ZERO_BI,
    vaultFees.withdrawalFee,
    vaultFees.depositFee,
    ZERO_BI,
  );
  const whitelist = IUmamiAssetVaultWhitelist__factory.connect(
    await storageViewer.getWhitelist(),
    core.umamiEcosystem!.configurator,
  );
  await whitelist.updateWhitelistEnabled(false);
}
