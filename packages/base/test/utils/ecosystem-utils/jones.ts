import { TestInterestSetter } from '@dolomite-exchange/modules-interest-setters/src/types';
import {
  IJonesGLPAdapter,
  IJonesGLPVaultRouter, IJonesUSDCFarm, IJonesUSDCRegistry,
  IJonesWhitelistController, JonesUSDCIsolationModeVaultFactory,
} from '@dolomite-exchange/modules-jones/src/types';
import { VesterImplementationV1, VesterProxy } from '@dolomite-exchange/modules-liquidity-mining/src/types';
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
import { address } from '@dolomite-margin/dist/src';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Signer } from 'ethers';
import {
  IAlgebraV3Pool, IERC20,
  IERC4626,
  IOdosRouter,
  IParaswapAugustusRouter,
  IParaswapFeeClaimer, ParaswapAggregatorTraderV2,
  RegistryProxy, TestDolomiteMarginExchangeWrapper, TestPriceOracle,
} from '../../../src/types';

export interface JonesEcosystem {
  glpAdapter: IJonesGLPAdapter;
  glpVaultRouter: IJonesGLPVaultRouter;
  whitelistController: IJonesWhitelistController;
  usdcReceiptToken: IERC4626;
  jUSDC: IERC4626;
  jUSDCFarm: IJonesUSDCFarm;
  admin: SignerWithAddress;
  jonesWethV3Pool: IAlgebraV3Pool;
  live: {
    jUSDCIsolationModeFactory: JonesUSDCIsolationModeVaultFactory;
    jonesUSDCRegistry: IJonesUSDCRegistry;
    jonesUSDCRegistryProxy: RegistryProxy;
  };
}
