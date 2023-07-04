import {
  IUmamiAggregateVault__factory,
  IUmamiAssetVaultRegistry,
  IUmamiAssetVaultStorageViewer__factory,
  IUmamiAssetVaultWhitelist__factory,
  UmamiAssetVaultRegistry,
} from '../../../src/types';
import { MAX_UINT_256_BI } from '../../../src/utils/no-deps-constants';
import { CoreProtocol } from '../../utils/setup';

export async function setupWhitelistAndAggregateVault(
  core: CoreProtocol,
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
  const whitelist = IUmamiAssetVaultWhitelist__factory.connect(
    await storageViewer.getWhitelist(),
    core.umamiEcosystem!.configurator,
  );
  await whitelist.updateWhitelistEnabled(false);
}
