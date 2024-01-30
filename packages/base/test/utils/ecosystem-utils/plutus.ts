import { TestInterestSetter } from '@dolomite-exchange/modules-interest-setters/src/types';
import {
  DolomiteCompatibleWhitelistForPlutusDAO,
  IPlutusVaultGLPFarm,
  IPlutusVaultGLPIsolationModeVaultFactory,
  IPlutusVaultGLPRouter,
  IPlutusVaultRegistry,
  PlutusVaultGLPIsolationModeUnwrapperTraderV1,
  PlutusVaultGLPIsolationModeWrapperTraderV1,
} from '@dolomite-exchange/modules-plutus/src/types';
import { IUmamiAssetVault, IUmamiAssetVaultStorageViewer } from '@dolomite-exchange/modules-umami/src/types';
import { Signer } from 'ethers';
import {
  IAlgebraV3Pool,
  IERC20,
  IERC4626,
  TestDolomiteMarginExchangeWrapper,
  TestPriceOracle,
} from '../../../src/types';

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
