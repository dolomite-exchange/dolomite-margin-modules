import { IUmamiAssetVault, IUmamiAssetVaultStorageViewer } from '@dolomite-exchange/modules-umami/src/types';
import { Signer } from 'ethers';

export interface UmamiEcosystem {
  glpLink: IUmamiAssetVault;
  glpUni: IUmamiAssetVault;
  glpUsdc: IUmamiAssetVault;
  glpWbtc: IUmamiAssetVault;
  glpWeth: IUmamiAssetVault;
  storageViewer: IUmamiAssetVaultStorageViewer;
  configurator: Signer;
}
