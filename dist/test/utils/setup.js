"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupTestMarket = exports.setupCoreProtocol = exports.getDefaultCoreProtocolConfig = exports.setupUserVaultProxy = exports.setupGMXBalance = exports.setupUSDCBalance = exports.setupWETHBalance = exports.disableInterestAccrual = void 0;
const BorrowPositionProxyV2Json = __importStar(require("@dolomite-margin/deployed-contracts/BorrowPositionProxyV2.json"));
const DepositWithdrawalProxyJson = __importStar(require("@dolomite-margin/deployed-contracts/DepositWithdrawalProxy.json"));
const DolomiteAmmFactoryJson = __importStar(require("@dolomite-margin/deployed-contracts/DolomiteAmmFactory.json"));
const DolomiteAmmRouterProxyJson = __importStar(require("@dolomite-margin/deployed-contracts/DolomiteAmmRouterProxy.json"));
const DolomiteMarginJson = __importStar(require("@dolomite-margin/deployed-contracts/DolomiteMargin.json"));
const ExpiryJson = __importStar(require("@dolomite-margin/deployed-contracts/Expiry.json"));
const IGenericTraderProxyV1Json = __importStar(require("@dolomite-margin/deployed-contracts/GenericTraderProxyV1.json"));
const LiquidatorAssetRegistryJson = __importStar(require("@dolomite-margin/deployed-contracts/LiquidatorAssetRegistry.json"));
const LiquidatorProxyV1Json = __importStar(require("@dolomite-margin/deployed-contracts/LiquidatorProxyV1.json"));
const LiquidatorProxyV1WithAmmJson = __importStar(require("@dolomite-margin/deployed-contracts/LiquidatorProxyV1WithAmm.json"));
const LiquidatorProxyV2WithExternalLiquidityJson = __importStar(require("@dolomite-margin/deployed-contracts/LiquidatorProxyV2WithExternalLiquidity.json"));
const LiquidatorProxyV3WithLiquidityTokenJson = __importStar(require("@dolomite-margin/deployed-contracts/LiquidatorProxyV3WithLiquidityToken.json"));
const LiquidatorProxyV4WithGenericTraderJson = __importStar(require("@dolomite-margin/deployed-contracts/LiquidatorProxyV4WithGenericTrader.json"));
const ethers_1 = require("ethers");
const hardhat_1 = require("hardhat");
const no_deps_constants_1 = require("src/utils/no-deps-constants");
const deployments_json_1 = __importDefault(require("../../scripts/deployments.json"));
const types_1 = require("../../src/types");
const constants_1 = require("../../src/utils/constants");
const dolomite_utils_1 = require("../../src/utils/dolomite-utils");
const index_1 = require("./index");
async function disableInterestAccrual(core, marketId) {
    return core.dolomiteMargin.ownerSetInterestSetter(marketId, core.alwaysZeroInterestSetter.address);
}
exports.disableInterestAccrual = disableInterestAccrual;
async function setupWETHBalance(core, signer, amount, spender) {
    await core.tokens.weth.connect(signer).deposit({ value: amount });
    await core.tokens.weth.connect(signer).approve(spender.address, hardhat_1.ethers.constants.MaxUint256);
}
exports.setupWETHBalance = setupWETHBalance;
async function setupUSDCBalance(core, signer, amount, spender) {
    const whaleAddress = '0x805ba50001779CeD4f59CfF63aea527D12B94829'; // Radiant USDC pool
    const whaleSigner = await (0, index_1.impersonate)(whaleAddress, true);
    await core.tokens.usdc.connect(whaleSigner).transfer(signer.address, amount);
    await core.tokens.usdc.connect(signer).approve(spender.address, hardhat_1.ethers.constants.MaxUint256);
}
exports.setupUSDCBalance = setupUSDCBalance;
async function setupGMXBalance(core, signer, amount, spender) {
    var _a, _b;
    const whaleAddress = '0x80a9ae39310abf666a87c743d6ebbd0e8c42158e'; // Uniswap V3 GMX/ETH pool
    const whaleSigner = await (0, index_1.impersonate)(whaleAddress, true);
    await ((_a = core.gmxEcosystem) === null || _a === void 0 ? void 0 : _a.gmx.connect(whaleSigner).transfer(signer.address, amount));
    await ((_b = core.gmxEcosystem) === null || _b === void 0 ? void 0 : _b.gmx.connect(signer).approve(spender.address, hardhat_1.ethers.constants.MaxUint256));
}
exports.setupGMXBalance = setupGMXBalance;
function setupUserVaultProxy(vault, factoryInterface, signer) {
    return new ethers_1.BaseContract(vault, factoryInterface.abi, signer);
}
exports.setupUserVaultProxy = setupUserVaultProxy;
function getDefaultCoreProtocolConfig(network) {
    return {
        network,
        blockNumber: no_deps_constants_1.NETWORK_TO_DEFAULT_BLOCK_NUMBER_MAP[network],
    };
}
exports.getDefaultCoreProtocolConfig = getDefaultCoreProtocolConfig;
async function setupCoreProtocol(config) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    if (hardhat_1.network.name === 'hardhat') {
        await (0, index_1.resetFork)(config.blockNumber, config.network);
    }
    else {
        console.log('Skipping forking...');
    }
    const DOLOMITE_MARGIN = new ethers_1.BaseContract(DolomiteMarginJson.networks[config.network].address, types_1.IDolomiteMargin__factory.createInterface());
    const [hhUser1, hhUser2, hhUser3, hhUser4, hhUser5] = await hardhat_1.ethers.getSigners();
    const governance = await (0, index_1.impersonateOrFallback)(await DOLOMITE_MARGIN.connect(hhUser1).owner(), true, hhUser1);
    const alwaysZeroInterestSetter = types_1.AlwaysZeroInterestSetter__factory.connect(constants_1.ALWAYS_ZERO_INTEREST_SETTER_MAP[config.network], governance);
    const borrowPositionProxyV2 = types_1.BorrowPositionProxyV2__factory.connect(BorrowPositionProxyV2Json.networks[config.network].address, governance);
    const depositWithdrawalProxy = types_1.IDepositWithdrawalProxy__factory.connect(DepositWithdrawalProxyJson.networks[config.network].address, governance);
    const dolomiteAmmFactory = types_1.IDolomiteAmmFactory__factory.connect(DolomiteAmmFactoryJson.networks[config.network].address, governance);
    const dolomiteAmmRouterProxy = types_1.IDolomiteAmmRouterProxy__factory.connect(DolomiteAmmRouterProxyJson.networks[config.network].address, governance);
    const dolomiteMargin = DOLOMITE_MARGIN.connect(governance);
    const dolomiteRegistry = types_1.DolomiteRegistryImplementation__factory.connect((_a = deployments_json_1.default.DolomiteRegistryProxy[config.network]) === null || _a === void 0 ? void 0 : _a.address, governance);
    const expiry = types_1.Expiry__factory.connect(ExpiryJson.networks[config.network].address, governance);
    const genericTraderProxy = getContractOpt((_b = IGenericTraderProxyV1Json.networks[config.network]) === null || _b === void 0 ? void 0 : _b.address, types_1.IGenericTraderProxyV1__factory.connect);
    const liquidatorAssetRegistry = types_1.LiquidatorAssetRegistry__factory.connect(LiquidatorAssetRegistryJson.networks[config.network].address, governance);
    const liquidatorProxyV1 = types_1.LiquidatorProxyV1__factory.connect(LiquidatorProxyV1Json.networks[config.network].address, governance);
    const liquidatorProxyV1WithAmm = types_1.LiquidatorProxyV1WithAmm__factory.connect(LiquidatorProxyV1WithAmmJson.networks[config.network].address, governance);
    const liquidatorProxyV2 = getContractOpt((_c = LiquidatorProxyV2WithExternalLiquidityJson.networks[config.network]) === null || _c === void 0 ? void 0 : _c.address, types_1.LiquidatorProxyV2WithExternalLiquidity__factory.connect);
    const liquidatorProxyV3 = getContractOpt((_d = LiquidatorProxyV3WithLiquidityTokenJson.networks[config.network]) === null || _d === void 0 ? void 0 : _d.address, types_1.LiquidatorProxyV3WithLiquidityToken__factory.connect);
    const liquidatorProxyV4 = getContract(LiquidatorProxyV4WithGenericTraderJson.networks[config.network].address, types_1.LiquidatorProxyV4WithGenericTrader__factory.connect);
    const paraswapTrader = getContractOpt((_e = deployments_json_1.default.ParaswapAggregatorTrader[config.network]) === null || _e === void 0 ? void 0 : _e.address, types_1.ParaswapAggregatorTrader__factory.connect);
    const { testInterestSetter, testPriceOracle } = await getTestContracts();
    const abraEcosystem = await createAbraEcosystem(config.network, hhUser1);
    const atlasEcosystem = await createAtlasEcosystem(config.network, hhUser1);
    const gmxEcosystem = await createGmxEcosystem(config.network, hhUser1);
    const jonesEcosystem = await createJonesEcosystem(config.network, hhUser1);
    const paraswapEcosystem = await createParaswapEcosystem(config.network);
    const pendleEcosystem = await createPendleEcosystem(config.network, hhUser1);
    const plutusEcosystem = await createPlutusEcosystem(config.network, hhUser1);
    const umamiEcosystem = await createUmamiEcosystem(config.network, hhUser1);
    return {
        abraEcosystem,
        alwaysZeroInterestSetter,
        atlasEcosystem,
        borrowPositionProxyV2,
        depositWithdrawalProxy,
        dolomiteAmmFactory,
        dolomiteAmmRouterProxy,
        dolomiteMargin,
        dolomiteRegistry,
        expiry,
        genericTraderProxy,
        gmxEcosystem,
        governance,
        jonesEcosystem,
        liquidatorAssetRegistry,
        liquidatorProxyV1,
        liquidatorProxyV1WithAmm,
        liquidatorProxyV2,
        liquidatorProxyV3,
        liquidatorProxyV4,
        hhUser1,
        hhUser2,
        hhUser3,
        hhUser4,
        hhUser5,
        paraswapEcosystem,
        paraswapTrader,
        pendleEcosystem,
        plutusEcosystem,
        testInterestSetter,
        testPriceOracle,
        umamiEcosystem,
        config: {
            blockNumber: config.blockNumber,
            network: config.network,
        },
        apiTokens: {
            usdc: {
                marketId: constants_1.USDC_MAP[config.network].marketId,
                symbol: 'USDC',
                name: 'USD Coin',
                decimals: 6,
                tokenAddress: constants_1.USDC_MAP[config.network].address,
            },
            weth: {
                marketId: constants_1.WETH_MAP[config.network].marketId,
                symbol: 'WETH',
                name: 'Wrapped Ether',
                decimals: 18,
                tokenAddress: constants_1.WETH_MAP[config.network].address,
            },
        },
        marketIds: {
            dai: (_f = constants_1.DAI_MAP[config.network]) === null || _f === void 0 ? void 0 : _f.marketId,
            dfsGlp: (_g = constants_1.DFS_GLP_MAP[config.network]) === null || _g === void 0 ? void 0 : _g.marketId,
            dplvGlp: (_h = constants_1.DPLV_GLP_MAP[config.network]) === null || _h === void 0 ? void 0 : _h.marketId,
            link: constants_1.LINK_MAP[config.network].marketId,
            magicGlp: (_j = constants_1.MAGIC_GLP_MAP[config.network]) === null || _j === void 0 ? void 0 : _j.marketId,
            usdc: constants_1.USDC_MAP[config.network].marketId,
            usdt: (_k = constants_1.USDT_MAP[config.network]) === null || _k === void 0 ? void 0 : _k.marketId,
            wbtc: constants_1.WBTC_MAP[config.network].marketId,
            weth: constants_1.WETH_MAP[config.network].marketId,
        },
        tokens: {
            dfsGlp: createIERC20Opt((_l = constants_1.DFS_GLP_MAP[config.network]) === null || _l === void 0 ? void 0 : _l.address, hhUser1),
            link: types_1.IERC20__factory.connect(constants_1.LINK_MAP[config.network].address, hhUser1),
            usdc: types_1.IERC20__factory.connect(constants_1.USDC_MAP[config.network].address, hhUser1),
            wbtc: types_1.IERC20__factory.connect(constants_1.WBTC_MAP[config.network].address, hhUser1),
            weth: types_1.IWETH__factory.connect(constants_1.WETH_MAP[config.network].address, hhUser1),
        },
    };
}
exports.setupCoreProtocol = setupCoreProtocol;
function createIERC20Opt(address, signerOrProvider) {
    if (!address) {
        return undefined;
    }
    return types_1.IERC20__factory.connect(address, signerOrProvider);
}
async function setupTestMarket(core, token, isClosing, priceOracle) {
    await core.dolomiteMargin.connect(core.governance).ownerAddMarket(token.address, (priceOracle !== null && priceOracle !== void 0 ? priceOracle : core.testPriceOracle).address, core.testInterestSetter.address, { value: 0 }, { value: 0 }, 0, isClosing, false);
}
exports.setupTestMarket = setupTestMarket;
async function getTestContracts() {
    let testInterestSetter;
    let testPriceOracle;
    if (hardhat_1.network.name === 'hardhat') {
        testInterestSetter = await (0, dolomite_utils_1.createContractWithAbi)(types_1.TestInterestSetter__factory.abi, types_1.TestInterestSetter__factory.bytecode, []);
        testPriceOracle = await (0, dolomite_utils_1.createContractWithAbi)(types_1.TestPriceOracle__factory.abi, types_1.TestPriceOracle__factory.bytecode, []);
    }
    else {
        testInterestSetter = null;
        testPriceOracle = null;
    }
    return { testInterestSetter, testPriceOracle };
}
async function createAbraEcosystem(network, signer) {
    var _a;
    if (!constants_1.MAGIC_GLP_MAP[network]) {
        return undefined;
    }
    return {
        magicGlp: getContract((_a = constants_1.MAGIC_GLP_MAP[network]) === null || _a === void 0 ? void 0 : _a.address, address => types_1.IERC4626__factory.connect(address, signer)),
    };
}
async function createAtlasEcosystem(network, signer) {
    if (!constants_1.ATLAS_SI_TOKEN_MAP[network]) {
        return undefined;
    }
    return {
        siToken: getContract(constants_1.ATLAS_SI_TOKEN_MAP[network], address => types_1.IERC20__factory.connect(address, signer)),
    };
}
async function createJonesEcosystem(network, signer) {
    if (!constants_1.JONES_ECOSYSTEM_GOVERNOR_MAP[network]) {
        return undefined;
    }
    const whitelist = getContract(constants_1.JONES_WHITELIST_CONTROLLER_MAP[network], address => types_1.IJonesWhitelistController__factory.connect(address, signer));
    return {
        admin: await (0, index_1.impersonateOrFallback)(constants_1.JONES_ECOSYSTEM_GOVERNOR_MAP[network], true, signer),
        glpAdapter: getContract(constants_1.JONES_GLP_ADAPTER_MAP[network], address => types_1.IJonesGLPAdapter__factory.connect(address, signer)),
        glpVaultRouter: getContract(constants_1.JONES_GLP_VAULT_ROUTER_MAP[network], address => types_1.IJonesGLPVaultRouter__factory.connect(address, signer)),
        usdcReceiptToken: getContract(constants_1.JONES_JUSDC_RECEIPT_TOKEN_MAP[network], address => types_1.IERC4626__factory.connect(address, signer)),
        jUSDC: getContract(constants_1.JONES_JUSDC_MAP[network], address => types_1.IERC4626__factory.connect(address, signer)),
        whitelistController: whitelist,
    };
}
async function createGmxEcosystem(network, signer) {
    var _a, _b, _c, _d;
    const esGmxDistributorAddress = constants_1.ES_GMX_DISTRIBUTOR_MAP[network];
    if (!esGmxDistributorAddress) {
        return undefined;
    }
    const esGmxDistributor = getContract(esGmxDistributorAddress, types_1.IEsGmxDistributor__factory.connect);
    const esGmxAdmin = await (0, index_1.impersonateOrFallback)(await esGmxDistributor.connect(signer).admin(), true, signer);
    return {
        esGmx: getContract(constants_1.ES_GMX_MAP[network], address => types_1.IERC20__factory.connect(address, signer)),
        esGmxDistributor: esGmxDistributor.connect(esGmxAdmin),
        fsGlp: getContract(constants_1.FS_GLP_MAP[network], address => types_1.IERC20__factory.connect(address, signer)),
        glp: getContract(constants_1.GLP_MAP[network], address => types_1.IERC20__factory.connect(address, signer)),
        glpManager: getContract(constants_1.GLP_MANAGER_MAP[network], address => types_1.IGLPManager__factory.connect(address, signer)),
        glpRewardsRouter: getContract(constants_1.GLP_REWARD_ROUTER_MAP[network], address => types_1.IGLPRewardsRouterV2__factory.connect(address, signer)),
        gmxRewardsRouter: getContract(constants_1.GMX_REWARD_ROUTER_MAP[network], address => types_1.IGmxRewardRouterV2__factory.connect(address, signer)),
        gmx: getContract(constants_1.GMX_MAP[network], address => types_1.IERC20__factory.connect(address, signer)),
        gmxVault: getContract(constants_1.GMX_VAULT_MAP[network], address => types_1.IGmxVault__factory.connect(address, signer)),
        sGlp: getContract(constants_1.S_GLP_MAP[network], address => types_1.IERC20__factory.connect(address, signer)),
        sGmx: getContract(constants_1.S_GMX_MAP[network], address => types_1.ISGMX__factory.connect(address, signer)),
        sbfGmx: getContract(constants_1.SBF_GMX_MAP[network], address => types_1.IERC20__factory.connect(address, signer)),
        vGlp: getContract(constants_1.V_GLP_MAP[network], address => types_1.IGmxVester__factory.connect(address, signer)),
        vGmx: getContract(constants_1.V_GMX_MAP[network], address => types_1.IGmxVester__factory.connect(address, signer)),
        live: {
            glpIsolationModeFactory: getContract((_a = deployments_json_1.default.GLPIsolationModeVaultFactory[network]) === null || _a === void 0 ? void 0 : _a.address, types_1.IGLPIsolationModeVaultFactoryOld__factory.connect),
            glpIsolationModeUnwrapperTraderV1: getContract((_b = deployments_json_1.default.GLPIsolationModeUnwrapperTraderV1[network]) === null || _b === void 0 ? void 0 : _b.address, types_1.GLPIsolationModeUnwrapperTraderV1__factory.connect),
            glpIsolationModeWrapperTraderV1: getContract((_c = deployments_json_1.default.GLPIsolationModeWrapperTraderV1[network]) === null || _c === void 0 ? void 0 : _c.address, types_1.GLPIsolationModeWrapperTraderV1__factory.connect),
            gmxRegistry: getContract((_d = deployments_json_1.default.GmxRegistryV1[network]) === null || _d === void 0 ? void 0 : _d.address, types_1.IGmxRegistryV1__factory.connect),
        },
    };
}
async function createParaswapEcosystem(network) {
    if (!constants_1.PARASWAP_AUGUSTUS_ROUTER_MAP[network]) {
        return undefined;
    }
    return {
        augustusRouter: constants_1.PARASWAP_AUGUSTUS_ROUTER_MAP[network],
        transferProxy: constants_1.PARASWAP_TRANSFER_PROXY_MAP[network],
    };
}
async function createPendleEcosystem(network, signer) {
    if (!constants_1.PENDLE_PT_GLP_2024_MARKET_MAP[network]) {
        return undefined;
    }
    return {
        pendleRouter: getContract(constants_1.PENDLE_ROUTER_MAP[network], address => types_1.IPendleRouter__factory.connect(address, signer)),
        ptGlpMarket: getContract(constants_1.PENDLE_PT_GLP_2024_MARKET_MAP[network], address => types_1.IPendlePtMarket__factory.connect(address, signer)),
        ptGlpToken: getContract(constants_1.PENDLE_PT_GLP_2024_TOKEN_MAP[network], address => types_1.IPendlePtToken__factory.connect(address, signer)),
        ptOracle: getContract(constants_1.PENDLE_PT_ORACLE_MAP[network], address => types_1.IPendlePtOracle__factory.connect(address, signer)),
        syGlpToken: getContract(constants_1.PENDLE_SY_GLP_2024_TOKEN_MAP[network], address => types_1.IPendleSyToken__factory.connect(address, signer)),
    };
}
async function createPlutusEcosystem(network, signer) {
    var _a, _b, _c, _d, _e, _f;
    if (!constants_1.PLV_GLP_MAP[network]) {
        return undefined;
    }
    const sGlpAddressForPlutus = '0x2F546AD4eDD93B956C8999Be404cdCAFde3E89AE';
    return {
        plvGlp: getContract(constants_1.PLV_GLP_MAP[network], address => types_1.IERC4626__factory.connect(address, signer)),
        plsToken: getContract(constants_1.PLS_TOKEN_MAP[network], address => types_1.IERC20__factory.connect(address, signer)),
        plvGlpFarm: getContract(constants_1.PLV_GLP_FARM_MAP[network], address => types_1.IPlutusVaultGLPFarm__factory.connect(address, signer)),
        plvGlpRouter: getContract(constants_1.PLV_GLP_ROUTER_MAP[network], address => types_1.IPlutusVaultGLPRouter__factory.connect(address, signer)),
        sGlp: getContract(sGlpAddressForPlutus, address => types_1.IERC20__factory.connect(address, signer)),
        live: {
            dolomiteWhitelistForGlpDepositor: getContract((_a = deployments_json_1.default.DolomiteWhitelistForGlpDepositorV2[network]) === null || _a === void 0 ? void 0 : _a.address, address => types_1.DolomiteCompatibleWhitelistForPlutusDAO__factory.connect(address, signer)),
            dolomiteWhitelistForPlutusChef: getContract((_b = deployments_json_1.default.DolomiteWhitelistForPlutusChef[network]) === null || _b === void 0 ? void 0 : _b.address, address => types_1.DolomiteCompatibleWhitelistForPlutusDAO__factory.connect(address, signer)),
            plutusVaultRegistry: getContract((_c = deployments_json_1.default.PlutusVaultRegistry[network]) === null || _c === void 0 ? void 0 : _c.address, types_1.PlutusVaultRegistry__factory.connect),
            plvGlpIsolationModeFactory: getContract((_d = deployments_json_1.default.PlutusVaultGLPIsolationModeVaultFactory[network]) === null || _d === void 0 ? void 0 : _d.address, types_1.IPlutusVaultGLPIsolationModeVaultFactory__factory.connect),
            plvGlpIsolationModeUnwrapperTraderV1: getContract((_e = deployments_json_1.default.PlutusVaultGLPIsolationModeUnwrapperTraderV1[network]) === null || _e === void 0 ? void 0 : _e.address, types_1.PlutusVaultGLPIsolationModeUnwrapperTraderV1__factory.connect),
            plvGlpIsolationModeWrapperTraderV1: getContract((_f = deployments_json_1.default.PlutusVaultGLPIsolationModeWrapperTraderV1[network]) === null || _f === void 0 ? void 0 : _f.address, types_1.PlutusVaultGLPIsolationModeWrapperTraderV1__factory.connect),
        },
    };
}
async function createUmamiEcosystem(network, signer) {
    if (!constants_1.PLV_GLP_MAP[network]) {
        return undefined;
    }
    return {
        glpLink: getContract(constants_1.UMAMI_LINK_VAULT_MAP[network], address => types_1.IUmamiAssetVault__factory.connect(address, signer)),
        glpUni: getContract(constants_1.UMAMI_UNI_VAULT_MAP[network], address => types_1.IUmamiAssetVault__factory.connect(address, signer)),
        glpUsdc: getContract(constants_1.UMAMI_USDC_VAULT_MAP[network], address => types_1.IUmamiAssetVault__factory.connect(address, signer)),
        glpWbtc: getContract(constants_1.UMAMI_WBTC_VAULT_MAP[network], address => types_1.IUmamiAssetVault__factory.connect(address, signer)),
        glpWeth: getContract(constants_1.UMAMI_WETH_VAULT_MAP[network], address => types_1.IUmamiAssetVault__factory.connect(address, signer)),
        storageViewer: getContract(constants_1.UMAMI_STORAGE_VIEWER_MAP[network], address => types_1.IUmamiAssetVaultStorageViewer__factory.connect(address, signer)),
        configurator: await (0, index_1.impersonate)(constants_1.UMAMI_CONFIGURATOR_MAP[network]),
    };
}
function getContract(address, connector) {
    return connector(address, undefined);
}
function getContractOpt(address, connector) {
    if (!address) {
        return undefined;
    }
    return connector(address, undefined);
}
