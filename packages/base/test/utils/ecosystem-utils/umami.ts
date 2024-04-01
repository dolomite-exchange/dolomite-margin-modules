import {
  IUmamiAssetVault,
  IUmamiAssetVault__factory,
  IUmamiAssetVaultStorageViewer,
  IUmamiAssetVaultStorageViewer__factory,
} from '@dolomite-exchange/modules-umami/src/types';
import { Signer } from 'ethers';
import {
  UMAMI_CONFIGURATOR_MAP,
  UMAMI_LINK_VAULT_MAP,
  UMAMI_STORAGE_VIEWER_MAP,
  UMAMI_UNI_VAULT_MAP,
  UMAMI_USDC_VAULT_MAP,
  UMAMI_WBTC_VAULT_MAP,
  UMAMI_WETH_VAULT_MAP,
} from '../../../src/utils/constants';
import { Network } from '../../../src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '../../../src/utils/SignerWithAddressWithSafety';
import { impersonateOrFallback } from '../index';
import { getContract } from '../setup';

export interface UmamiEcosystem {
  glpLink: IUmamiAssetVault;
  glpUni: IUmamiAssetVault;
  glpUsdc: IUmamiAssetVault;
  glpWbtc: IUmamiAssetVault;
  glpWeth: IUmamiAssetVault;
  storageViewer: IUmamiAssetVaultStorageViewer;
  configurator: Signer;
}

export async function createUmamiEcosystem(
  network: Network,
  signer: SignerWithAddressWithSafety,
): Promise<UmamiEcosystem> {
  if (network !== Network.ArbitrumOne) {
    return Promise.reject(`Invalid network, found ${network}`);
  }

  return {
    glpLink: getContract(
      UMAMI_LINK_VAULT_MAP[network] as string,
      IUmamiAssetVault__factory.connect,
      signer,
    ),
    glpUni: getContract(
      UMAMI_UNI_VAULT_MAP[network] as string,
      IUmamiAssetVault__factory.connect,
      signer,
    ),
    glpUsdc: getContract(
      UMAMI_USDC_VAULT_MAP[network] as string,
      IUmamiAssetVault__factory.connect,
      signer,
    ),
    glpWbtc: getContract(
      UMAMI_WBTC_VAULT_MAP[network] as string,
      IUmamiAssetVault__factory.connect,
      signer,
    ),
    glpWeth: getContract(
      UMAMI_WETH_VAULT_MAP[network] as string,
      IUmamiAssetVault__factory.connect,
      signer,
    ),
    storageViewer: getContract(
      UMAMI_STORAGE_VIEWER_MAP[network] as string,
      IUmamiAssetVaultStorageViewer__factory.connect,
      signer,
    ),
    configurator: await impersonateOrFallback(UMAMI_CONFIGURATOR_MAP[network] as string, true, signer),
  };
}
