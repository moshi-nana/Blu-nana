export type TransactionType = 'income' | 'expense' | 'debt';
export type TransactionClassification = 'personal' | 'business';
export type DebtType = 'borrow' | 'lend';

export interface Transaction {
  id: string;
  title: string;
  amount: number;
  type: TransactionType;
  category: string;
  date: string;
  time: string; // HH:mm format
  classification: TransactionClassification;
  isDebt?: boolean;
  debtType?: DebtType;
  isSettled?: boolean;
}
