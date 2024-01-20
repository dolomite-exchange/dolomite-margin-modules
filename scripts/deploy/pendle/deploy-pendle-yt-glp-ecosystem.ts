import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import {
  PendleYtGLP2024IsolationModeTokenVaultV1__factory,
  PendleYtGLP2024IsolationModeUnwrapperTraderV2__factory,
  PendleYtGLP2024IsolationModeVaultFactory__factory,
  PendleYtGLP2024IsolationModeWrapperTraderV2__factory,
} from '../../../src/types';
import {
  getPendleYtGLP2024IsolationModeUnwrapperTraderV2ConstructorParams,
  getPendleYtGLP2024IsolationModeVaultFactoryConstructorParams,
  getPendleYtGLP2024IsolationModeWrapperTraderV2ConstructorParams,
  getPendleYtGLPPriceOracleConstructorParams,
} from '@dolomite-exchange/modules-pendle/src/pendle';
import { Network, ONE_ETH_BI, TEN_BI } from '../../../packages/base/src/utils/no-deps-constants';
import { setupCoreProtocol } from '../../../packages/base/test/utils/setup';
import { deployContractAndSave, prettyPrintEncodedDataWithTypeSafety } from '../../deploy-utils';

async function main() {
  const network = (await ethers.provider.getNetwork()).chainId.toString() as Network;
  const core = await setupCoreProtocol({ network, blockNumber: 0 });

  const dolomiteRegistryImplementationAddress = await deployContractAndSave(
    Number(network),
    'DolomiteRegistryImplementation',
    [],
    'DolomiteRegistryImplementationV3',
  );

  const pendleRegistryImplementationAddress = await deployContractAndSave(
    Number(network),
    'PendleGLPRegistry',
    [],
    'PendleGLP2024RegistryV2Implementation',
  );

  const userVaultImplementationAddress = await deployContractAndSave(
    Number(network),
    'PendleYtGLP2024IsolationModeTokenVaultV1',
    [],
  );
  const userVaultImplementation = PendleYtGLP2024IsolationModeTokenVaultV1__factory.connect(
    userVaultImplementationAddress,
    core.hhUser1,
  );

  const dYtGlpTokenAddress = await deployContractAndSave(
    Number(network),
    'PendleYtGLP2024IsolationModeVaultFactory',
    getPendleYtGLP2024IsolationModeVaultFactoryConstructorParams(
      core,
      core.pendleEcosystem!.glpMar2024.pendleRegistry,
      [
        core.marketIds.weth,
        core.marketIds.dai!,
        core.marketIds.usdc,
        core.marketIds.usdt!,
        core.marketIds.wbtc,
        core.marketIds.mim!,
      ],
      [],
      core.pendleEcosystem!.glpMar2024.ytGlpToken,
      userVaultImplementation,
    ),
  );
  const dytGlpToken = PendleYtGLP2024IsolationModeVaultFactory__factory.connect(dYtGlpTokenAddress, core.hhUser1);

  const unwrapperAddress = await deployContractAndSave(
    Number(network),
    'PendleYtGLP2024IsolationModeUnwrapperTraderV2',
    getPendleYtGLP2024IsolationModeUnwrapperTraderV2ConstructorParams(
      core,
      dytGlpToken,
      core.pendleEcosystem!.glpMar2024.pendleRegistry,
    ),
  );
  const unwrapper = PendleYtGLP2024IsolationModeUnwrapperTraderV2__factory.connect(unwrapperAddress, core.hhUser1);

  const wrapperAddress = await deployContractAndSave(
    Number(network),
    'PendleYtGLP2024IsolationModeWrapperTraderV2',
    getPendleYtGLP2024IsolationModeWrapperTraderV2ConstructorParams(
      core,
      dytGlpToken,
      core.pendleEcosystem!.glpMar2024.pendleRegistry,
    ),
  );
  const wrapper = PendleYtGLP2024IsolationModeWrapperTraderV2__factory.connect(wrapperAddress, core.hhUser1);

  const priceOracleAddress = await deployContractAndSave(
    Number(network),
    'PendleYtGLPPriceOracle',
    getPendleYtGLPPriceOracleConstructorParams(core, dytGlpToken, core.pendleEcosystem!.glpMar2024.pendleRegistry),
  );

  await prettyPrintEncodedDataWithTypeSafety(
    core,
    core,
    'dolomiteRegistryProxy',
    'upgradeTo',
    [dolomiteRegistryImplementationAddress],
  );
  await prettyPrintEncodedDataWithTypeSafety(
    core,
    core,
    'dolomiteRegistry',
    'ownerSetExpiry',
    [core.expiry.address],
  );
  await prettyPrintEncodedDataWithTypeSafety(
    core,
    core.pendleEcosystem!.glpMar2024,
    'pendleRegistryProxy',
    'upgradeTo',
    [pendleRegistryImplementationAddress],
  );
  await prettyPrintEncodedDataWithTypeSafety(
    core,
    core.pendleEcosystem!.glpMar2024,
    'pendleRegistry',
    'ownerSetYtGlpToken',
    [core.pendleEcosystem!.glpMar2024.ytGlpToken.address],
  );
  await prettyPrintEncodedDataWithTypeSafety(
    core,
    core,
    'dolomiteMargin',
    'ownerAddMarket',
    [
      dytGlpToken.address,
      priceOracleAddress,
      core.interestSetters.alwaysZeroInterestSetter.address,
      { value: BigNumber.from('304347826086956521') }, // 30.4347% --> 150% collateralization
      { value: ONE_ETH_BI }, // 100% --> 10% liquidation penalty
      BigNumber.from(500_000).mul(TEN_BI.pow(await dytGlpToken.decimals())), // 500k units
      true, // isClosing = true
      false, // isRecyclable = false
    ],
  );
  await prettyPrintEncodedDataWithTypeSafety(
    core,
    { dytGlpToken },
    'dytGlpToken',
    'ownerInitialize',
    [[unwrapper.address, wrapper.address]],
  );
  await prettyPrintEncodedDataWithTypeSafety(
    core,
    core,
    'dolomiteMargin',
    'ownerSetGlobalOperator',
    [dytGlpToken.address, true],
  );
  const expectedMarketId = await core.dolomiteMargin.getNumMarkets();
  await prettyPrintEncodedDataWithTypeSafety(
    core,
    core,
    'liquidatorAssetRegistry',
    'ownerAddLiquidatorToAssetWhitelist',
    [expectedMarketId, core.liquidatorProxyV4.address],
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
