import { ADDRESSES } from '@dolomite-exchange/dolomite-margin';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import { 
    PendleYtGLP2024IsolationModeUnwrapperTraderV2,
    PendleGLPRegistry,
    PendleYtGLP2024IsolationModeVaultFactory,
    PendleYtGLPPriceOracle,
    TestPendlePtOracle,
    TestPendlePtOracle__factory
} from 'src/types';
import { createContractWithAbi } from 'src/utils/dolomite-utils';
import { Network } from 'src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot, increaseToTimestamp } from 'test/utils';
import { expectThrow } from 'test/utils/assertions';
import {
    createPendleGLPRegistry,
    createPendleYtGLP2024IsolationModeTokenVaultV1,
    createPendleYtGLP2024IsolationModeUnwrapperTraderV2,
    createPendleYtGLP2024IsolationModeVaultFactory,
    createPendleYtGLPPriceOracle
} from 'test/utils/ecosystem-token-utils/pendle';
import { CoreProtocol, setupCoreProtocol, setupTestMarket } from '../../utils/setup';

/**
 * This is the expected price at the following timestamp: 1689700000
 *
 * Keep in mind that Pendle's PT prices tick upward each second so YT prices tick downward
 */
const PT_GLP_PRICE = BigNumber.from('870767188326032931'); // $0.870767188326032931
const YT_GLP_PRICE = BigNumber.from('129232811673967069'); // $0.129232811673967069
const initialAllowableDebtMarketIds = [0, 1];
const initialAllowableCollateralMarketIds = [2, 3];

describe('PendleYtGLPPriceOracle', () => {
    let snapshotId: string;

    let core: CoreProtocol;
    let ytGlpOracle: PendleYtGLPPriceOracle;
    let pendleRegistry: PendleGLPRegistry;
    let factory: PendleYtGLP2024IsolationModeVaultFactory;
    let unwrapperTrader: PendleYtGLP2024IsolationModeUnwrapperTraderV2;
    let marketId: BigNumberish;

    before(async () => {
        core = await setupCoreProtocol({
            blockNumber: 112489707,
            network: Network.ArbitrumOne
        });

        pendleRegistry = await createPendleGLPRegistry(core);
        const userVaultImplementation = await createPendleYtGLP2024IsolationModeTokenVaultV1();
        factory = await createPendleYtGLP2024IsolationModeVaultFactory(
            pendleRegistry,
            initialAllowableDebtMarketIds,
            initialAllowableCollateralMarketIds,
            core,
            core.pendleEcosystem!.ytGlpToken,
            userVaultImplementation,
        );
        unwrapperTrader = await createPendleYtGLP2024IsolationModeUnwrapperTraderV2(core, factory, pendleRegistry);
        ytGlpOracle = await createPendleYtGLPPriceOracle(
            core,
            factory,
            pendleRegistry
        );
        marketId = await core.dolomiteMargin.getNumMarkets();
        await setupTestMarket(core, factory, true, ytGlpOracle);

        snapshotId = await snapshot();
    });

    beforeEach(async () => {
        snapshotId = await revertToSnapshotAndCapture(snapshotId);
    });

    describe('constructor', () => {
        it('should work normally', async () => {
            expect(await ytGlpOracle.DYT_GLP()).to.eq(factory.address);
            expect(await ytGlpOracle.REGISTRY()).to.eq(pendleRegistry.address);
            expect(await ytGlpOracle.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
            expect(await ytGlpOracle.DFS_GLP_MARKET_ID()).to.eq(core.marketIds.dfsGlp);
        });

        it('should fail when oracle is not ready yet', async () => {
            const testPtOracle = await createContractWithAbi<TestPendlePtOracle>(
                TestPendlePtOracle__factory.abi,
                TestPendlePtOracle__factory.bytecode,
                [],
            );
            await pendleRegistry.connect(core.governance).ownerSetPtOracle(testPtOracle.address);

            await testPtOracle.setOracleState(true, 0, false);
            await expectThrow(
                createPendleYtGLPPriceOracle(core, factory, pendleRegistry),
                'PendleYtGLPPriceOracle: Oracle not ready yet',
            );
            await testPtOracle.setOracleState(false, 0, false);
            await expectThrow(
                createPendleYtGLPPriceOracle(core, factory, pendleRegistry),
                'PendleYtGLPPriceOracle: Oracle not ready yet',
            );

            await testPtOracle.setOracleState(true, 0, true);
            await expectThrow(
                createPendleYtGLPPriceOracle(core, factory, pendleRegistry),
                'PendleYtGLPPriceOracle: Oracle not ready yet',
            );

            await testPtOracle.setOracleState(false, 0, true);
            await createPendleYtGLPPriceOracle(core, factory, pendleRegistry); // should work now
        });
    });

    describe('#getPrice', () => {
        it('returns the correct value under normal conditions for dytGLP', async () => {
            await increaseToTimestamp(1_689_700_000);
            const price = await ytGlpOracle.getPrice(factory.address);
            expect(price.value).to.eq(YT_GLP_PRICE);
        });

        it('fails when token sent is not dytGLP', async () => {
            await expectThrow(
                ytGlpOracle.getPrice(ADDRESSES.ZERO),
                `PendleYtGLPPriceOracle: invalid token <${ADDRESSES.ZERO}>`,
            );
            await expectThrow(
                ytGlpOracle.getPrice(core.gmxEcosystem!.fsGlp.address),
                `PendleYtGLPPriceOracle: invalid token <${core.gmxEcosystem!.fsGlp.address.toLowerCase()}>`,
            );
            await expectThrow(
                ytGlpOracle.getPrice(core.tokens.dfsGlp!.address),
                `PendleYtGLPPriceOracle: invalid token <${(core.tokens.dfsGlp!.address).toLowerCase()}>`,
            );
            await expectThrow(
                ytGlpOracle.getPrice(core.gmxEcosystem!.glp.address),
                `PendleYtGLPPriceOracle: invalid token <${core.gmxEcosystem!.glp.address.toLowerCase()}>`,
            );
        });

        it('fails when ytGLP is borrowable', async () => {
            await core.dolomiteMargin.ownerSetIsClosing(marketId, false);
            await expectThrow(
                ytGlpOracle.getPrice(factory.address),
                'PendleYtGLPPriceOracle: ytGLP cannot be borrowable',
            );
        });
    });
})