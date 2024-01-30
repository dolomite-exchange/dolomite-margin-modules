import { TestInterestSetter } from '@dolomite-exchange/modules-interest-setters/src/types';
import { IUmamiAssetVault, IUmamiAssetVaultStorageViewer } from '@dolomite-exchange/modules-umami/src/types';
import { Signer } from 'ethers';
import { IAlgebraV3Pool, TestDolomiteMarginExchangeWrapper, TestPriceOracle } from '../../../src/types';

export interface PremiaEcosystem {
  premiaWethV3Pool: IAlgebraV3Pool;
}
