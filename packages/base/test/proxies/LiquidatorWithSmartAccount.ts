import { BaseContract, ethers } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import {
  TestContractAccount,
  TestContractAccount__factory,
  TestPriceOracle,
  TestPriceOracleForAdmin__factory,
} from '../../src/types';
import {
  createContractWithAbi,
  depositIntoDolomiteMargin,
  withdrawFromDolomiteMargin,
} from '../../src/utils/dolomite-utils';
import { parseUsdc, parseUsdValue } from '../../src/utils/math-utils';
import { ADDRESS_ZERO, Network, ONE_ETH_BI, ZERO_BI } from '../../src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '../../src/utils/SignerWithAddressWithSafety';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../utils';
import { expectEvent, expectNotEvent, expectProtocolBalance } from '../utils/assertions';

import { CoreProtocolArbitrumOne } from '../utils/core-protocols/core-protocol-arbitrum-one';
import { CoreProtocolEthereum } from '../utils/core-protocols/core-protocol-ethereum';
import { CoreProtocolMantle } from '../utils/core-protocols/core-protocol-mantle';
import { disableInterestAccrual, setupCoreProtocol, setupUSDCBalance, setupWETHBalance } from '../utils/setup';

describe('LiquidatorWithSmartAccount', () => {
  let snapshotId: string;
  let core: CoreProtocolArbitrumOne | CoreProtocolEthereum | CoreProtocolMantle;
  let liquidAccount: SignerWithAddressWithSafety;
  let solidAccount: SignerWithAddressWithSafety;
  let oracle: TestPriceOracle;
  let contractAccount: TestContractAccount;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.Ethereum,
      blockNumber: 24_866_692,
    });
    // core = await setupCoreProtocol({
    //   network: Network.Mantle,
    //   blockNumber: 93_955_200,
    // });

    oracle = await createContractWithAbi(
      TestPriceOracleForAdmin__factory.abi,
      TestPriceOracleForAdmin__factory.bytecode,
      [core.dolomiteMargin.address],
    );
    contractAccount = await createContractWithAbi(
      TestContractAccount__factory.abi,
      TestContractAccount__factory.bytecode,
      [],
    );
    liquidAccount = await impersonate(contractAccount.address, true, ONE_ETH_BI.mul(100));
    solidAccount = core.hhUser1;

    await oracle.connect(core.governance).setPrice(core.tokens.weth.address, parseEther(`${2_000}`));
    await oracle
      .connect(core.governance)
      .setPrice(core.tokens.usdc.address, parseUsdValue(`${1}`).div(parseUsdc(`${1}`)));

    await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
      token: core.tokens.weth.address,
      decimals: 18,
      oracleInfos: [
        {
          oracle: oracle.address,
          weight: 100,
          tokenPair: ADDRESS_ZERO,
        },
      ],
    });
    await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
      token: core.tokens.usdc.address,
      decimals: 6,
      oracleInfos: [
        {
          oracle: oracle.address,
          weight: 100,
          tokenPair: ADDRESS_ZERO,
        },
      ],
    });

    await core.dolomiteMargin.ownerSetGlobalOperator(core.liquidatorProxyV1.address, true);

    await disableInterestAccrual(core, core.marketIds.weth);
    await disableInterestAccrual(core, core.marketIds.usdc);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('liquidator', () => {
    it('should work normally on Ethereum', async () => {
      if (core.network !== Network.Ethereum) {
        throw new Error('Invalid network!');
      }

      await core.dolomiteMargin.connect(core.governance).ownerSetCallbackGasLimit(0);

      const wethAmount = parseEther(`${1}`);
      const usdcAmount = parseUsdc(`${1_000}`);
      await setupWETHBalance(core, liquidAccount, wethAmount, core.dolomiteMargin);
      await setupUSDCBalance(core, solidAccount, usdcAmount, core.dolomiteMargin);

      await depositIntoDolomiteMargin(core, liquidAccount, 1, core.marketIds.weth, wethAmount);
      await depositIntoDolomiteMargin(core, solidAccount, 0, core.marketIds.usdc, usdcAmount);

      await withdrawFromDolomiteMargin(core, liquidAccount, 1, core.marketIds.usdc, parseUsdc(`${900}`));

      await oracle.connect(core.governance).setPrice(core.tokens.weth.address, parseEther(`${1_000}`));

      const result = await core.liquidatorProxyV1
        .connect(solidAccount)
        .liquidate(
          { owner: solidAccount.address, number: 0 },
          { owner: liquidAccount.address, number: 1 },
          { value: parseEther(`${0.15}`) },
          1,
          [core.marketIds.usdc],
          [core.marketIds.weth],
        );

      const iface = new ethers.utils.Interface([
        'event LogExternalCallbackFailure(address indexed primaryAccountOwner, uint256 primaryAccountNumber, string reason)',
      ]);
      const contract = new BaseContract(core.dolomiteMargin.address, iface, core.hhUser1);
      await expectNotEvent(contract, result, 'LogExternalCallbackFailure');

      await expectProtocolBalance(core, liquidAccount, 1, core.marketIds.usdc, ZERO_BI);
      await expectProtocolBalance(core, solidAccount, 0, core.marketIds.usdc, parseUsdc(`${100}`).add(1));
    });

    xit('should work normally on Mantle', async () => {
      if (core.network !== Network.Mantle) {
        throw new Error('Invalid network!');
      }

      await core.dolomiteMargin.connect(core.governance).ownerSetCallbackGasLimit(0);

      const wethAmount = parseEther(`${1}`);
      const usdcAmount = parseUsdc(`${1_000}`);
      await setupWETHBalance(core, liquidAccount, wethAmount, core.dolomiteMargin);
      await setupUSDCBalance(core, solidAccount, usdcAmount, core.dolomiteMargin);

      await depositIntoDolomiteMargin(core, liquidAccount, 1, core.marketIds.weth, wethAmount);
      await depositIntoDolomiteMargin(core, solidAccount, 0, core.marketIds.usdc, usdcAmount);

      await withdrawFromDolomiteMargin(core, liquidAccount, 1, core.marketIds.usdc, parseUsdc(`${900}`));

      await oracle.connect(core.governance).setPrice(core.tokens.weth.address, parseEther(`${1_000}`));

      const result = await core.liquidatorProxyV1
        .connect(solidAccount)
        .liquidate(
          { owner: solidAccount.address, number: 0 },
          { owner: liquidAccount.address, number: 1 },
          { value: parseEther(`${0.15}`) },
          1,
          [core.marketIds.usdc],
          [core.marketIds.weth],
        );

      const iface = new ethers.utils.Interface([
        'event LogExternalCallbackFailure(address indexed primaryAccountOwner, uint256 primaryAccountNumber, string reason)',
      ]);
      const contract = new BaseContract(core.dolomiteMargin.address, iface, core.hhUser1);
      await expectEvent(contract, result, 'LogExternalCallbackFailure', {
        primaryAccountOwner: liquidAccount.address,
        primaryAccountNumber: 1,
        reason: '',
      });

      await expectProtocolBalance(core, liquidAccount, 1, core.marketIds.usdc, ZERO_BI);
      await expectProtocolBalance(core, solidAccount, 0, core.marketIds.usdc, parseUsdc(`${100}`));
    });
  });
});
