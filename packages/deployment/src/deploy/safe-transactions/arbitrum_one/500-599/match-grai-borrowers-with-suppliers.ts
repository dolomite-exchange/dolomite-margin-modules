import { AccountInfo } from '@dolomite-exchange/zap-sdk';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { ONE_ETH_BI } from '../../../../../../base/src/utils/no-deps-constants';
import { CoreProtocolArbitrumOne } from '../../../../../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import GraiBorrowers from './grai-borrowers-sorted.json';
import GraiSuppliers from './grai-suppliers-sorted.json';

export default async function matchBorrowersWithSuppliers(core: CoreProtocolArbitrumOne): Promise<{
  borrowers: AccountInfo[];
  suppliers: AccountInfo[];
}> {
  const index = await core.dolomiteMargin.getMarketCurrentIndex(core.marketIds.grai);
  const borrowers = GraiBorrowers.map((b) => ({
    owner: b.marginAccount.id.split('-')[0],
    number: b.marginAccount.id.split('-')[1],
    valueWei: parseEther(b.valuePar).mul(index.borrow).div(ONE_ETH_BI),
  }));
  const suppliers = GraiSuppliers.map((b) => ({
    owner: b.marginAccount.id.split('-')[0],
    number: b.marginAccount.id.split('-')[1],
    valueWei: parseEther(b.valuePar).mul(index.supply).div(ONE_ETH_BI),
  }));

  let borrowerIndex = 0;
  let supplierIndex = 0;
  let borrowerValueRemaining: BigNumber | undefined = borrowers[borrowerIndex]?.['valueWei'];
  let supplierValueRemaining: BigNumber | undefined = suppliers[supplierIndex]?.['valueWei'];

  const matchings = [];
  while (borrowerIndex < borrowers.length && supplierIndex < suppliers.length) {
    if (!borrowerValueRemaining && !supplierValueRemaining) {
      borrowerValueRemaining = borrowers[++borrowerIndex]?.['valueWei'];
      supplierValueRemaining = suppliers[++supplierIndex]?.['valueWei'];
      continue;
    }

    if (!borrowerValueRemaining) {
      borrowerValueRemaining = borrowers[++borrowerIndex]?.['valueWei'];
      continue;
    }

    if (!supplierValueRemaining) {
      supplierValueRemaining = suppliers[++supplierIndex]?.['valueWei'];
      continue;
    }

    if (supplierValueRemaining.lt(borrowerValueRemaining)) {
      matchings.push({
        borrower: {
          owner: borrowers[borrowerIndex].owner,
          number: borrowers[borrowerIndex].number,
        },
        supplier: {
          owner: suppliers[supplierIndex].owner,
          number: suppliers[supplierIndex].number,
        },
      });
      borrowerValueRemaining = borrowerValueRemaining.sub(supplierValueRemaining);
      supplierValueRemaining = undefined;
    } else {
      matchings.push({
        borrower: {
          owner: borrowers[borrowerIndex].owner,
          number: borrowers[borrowerIndex].number,
        },
        supplier: {
          owner: suppliers[supplierIndex].owner,
          number: suppliers[supplierIndex].number,
        },
      });
      supplierValueRemaining = supplierValueRemaining.sub(borrowerValueRemaining);
      borrowerValueRemaining = undefined;
    }
  }

  // Remaining borrowers or suppliers without perfect match can be handled if needed
  return {
    borrowers: matchings.map((m) => m.borrower),
    suppliers: matchings.map((m) => m.supplier),
  };
}
