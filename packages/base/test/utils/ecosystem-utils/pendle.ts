import { TestInterestSetter } from '@dolomite-exchange/modules-interest-setters/src/types';
import {
  IPendleGLPRegistry,
  IPendlePtMarket,
  IPendlePtOracle,
  IPendlePtToken, IPendleRegistry,
  IPendleRouter, IPendleSyToken,
  IPendleYtToken,
  PendlePtGLP2024IsolationModeVaultFactory,
  PendlePtIsolationModeVaultFactory,
  PendleYtGLP2024IsolationModeVaultFactory,
} from '@dolomite-exchange/modules-pendle/src/types';
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
  RegistryProxy,
  TestDolomiteMarginExchangeWrapper,
  TestPriceOracle,
} from '../../../src/types';

export interface PendleEcosystem {
  pendleRouter: IPendleRouter;
  glpMar2024: {
    pendleRegistry: IPendleGLPRegistry;
    pendleRegistryProxy: RegistryProxy;
    ptGlpMarket: IPendlePtMarket;
    ptGlpToken: IPendlePtToken;
    ptOracle: IPendlePtOracle;
    ytGlpToken: IPendleYtToken;
    dPtGlp2024: PendlePtGLP2024IsolationModeVaultFactory;
    dYtGlp2024: PendleYtGLP2024IsolationModeVaultFactory;
  };
  rEthJun2025: {
    dPtREthJun2025: PendlePtIsolationModeVaultFactory;
    pendleRegistry: IPendleRegistry;
    ptOracle: IPendlePtOracle;
    ptREthMarket: IPendlePtMarket;
    ptREthToken: IPendlePtToken;
  };
  wstEthJun2024: {
    dPtWstEthJun2024: PendlePtIsolationModeVaultFactory;
    pendleRegistry: IPendleRegistry;
    ptOracle: IPendlePtOracle;
    ptWstEthMarket: IPendlePtMarket;
    ptWstEthToken: IPendlePtToken;
  };
  wstEthJun2025: {
    dPtWstEthJun2025: PendlePtIsolationModeVaultFactory;
    pendleRegistry: IPendleRegistry;
    ptOracle: IPendlePtOracle;
    ptWstEthMarket: IPendlePtMarket;
    ptWstEthToken: IPendlePtToken;
  };
  syGlpToken: IPendleSyToken;
  syREthToken: IPendleSyToken;
  syWstEthToken: IPendleSyToken;
}
