/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { ethers } from "ethers";
import {
  FactoryOptions,
  HardhatEthersHelpers as HardhatEthersHelpersBase,
} from "@nomiclabs/hardhat-ethers/types";

import * as Contracts from ".";

declare module "hardhat/types/runtime" {
  interface HardhatEthersHelpers extends HardhatEthersHelpersBase {
    getContractFactory(
      name: "OnlyDolomiteMargin",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.OnlyDolomiteMargin__factory>;
    getContractFactory(
      name: "OnlyDolomiteMarginForUpgradeable",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.OnlyDolomiteMarginForUpgradeable__factory>;
    getContractFactory(
      name: "IAuthorizationBase",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IAuthorizationBase__factory>;
    getContractFactory(
      name: "IBaseRegistry",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IBaseRegistry__factory>;
    getContractFactory(
      name: "IBorrowPositionProxyV1",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IBorrowPositionProxyV1__factory>;
    getContractFactory(
      name: "IBorrowPositionProxyV2",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IBorrowPositionProxyV2__factory>;
    getContractFactory(
      name: "IDolomiteMarginUnwrapperTraderForLiquidatorV3",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IDolomiteMarginUnwrapperTraderForLiquidatorV3__factory>;
    getContractFactory(
      name: "IDolomiteMarginWrapperTraderForLiquidatorV3",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IDolomiteMarginWrapperTraderForLiquidatorV3__factory>;
    getContractFactory(
      name: "IDolomiteRegistry",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IDolomiteRegistry__factory>;
    getContractFactory(
      name: "IERC4626",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IERC4626__factory>;
    getContractFactory(
      name: "IEventEmitterRegistry",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IEventEmitterRegistry__factory>;
    getContractFactory(
      name: "IExpiry",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IExpiry__factory>;
    getContractFactory(
      name: "IGenericTraderProxyV1",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IGenericTraderProxyV1__factory>;
    getContractFactory(
      name: "ILiquidatorAssetRegistry",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.ILiquidatorAssetRegistry__factory>;
    getContractFactory(
      name: "IOnlyDolomiteMargin",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IOnlyDolomiteMargin__factory>;
    getContractFactory(
      name: "IIsolationModeUnwrapperTraderV2",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IIsolationModeUnwrapperTraderV2__factory>;
    getContractFactory(
      name: "IIsolationModeVaultFactory",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IIsolationModeVaultFactory__factory>;
    getContractFactory(
      name: "IIsolationModeWrapperTraderV2",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IIsolationModeWrapperTraderV2__factory>;
    getContractFactory(
      name: "IUpgradeableAsyncIsolationModeUnwrapperTrader",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IUpgradeableAsyncIsolationModeUnwrapperTrader__factory>;
    getContractFactory(
      name: "IUpgradeableAsyncIsolationModeWrapperTrader",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IUpgradeableAsyncIsolationModeWrapperTrader__factory>;
    getContractFactory(
      name: "IDolomiteInterestSetter",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IDolomiteInterestSetter__factory>;
    getContractFactory(
      name: "IDolomiteMargin",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IDolomiteMargin__factory>;
    getContractFactory(
      name: "IDolomiteMarginAdmin",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IDolomiteMarginAdmin__factory>;
    getContractFactory(
      name: "IDolomiteMarginExchangeWrapper",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IDolomiteMarginExchangeWrapper__factory>;
    getContractFactory(
      name: "IDolomitePriceOracle",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IDolomitePriceOracle__factory>;
    getContractFactory(
      name: "GLPMathLib",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.GLPMathLib__factory>;
    getContractFactory(
      name: "IGLPIsolationModeVaultFactory",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IGLPIsolationModeVaultFactory__factory>;
    getContractFactory(
      name: "IGLPManager",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IGLPManager__factory>;
    getContractFactory(
      name: "IGLPRewardsRouterV2",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IGLPRewardsRouterV2__factory>;
    getContractFactory(
      name: "IGMXIsolationModeVaultFactory",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IGMXIsolationModeVaultFactory__factory>;
    getContractFactory(
      name: "IGmxRegistryV1",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IGmxRegistryV1__factory>;
    getContractFactory(
      name: "IGmxRewardRouterV2",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IGmxRewardRouterV2__factory>;
    getContractFactory(
      name: "IGmxVault",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IGmxVault__factory>;
    getContractFactory(
      name: "ChainlinkAutomationPriceOracle",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.ChainlinkAutomationPriceOracle__factory>;
    getContractFactory(
      name: "IChainlinkAutomation",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IChainlinkAutomation__factory>;
    getContractFactory(
      name: "IChainlinkAutomationPriceOracle",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IChainlinkAutomationPriceOracle__factory>;
    getContractFactory(
      name: "IChainlinkRegistry",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IChainlinkRegistry__factory>;
    getContractFactory(
      name: "IERC20Metadata",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IERC20Metadata__factory>;
    getContractFactory(
      name: "IERC20Permit",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IERC20Permit__factory>;
    getContractFactory(
      name: "IERC20",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.IERC20__factory>;
    getContractFactory(
      name: "MagicGLPPriceOracle",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.MagicGLPPriceOracle__factory>;
    getContractFactory(
      name: "MagicGLPUnwrapperTraderV1",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.MagicGLPUnwrapperTraderV1__factory>;
    getContractFactory(
      name: "MagicGLPUnwrapperTraderV2",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.MagicGLPUnwrapperTraderV2__factory>;
    getContractFactory(
      name: "MagicGLPWithChainlinkAutomationPriceOracle",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.MagicGLPWithChainlinkAutomationPriceOracle__factory>;
    getContractFactory(
      name: "MagicGLPWrapperTraderV1",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.MagicGLPWrapperTraderV1__factory>;
    getContractFactory(
      name: "MagicGLPWrapperTraderV2",
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<Contracts.MagicGLPWrapperTraderV2__factory>;

    getContractAt(
      name: "OnlyDolomiteMargin",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.OnlyDolomiteMargin>;
    getContractAt(
      name: "OnlyDolomiteMarginForUpgradeable",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.OnlyDolomiteMarginForUpgradeable>;
    getContractAt(
      name: "IAuthorizationBase",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IAuthorizationBase>;
    getContractAt(
      name: "IBaseRegistry",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IBaseRegistry>;
    getContractAt(
      name: "IBorrowPositionProxyV1",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IBorrowPositionProxyV1>;
    getContractAt(
      name: "IBorrowPositionProxyV2",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IBorrowPositionProxyV2>;
    getContractAt(
      name: "IDolomiteMarginUnwrapperTraderForLiquidatorV3",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IDolomiteMarginUnwrapperTraderForLiquidatorV3>;
    getContractAt(
      name: "IDolomiteMarginWrapperTraderForLiquidatorV3",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IDolomiteMarginWrapperTraderForLiquidatorV3>;
    getContractAt(
      name: "IDolomiteRegistry",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IDolomiteRegistry>;
    getContractAt(
      name: "IERC4626",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IERC4626>;
    getContractAt(
      name: "IEventEmitterRegistry",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IEventEmitterRegistry>;
    getContractAt(
      name: "IExpiry",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IExpiry>;
    getContractAt(
      name: "IGenericTraderProxyV1",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IGenericTraderProxyV1>;
    getContractAt(
      name: "ILiquidatorAssetRegistry",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.ILiquidatorAssetRegistry>;
    getContractAt(
      name: "IOnlyDolomiteMargin",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IOnlyDolomiteMargin>;
    getContractAt(
      name: "IIsolationModeUnwrapperTraderV2",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IIsolationModeUnwrapperTraderV2>;
    getContractAt(
      name: "IIsolationModeVaultFactory",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IIsolationModeVaultFactory>;
    getContractAt(
      name: "IIsolationModeWrapperTraderV2",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IIsolationModeWrapperTraderV2>;
    getContractAt(
      name: "IUpgradeableAsyncIsolationModeUnwrapperTrader",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IUpgradeableAsyncIsolationModeUnwrapperTrader>;
    getContractAt(
      name: "IUpgradeableAsyncIsolationModeWrapperTrader",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IUpgradeableAsyncIsolationModeWrapperTrader>;
    getContractAt(
      name: "IDolomiteInterestSetter",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IDolomiteInterestSetter>;
    getContractAt(
      name: "IDolomiteMargin",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IDolomiteMargin>;
    getContractAt(
      name: "IDolomiteMarginAdmin",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IDolomiteMarginAdmin>;
    getContractAt(
      name: "IDolomiteMarginExchangeWrapper",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IDolomiteMarginExchangeWrapper>;
    getContractAt(
      name: "IDolomitePriceOracle",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IDolomitePriceOracle>;
    getContractAt(
      name: "GLPMathLib",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.GLPMathLib>;
    getContractAt(
      name: "IGLPIsolationModeVaultFactory",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IGLPIsolationModeVaultFactory>;
    getContractAt(
      name: "IGLPManager",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IGLPManager>;
    getContractAt(
      name: "IGLPRewardsRouterV2",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IGLPRewardsRouterV2>;
    getContractAt(
      name: "IGMXIsolationModeVaultFactory",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IGMXIsolationModeVaultFactory>;
    getContractAt(
      name: "IGmxRegistryV1",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IGmxRegistryV1>;
    getContractAt(
      name: "IGmxRewardRouterV2",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IGmxRewardRouterV2>;
    getContractAt(
      name: "IGmxVault",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IGmxVault>;
    getContractAt(
      name: "ChainlinkAutomationPriceOracle",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.ChainlinkAutomationPriceOracle>;
    getContractAt(
      name: "IChainlinkAutomation",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IChainlinkAutomation>;
    getContractAt(
      name: "IChainlinkAutomationPriceOracle",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IChainlinkAutomationPriceOracle>;
    getContractAt(
      name: "IChainlinkRegistry",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IChainlinkRegistry>;
    getContractAt(
      name: "IERC20Metadata",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IERC20Metadata>;
    getContractAt(
      name: "IERC20Permit",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IERC20Permit>;
    getContractAt(
      name: "IERC20",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.IERC20>;
    getContractAt(
      name: "MagicGLPPriceOracle",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.MagicGLPPriceOracle>;
    getContractAt(
      name: "MagicGLPUnwrapperTraderV1",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.MagicGLPUnwrapperTraderV1>;
    getContractAt(
      name: "MagicGLPUnwrapperTraderV2",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.MagicGLPUnwrapperTraderV2>;
    getContractAt(
      name: "MagicGLPWithChainlinkAutomationPriceOracle",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.MagicGLPWithChainlinkAutomationPriceOracle>;
    getContractAt(
      name: "MagicGLPWrapperTraderV1",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.MagicGLPWrapperTraderV1>;
    getContractAt(
      name: "MagicGLPWrapperTraderV2",
      address: string,
      signer?: ethers.Signer
    ): Promise<Contracts.MagicGLPWrapperTraderV2>;

    // default types
    getContractFactory(
      name: string,
      signerOrOptions?: ethers.Signer | FactoryOptions
    ): Promise<ethers.ContractFactory>;
    getContractFactory(
      abi: any[],
      bytecode: ethers.utils.BytesLike,
      signer?: ethers.Signer
    ): Promise<ethers.ContractFactory>;
    getContractAt(
      nameOrAbi: string | any[],
      address: string,
      signer?: ethers.Signer
    ): Promise<ethers.Contract>;
  }
}