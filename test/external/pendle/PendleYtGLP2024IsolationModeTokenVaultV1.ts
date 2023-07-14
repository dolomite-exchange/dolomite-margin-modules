import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { BaseRouter, Router } from '@pendle/sdk-v2';
import { CHAIN_ID_MAPPING } from '@pendle/sdk-v2/dist/common/ChainId';
import { parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { impersonate, revertToSnapshotAndCapture, snapshot, increaseToTimestamp } from 'test/utils';
import { createPendleGLPRegistry, createPendleYtGLP2024IsolationModeTokenVaultV1, createPendleYtGLP2024IsolationModeUnwrapperTraderV2, createPendleYtGLP2024IsolationModeVaultFactory, createPendleYtGLP2024IsolationModeWrapperTraderV2, createPendleYtGLPPriceOracle } from 'test/utils/ecosystem-token-utils/pendle';
import { PendleYtGLP2024IsolationModeVaultFactory, PendleYtGLP2024IsolationModeTokenVaultV1, IPendleSyToken__factory, PendleYtGLP2024IsolationModeTokenVaultV1__factory, PendleYtGLPPriceOracle, IERC20, IPendleYtToken, IPlutusVaultGLPFarm, PendleGLPRegistry, PendleYtGLP2024IsolationModeUnwrapperTraderV2, PendleYtGLP2024IsolationModeWrapperTraderV2 } from '../../../src/types';
import { Network, ZERO_BI } from '../../../src/utils/no-deps-constants';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol, setupTestMarket, setupUserVaultProxy } from '../../utils/setup';
import { expectThrow } from 'test/utils/assertions';

const accountNumber = ZERO_BI;

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
    let router: BaseRouter;

    before(async () => {
        core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
        underlyingToken = core.pendleEcosystem!.ytGlpToken.connect(core.hhUser1);
        rewardToken = core.tokens.weth.connect(core.hhUser1);
        const userVaultImplementation = await createPendleYtGLP2024IsolationModeTokenVaultV1();
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
        router = Router.getRouter({
            chainId: CHAIN_ID_MAPPING.ARBITRUM,
            provider: core.hhUser1.provider,
            signer: core.hhUser1,
        });

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

        const syGlp = IPendleSyToken__factory.connect(await pendleRegistry.syGlpToken(), core.hhUser1);
        await syGlp.connect(core.hhUser1).deposit(core.hhUser1.address, ethers.constants.AddressZero, ethers.utils.parseEther("1"), 0, {value: parseEther("1")});
        let syGLPBal = (await syGlp.balanceOf(core.hhUser1.address));
        await syGlp.connect(core.hhUser1).approve(router.address, ethers.constants.MaxUint256);
        await router.mintPyFromSy( underlyingToken.address as any, syGLPBal, 5);


        snapshotId = await snapshot();
    });

    beforeEach(async () => {
        snapshotId = await revertToSnapshotAndCapture(snapshotId);
    });

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
    });

    describe('#redeemDueInterestAndRewards', () => {
        it('should work normally', async () => {
            console.log(await rewardToken.balanceOf(core.hhUser1.address));
            await increaseToTimestamp((await underlyingToken.expiry()).toNumber());
            await underlyingToken.connect(core.hhUser1).redeemDueInterestAndRewards(core.hhUser1.address, true, true);
            // await vault.connect(core.hhUser1).redeemDueInterestAndRewards(true, true);
            console.log(await rewardToken.balanceOf(core.hhUser1.address));
            console.log(await rewardToken.balanceOf(underlyingToken.address));
        });

        it('should fail when not called by vault owner', async () => {
            await expectThrow(vault.connect(core.hhUser2).redeemDueInterestAndRewards(true, true),
                `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`
            );
        });
    });
});