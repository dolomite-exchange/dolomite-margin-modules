import {
  DolomiteCompatibleWhitelistForPlutusDAO,
  DolomiteCompatibleWhitelistForPlutusDAO__factory,
  IPlutusVaultGLPFarm,
  IPlutusVaultGLPFarm__factory,
  IPlutusVaultGLPIsolationModeVaultFactory,
  IPlutusVaultGLPIsolationModeVaultFactory__factory,
  IPlutusVaultGLPRouter,
  IPlutusVaultGLPRouter__factory,
  IPlutusVaultRegistry,
  IPlutusVaultRegistry__factory,
  PlutusVaultGLPIsolationModeUnwrapperTraderV1,
  PlutusVaultGLPIsolationModeUnwrapperTraderV1__factory,
  PlutusVaultGLPIsolationModeWrapperTraderV1,
  PlutusVaultGLPIsolationModeWrapperTraderV1__factory,
} from '@dolomite-exchange/modules-plutus/src/types';
import { IERC20, IERC20__factory, IERC4626, IERC4626__factory, } from '../../../src/types';
import { Network } from '../../../src/utils/no-deps-constants';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { PLS_TOKEN_MAP, PLV_GLP_FARM_MAP, PLV_GLP_MAP, PLV_GLP_ROUTER_MAP } from '../../../src/utils/constants';
import Deployments from '@dolomite-exchange/modules-deployment/src/deploy/deployments.json';
import { getContract } from '../setup';

export interface PlutusEcosystem {
  plvGlp: IERC4626;
  plsToken: IERC20;
  plvGlpFarm: IPlutusVaultGLPFarm;
  plvGlpRouter: IPlutusVaultGLPRouter;
  sGlp: IERC20;
  live: {
    dolomiteWhitelistForGlpDepositor: DolomiteCompatibleWhitelistForPlutusDAO;
    dolomiteWhitelistForPlutusChef: DolomiteCompatibleWhitelistForPlutusDAO;
    plutusVaultRegistry: IPlutusVaultRegistry;
    plvGlpIsolationModeFactory: IPlutusVaultGLPIsolationModeVaultFactory;
    plvGlpIsolationModeUnwrapperTraderV1: PlutusVaultGLPIsolationModeUnwrapperTraderV1;
    plvGlpIsolationModeWrapperTraderV1: PlutusVaultGLPIsolationModeWrapperTraderV1;
  };
}

export async function createPlutusEcosystem(
  network: Network,
  signer: SignerWithAddress,
): Promise<PlutusEcosystem> {
  if (network !== Network.ArbitrumOne) {
    return Promise.reject(`Invalid network, found ${network}`);
  }

  const sGlpAddressForPlutus = '0x2F546AD4eDD93B956C8999Be404cdCAFde3E89AE';
  return {
    plvGlp: getContract(PLV_GLP_MAP[network] as string, IERC4626__factory.connect, signer),
    plsToken: getContract(PLS_TOKEN_MAP[network] as string, IERC20__factory.connect, signer),
    plvGlpFarm: getContract(
      PLV_GLP_FARM_MAP[network] as string,
      IPlutusVaultGLPFarm__factory.connect,
      signer,
    ),
    plvGlpRouter: getContract(
      PLV_GLP_ROUTER_MAP[network] as string,
      IPlutusVaultGLPRouter__factory.connect,
      signer,
    ),
    sGlp: getContract(sGlpAddressForPlutus, IERC20__factory.connect, signer),
    live: {
      dolomiteWhitelistForGlpDepositor: getContract(
        (Deployments.DolomiteWhitelistForGlpDepositorV2 as any)[network]?.address,
        DolomiteCompatibleWhitelistForPlutusDAO__factory.connect,
        signer,
      ),
      dolomiteWhitelistForPlutusChef: getContract(
        (Deployments.DolomiteWhitelistForPlutusChef as any)[network]?.address,
        DolomiteCompatibleWhitelistForPlutusDAO__factory.connect,
        signer,
      ),
      plutusVaultRegistry: getContract(
        (Deployments.PlutusVaultRegistryProxy as any)[network]?.address,
        IPlutusVaultRegistry__factory.connect,
        signer,
      ),
      plvGlpIsolationModeFactory: getContract(
        (Deployments.PlutusVaultGLPIsolationModeVaultFactory as any)[network]?.address,
        IPlutusVaultGLPIsolationModeVaultFactory__factory.connect,
        signer,
      ),
      plvGlpIsolationModeUnwrapperTraderV1: getContract(
        (Deployments.PlutusVaultGLPIsolationModeUnwrapperTraderV1 as any)[network]?.address,
        PlutusVaultGLPIsolationModeUnwrapperTraderV1__factory.connect,
        signer,
      ),
      plvGlpIsolationModeWrapperTraderV1: getContract(
        (Deployments.PlutusVaultGLPIsolationModeWrapperTraderV1 as any)[network]?.address,
        PlutusVaultGLPIsolationModeWrapperTraderV1__factory.connect,
        signer,
      ),
    },
  };
}
