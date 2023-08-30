// import {
//   GmxRegistryV2,
//   GmxV2IsolationModeTokenVaultV1,
//   GmxV2IsolationModeUnwrapperTraderV2,
//   GmxV2IsolationModeVaultFactory,
//   GmxV2IsolationModeWrapperTraderV2,
//   GmxV2MarketTokenPriceOracle,
//   IGmxMarketToken,
// } from 'src/types';
// import { Network } from 'src/utils/no-deps-constants';
// import { revertToSnapshotAndCapture, snapshot } from 'test/utils';
// import {
//   createGmxRegistryV2,
//   createGmxV2IsolationModeTokenVaultV1,
//   createGmxV2IsolationModeUnwrapperTraderV2,
//   createGmxV2IsolationModeVaultFactory,
//   createGmxV2IsolationModeWrapperTraderV2,
// } from 'test/utils/ecosystem-token-utils/gmx';
// import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol } from 'test/utils/setup';

// describe('GmxV2IsolationModeUnwrapperTraderV2', () => {
//   let snapshotId: string;

//   let core: CoreProtocol;
//   let underlyingToken: IGmxMarketToken;
//   let gmxRegistryV2: GmxRegistryV2;
//   let unwrapper: GmxV2IsolationModeUnwrapperTraderV2;
//   let wrapper: GmxV2IsolationModeWrapperTraderV2;
//   let priceOracle: GmxV2MarketTokenPriceOracle;
//   let factory: GmxV2IsolationModeVaultFactory;
//   let vault: GmxV2IsolationModeTokenVaultV1;

//   before(async () => {
//     core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
//     underlyingToken = core.gmxEcosystem!.gmxEthUsdMarketToken.connect(core.hhUser1);
//     const userVaultImplementation = await createGmxV2IsolationModeTokenVaultV1();
//     gmxRegistryV2 = await createGmxRegistryV2(core);
//     factory = await createGmxV2IsolationModeVaultFactory(
//       core,
//       gmxRegistryV2,
//       [], // initialAllowableDebtMarketIds
//       [], // initialAllowableCollateralMarketIds
//       core.gmxEcosystem!.gmxEthUsdMarketToken,
//       userVaultImplementation
//     );
//     unwrapper = await createGmxV2IsolationModeUnwrapperTraderV2(core, factory, gmxRegistryV2);
//     wrapper = await createGmxV2IsolationModeWrapperTraderV2(core, factory, gmxRegistryV2);

//     snapshotId = await snapshot();
//   });

//   beforeEach(async () => {
//     snapshotId = await revertToSnapshotAndCapture(snapshotId);
//   });

//   describe('#constructor', () => {
//     it('should work normally', async () => {});
//   });
// });
