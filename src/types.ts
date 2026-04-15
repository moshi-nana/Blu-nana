export type TransactionType = 'income' | 'expense';
export type TransactionClassification = 'personal' | 'business';

export interface Transaction {
  id: string;
  title: string;
  amount: number;
  type: TransactionType;
  category: string;
  date: string;
  time: string; // HH:mm format
  classification: TransactionClassification;
}
