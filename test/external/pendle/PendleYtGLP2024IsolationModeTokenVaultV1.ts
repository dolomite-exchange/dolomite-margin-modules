import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { impersonate, revertToSnapshotAndCapture, snapshot } from 'test/utils';
import { createPendleGLPRegistry, createPendlePtGLP2024IsolationModeTokenVaultV1, createPendleYtGLP2024IsolationModeUnwrapperTraderV2, createPendleYtGLP2024IsolationModeVaultFactory, createPendleYtGLP2024IsolationModeWrapperTraderV2, createPendleYtGLPPriceOracle } from 'test/utils/ecosystem-token-utils/pendle';
import { PendleYtGLP2024IsolationModeVaultFactory, PendleYtGLP2024IsolationModeTokenVaultV1, IPendleSyToken__factory, PendleYtGLP2024IsolationModeTokenVaultV1__factory, PendleYtGLPPriceOracle, IERC20, IPendleYtToken, IPlutusVaultGLPFarm, PendleGLPRegistry, PendleYtGLP2024IsolationModeUnwrapperTraderV2, PendleYtGLP2024IsolationModeWrapperTraderV2 } from '../../../src/types';
import { Network } from '../../../src/utils/no-deps-constants';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol, setupTestMarket, setupUserVaultProxy } from '../../utils/setup';

describe('PendleYtGLP2024IsolationModeTokenVaultV1', () => {
    let snapshotId: string;

    let core: CoreProtocol;
    let underlyingToken: IPendleYtToken;
    let pendleRegistry: PendleGLPRegistry;
    let unwrapper: PendleYtGLP2024IsolationModeUnwrapperTraderV2;
    let wrapper: PendleYtGLP2024IsolationModeWrapperTraderV2;
    let priceOracle: PendleYtGLPPriceOracle;
    let factory: PendleYtGLP2024IsolationModeVaultFactory;
    let vault: PendleYtGLP2024IsolationModeTokenVaultV1;
    let underlyingMarketId: BigNumber;
    let rewardToken: IERC20;
    let farm: IPlutusVaultGLPFarm;

    before(async () => {
        core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
        underlyingToken = core.pendleEcosystem!.ytGlpToken.connect(core.hhUser1);
        rewardToken = core.plutusEcosystem!.plsToken.connect(core.hhUser1);
        farm = core.plutusEcosystem!.plvGlpFarm.connect(core.hhUser1);
        const userVaultImplementation = await createPendlePtGLP2024IsolationModeTokenVaultV1();
        pendleRegistry = await createPendleGLPRegistry(core);
        factory = await createPendleYtGLP2024IsolationModeVaultFactory(
            core,
            pendleRegistry,
            underlyingToken,
            userVaultImplementation,
        );
        unwrapper = await createPendleYtGLP2024IsolationModeUnwrapperTraderV2(core, factory, pendleRegistry);
        wrapper = await createPendleYtGLP2024IsolationModeWrapperTraderV2(core, factory, pendleRegistry);
        priceOracle = await createPendleYtGLPPriceOracle(core, factory, pendleRegistry);

        underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
        await setupTestMarket(core, factory, true, priceOracle);

        await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
        await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

        await factory.createVault(core.hhUser1.address);
        const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
        vault = setupUserVaultProxy<PendleYtGLP2024IsolationModeTokenVaultV1>(
            vaultAddress,
            PendleYtGLP2024IsolationModeTokenVaultV1__factory,
            core.hhUser1,
        );

        snapshotId = await snapshot();
    })

    beforeEach(async () => {
        snapshotId = await revertToSnapshotAndCapture(snapshotId);
    })

    describe('#isExternalRedemptionPaused', () => {
        it('should work normally', async () => {
            expect(await vault.isExternalRedemptionPaused()).to.be.false;
        });

        it('should work when owner paused syGLP', async () => {
            expect(await vault.isExternalRedemptionPaused()).to.be.false;
            const syGlp = IPendleSyToken__factory.connect(await pendleRegistry.syGlpToken(), core.hhUser1);
            const owner = await impersonate(await syGlp.owner(), true);
            await syGlp.connect(owner).pause();
            expect(await vault.isExternalRedemptionPaused()).to.be.true;
        });
    })
});