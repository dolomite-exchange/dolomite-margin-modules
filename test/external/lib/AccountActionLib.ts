import { ADDRESSES } from '@dolomite-exchange/dolomite-margin';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  GLPPriceOracleV1,
  GLPPriceOracleV1__factory,
  TestAccountActionLib,
  TestAccountActionLib__factory,
} from '../../../src/types';
import { GLP, GLP_MANAGER, GMX_VAULT, S_GLP } from '../../../src/utils/constants';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';
import { snapshot, revertToSnapshotAndCapture } from '../../utils';
import { setupCoreProtocol } from '../../utils/setup';

describe('AccountActionLib', () => {
  let snapshotId: string;

  let testLib: TestAccountActionLib;

  before(async () => {
    const core = await setupCoreProtocol({
      blockNumber: 53107700,
    });
    testLib = await createContractWithAbi<TestAccountActionLib>(
      TestAccountActionLib__factory.abi,
      TestAccountActionLib__factory.bytecode,
      [core.dolomiteMargin.address],
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#deposit', () => {
  });

  describe('#withdraw', () => {
  });

  describe('#transfer', () => {
  });

  describe('#encodeCallAction', () => {
  });

  describe('#encodeDepositAction', () => {
  });

  describe('#encodeExpirationAction', () => {
  });

  describe('#encodeExpiryLiquidateAction', () => {
  });

  describe('#encodeInternalTradeAction', () => {
  });

  describe('#encodeLiquidateAction', () => {
  });

  describe('#encodeExternalSellAction', () => {
  });

  describe('#encodeTransferAction', () => {
  });

  describe('#encodeWithdrawalAction', () => {
  });

  describe('#all', () => {
  });
});
