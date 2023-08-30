import { expect } from 'chai';
import { GmxRegistryV2, GmxV2IsolationModeTokenVaultV1, GmxV2IsolationModeVaultFactory, IERC20 } from "src/types";
import { Network } from "src/utils/no-deps-constants";
import { revertToSnapshotAndCapture, snapshot } from "test/utils";
import { expectArrayEq, expectEvent, expectThrow } from 'test/utils/assertions';
import { createGmxRegistryV2, createGmxV2IsolationModeTokenVaultV1, createGmxV2IsolationModeVaultFactory } from "test/utils/ecosystem-token-utils/gmx";
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol } from "test/utils/setup";

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
const initialAllowableDebtMarketIds = [];
const initialAllowableCollateralMarketIds = [];

describe('GmxV2IsolationModeVaultFactory', () => {
    let snapshotId: string;

    let core: CoreProtocol;
    let gmxRegistryV2: GmxRegistryV2;
    let vaultImplementation: GmxV2IsolationModeTokenVaultV1;
    let factory: GmxV2IsolationModeVaultFactory;

    before(async () => {
        core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
        gmxRegistryV2 = await createGmxRegistryV2(core);
        vaultImplementation = await createGmxV2IsolationModeTokenVaultV1();
        factory = await createGmxV2IsolationModeVaultFactory(
            core,
            gmxRegistryV2,
            [], // initialAllowableDebtMarketIds
            [], // initialAllowableCollateralMarketIds
            core.gmxEcosystem!.gmxEthUsdMarketToken,
            vaultImplementation
        );

        snapshotId = await snapshot();
    });

    beforeEach(async () => {
        snapshotId = await revertToSnapshotAndCapture(snapshotId);
    })

    describe('#constructor', () => {
        it('should initialize variables properly', async () => {
            expect(await factory.gmxRegistryV2()).to.equal(gmxRegistryV2.address);
            expect(await factory.initialShortToken()).to.equal(core.tokens.usdc.address);
            expect(await factory.initialShortTokenMarketId()).to.equal(core.marketIds.usdc);
            expect(await factory.initialLongToken()).to.equal(core.tokens.weth.address);
            expect(await factory.initialLongTokenMarketId()).to.equal(core.marketIds.weth);
            expectArrayEq(await factory.allowableDebtMarketIds(), []);
            expectArrayEq(await factory.allowableCollateralMarketIds(), []);
            expect(await factory.UNDERLYING_TOKEN()).to.equal(core.gmxEcosystem!.gmxEthUsdMarketToken.address);
            expect(await factory.BORROW_POSITION_PROXY()).to.equal(core.borrowPositionProxyV2.address);
            expect(await factory.userVaultImplementation()).to.equal(vaultImplementation.address);
            expect(await factory.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
        });
    });

    describe('#ownerSetGmxRegistryV2', () => {
        it('should work normally', async () => {
            const result = await factory.connect(core.governance).ownerSetGmxRegistryV2(OTHER_ADDRESS);
            await expectEvent(factory, result, 'GmxRegistryV2Set', {
                gmxRegistryV2: OTHER_ADDRESS
            });
            expect(await factory.gmxRegistryV2()).to.eq(OTHER_ADDRESS);
        });

        it('should fail when not called by owner', async () => {
            await expectThrow(
                factory.connect(core.hhUser1).ownerSetGmxRegistryV2(OTHER_ADDRESS),
                `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
            );
        });
    });
});