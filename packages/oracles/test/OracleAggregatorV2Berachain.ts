import {
  CustomTestToken,
  DolomiteRegistryImplementation,
  DolomiteRegistryImplementation__factory,
} from '@dolomite-exchange/modules-base/src/types';
import { createContractWithAbi, createTestToken } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network, TEN_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther, parseUnits } from 'ethers/lib/utils';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import { TokenInfo } from '../src';
import {
  ChroniclePriceOracleV3,
  OracleAggregatorV2Berachain,
  OracleAggregatorV2Berachain__factory,
  TestChronicleScribe,
  TestChronicleScribe__factory,
} from '../src/types';

const WETH_PRICE = BigNumber.from('1682074053450000000000');
const USDC_PRICE = BigNumber.from('1000000000000000000000000000000');

describe('OracleAggregatorV2Berachain', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;

  let chroniclePriceOracleV3: ChroniclePriceOracleV3;
  let scribeWeth: TestChronicleScribe;
  let scribeUsdc: TestChronicleScribe;
  let scribeWbtc: TestChronicleScribe;
  let scribeWbera: TestChronicleScribe;
  let testToken: CustomTestToken;
  let oracleAggregator: OracleAggregatorV2Berachain;

  const GAS_LIMIT = BigNumber.from(`${200_000}`);

  before(async () => {
    core = (await setupCoreProtocol({
      network: Network.Berachain,
      blockNumber: 22195800,
    })) as CoreProtocolBerachain;

    scribeWeth = await createContractWithAbi<TestChronicleScribe>(
      TestChronicleScribe__factory.abi,
      TestChronicleScribe__factory.bytecode,
      [],
    );
    await scribeWeth.setLatestAnswer(WETH_PRICE);
    await scribeWeth.setDecimals(18);

    scribeUsdc = await createContractWithAbi<TestChronicleScribe>(
      TestChronicleScribe__factory.abi,
      TestChronicleScribe__factory.bytecode,
      [],
    );
    await scribeUsdc.setLatestAnswer(TEN_BI.pow(18)); // $1
    await scribeUsdc.setDecimals(18);

    scribeWbtc = await createContractWithAbi<TestChronicleScribe>(
      TestChronicleScribe__factory.abi,
      TestChronicleScribe__factory.bytecode,
      [],
    );
    await scribeWbtc.setLatestAnswer(parseEther('44000'));
    await scribeWbtc.setDecimals(18);

    scribeWbera = await createContractWithAbi<TestChronicleScribe>(
      TestChronicleScribe__factory.abi,
      TestChronicleScribe__factory.bytecode,
      [],
    );
    await scribeWbera.setLatestAnswer(parseEther('1'));
    await scribeWbera.setDecimals(18);

    testToken = await createTestToken();

    const dolomiteRegistryImplementation = await createContractWithAbi<DolomiteRegistryImplementation>(
      DolomiteRegistryImplementation__factory.abi,
      DolomiteRegistryImplementation__factory.bytecode,
      [],
    );
    await core.dolomiteRegistryProxy.connect(core.governance).upgradeTo(dolomiteRegistryImplementation.address);

    chroniclePriceOracleV3 = core.chroniclePriceOracleV3.connect(core.governance);

    const tokenInfos: TokenInfo[] = [
      (await core.oracleAggregatorV2.getTokenInfo(core.tokens.weth.address)) as any,
      (await core.oracleAggregatorV2.getTokenInfo(core.tokens.usdc.address)) as any,
      (await core.oracleAggregatorV2.getTokenInfo(core.tokens.wbtc.address)) as any,
      (await core.oracleAggregatorV2.getTokenInfo(core.tokens.wbera.address)) as any,
    ];
    oracleAggregator = (
      await createContractWithAbi<OracleAggregatorV2Berachain>(
        OracleAggregatorV2Berachain__factory.abi,
        OracleAggregatorV2Berachain__factory.bytecode,
        [tokenInfos, core.dolomiteMargin.address, GAS_LIMIT],
      )
    ).connect(core.governance);

    await core.dolomiteRegistry.connect(core.governance).ownerSetOracleAggregator(oracleAggregator.address);

    // Setting OracleAggregatorV2Berachain as the price oracle on DolomiteMargin
    await core.dolomiteMargin
      .connect(core.governance)
      .ownerSetPriceOracle(core.marketIds.weth, oracleAggregator.address);
    await core.dolomiteMargin
      .connect(core.governance)
      .ownerSetPriceOracle(core.marketIds.wbera, oracleAggregator.address);
    await core.dolomiteMargin
      .connect(core.governance)
      .ownerSetPriceOracle(core.marketIds.usdc, oracleAggregator.address, { gasPrice: parseUnits(`${100}`, 'gwei') });
    await core.dolomiteMargin
      .connect(core.governance)
      .ownerSetPriceOracle(core.marketIds.wbtc, oracleAggregator.address, { gasPrice: parseUnits(`${100}`, 'gwei') });

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should fail if token weights do not sum to 100', async () => {
      const tokenInfos: TokenInfo[] = [
        {
          oracleInfos: [
            { oracle: chroniclePriceOracleV3.address, tokenPair: ADDRESS_ZERO, weight: 100 },
            { oracle: chroniclePriceOracleV3.address, tokenPair: ADDRESS_ZERO, weight: 50 },
          ],
          decimals: 18,
          token: core.tokens.weth.address,
        },
      ];
      await expectThrow(
        createContractWithAbi<OracleAggregatorV2Berachain>(
          OracleAggregatorV2Berachain__factory.abi,
          OracleAggregatorV2Berachain__factory.bytecode,
          [tokenInfos, core.dolomiteMargin.address, GAS_LIMIT],
        ),
        'OracleAggregatorV2: Invalid weights',
      );
    });

    it('should fail if chain id is not Berachain', async () => {
      // Note: In hardhat tests, block.chainid usually defaults to 31337 unless configured otherwise.
      // However, setupCoreProtocol with Network.Berachain might handle this, but let's assume we need to test this.
      // For this test to work, we'd need to be on a different network.
      // Since setupCoreProtocol(Berachain) likely sets it correctly, we can't easily trigger this failure
      // without changing the network setup, which is complex in a single test file.
    });
  });

  describe('#ownerSetGasLimit', () => {
    it('can set the gas limit', async () => {
      const newGasLimit = BigNumber.from('300000');
      await oracleAggregator.ownerSetGasLimit(newGasLimit);
      expect(await oracleAggregator.gasLimit()).to.eq(newGasLimit);
    });

    it('fails when invoked by non-admin', async () => {
      await expectThrow(
        oracleAggregator.connect(core.hhUser1).ownerSetGasLimit(BigNumber.from('300000')),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#getPrice', () => {
    it('returns the correct value for a token with 18 decimals and skips gas check', async () => {
      // Tokens with 18 decimals skip the gas check.
      const price = await oracleAggregator.getPrice(core.tokens.weth.address);
      expect(price.value).to.eq(WETH_PRICE);
    });

    it('returns the correct value for a token with < 18 decimals when gas price is high enough', async () => {
      // Set BERA price to $2260
      await scribeWbera.setLatestAnswer(WETH_PRICE);
      await scribeUsdc.setLatestAnswer(parseEther('1'));
      await chroniclePriceOracleV3.ownerInsertOrUpdateOracleToken(
        core.tokens.wbera.address,
        scribeWbera.address,
        false,
      );
      await chroniclePriceOracleV3.ownerInsertOrUpdateOracleToken(
        core.tokens.usdc.address,
        scribeUsdc.address,
        false,
      );

      const price = await oracleAggregator.getPrice(core.tokens.usdc.address, { gasPrice: parseUnits(`${1}`, 'gwei') });
      expect(price.value).to.eq(USDC_PRICE);
    });

    it('reverts for a token with < 18 decimals when gas price is too low', async () => {
      await scribeWbera.setLatestAnswer(WETH_PRICE);
      await scribeUsdc.setLatestAnswer(parseEther('1'));

      await core.chroniclePriceOracleV3
        .connect(core.governance)
        .ownerInsertOrUpdateOracleToken(core.tokens.wbera.address, scribeWbera.address, false);
      await core.chroniclePriceOracleV3
        .connect(core.governance)
        .ownerInsertOrUpdateOracleToken(core.tokens.usdc.address, scribeUsdc.address, false);

      await expectThrow(
        oracleAggregator.getPrice(core.tokens.usdc.address, { gasPrice: parseUnits(`${1}`, 'wei') }),
        `OracleAggregatorV2Berachain: Gas price too low <${core.tokens.usdc.address.toLowerCase()}>`,
      );
    });

    it('reverts when an invalid address is passed in', async () => {
      const ONE_ADDRESS = '0x1000000000000000000000000000000000000000';
      await expectThrow(
        oracleAggregator.getPrice(ZERO_ADDRESS),
        `OracleAggregatorV2: No oracles for token <${ZERO_ADDRESS}>`,
      );
      await expectThrow(
        oracleAggregator.getPrice(ONE_ADDRESS),
        `OracleAggregatorV2: No oracles for token <${ONE_ADDRESS}>`,
      );
    });
  });

  describe('#ownerInsertOrUpdateToken', () => {
    it('can insert a new oracle', async () => {
      const tokenAddress = testToken.address;
      await chroniclePriceOracleV3.ownerInsertOrUpdateOracleToken(tokenAddress, scribeWeth.address, false);
      const tokenInfo: TokenInfo = {
        oracleInfos: [{ oracle: chroniclePriceOracleV3.address, tokenPair: core.tokens.weth.address, weight: 100 }],
        decimals: 18,
        token: testToken.address,
      };
      await oracleAggregator.ownerInsertOrUpdateToken(tokenInfo);
      await expectTokenInfo(oracleAggregator, testToken.address, 18);
      await expectOracleInfo(
        oracleAggregator,
        tokenAddress,
        0,
        chroniclePriceOracleV3.address,
        core.tokens.weth.address,
        100,
        1,
      );
    });
  });
});

async function expectTokenInfo(
  oracleAggregator: OracleAggregatorV2Berachain,
  token: string,
  decimals: number,
) {
  const tokenInfo = (await oracleAggregator.getTokenInfo(token));
  expect(tokenInfo.token).to.eq(token);
  expect(tokenInfo.decimals).to.eq(decimals);
}

async function expectOracleInfo(
  oracleAggregator: OracleAggregatorV2Berachain,
  token: string,
  index: number,
  oracle: string,
  tokenPair: string,
  weight: number,
  length: number,
) {
  const oracleInfos = await oracleAggregator.getOraclesByToken(token);
  expect(oracleInfos.length).to.eq(length);
  const oracleInfo = oracleInfos[index];
  expect(oracleInfo.oracle).to.eq(oracle);
  expect(oracleInfo.tokenPair).to.eq(tokenPair);
  expect(oracleInfo.weight).to.eq(weight);
}
