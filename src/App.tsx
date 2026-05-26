import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Wallet, 
  History, 
  Settings, 
  Search,
  Bell,
  ChevronRight,
  TrendingUp,
  CreditCard,
  X,
  Camera,
  RotateCcw,
  Check,
  Loader2,
  ScanLine,
  Trash2,
  AlertCircle,
  Edit2,
  Utensils,
  ShoppingBag,
  Fuel,
  Wrench,
  Play,
  LayoutGrid,
  Download,
  Upload,
  Sparkles,
  Bot
} from 'lucide-react';
import { format, parseISO, isSameMonth, startOfMonth, endOfMonth, eachDayOfInterval, subMonths, addMonths, isBefore } from 'date-fns';
import { id } from 'date-fns/locale';
import { 
  BarChart, 
  Bar, 
  LineChart,
  Line,
  AreaChart,
  Area,
  ComposedChart,
  PieChart,
  Pie,
  Cell,
  Sector,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Transaction, TransactionType, DebtType } from './types';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { db, auth, googleProvider, handleFirestoreError, OperationType } from './firebase';
import { collection, onSnapshot, getDocs, doc, setDoc, deleteDoc, query, where, updateDoc, serverTimestamp, getDoc, writeBatch } from 'firebase/firestore';
import { signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const INITIAL_TRANSACTIONS: Transaction[] = [
  { id: '1', title: 'Gaji Bulanan', amount: 15000000, type: 'income', category: 'Salary', date: '2026-03-25', time: '09:00', classification: 'personal' },
  { id: '2', title: 'Makan Siang', amount: 50000, type: 'expense', category: 'Food', date: '2026-03-26', time: '12:30', classification: 'personal' },
  { id: '3', title: 'Netflix', amount: 186000, type: 'expense', category: 'Entertainment', date: '2026-03-27', time: '20:00', classification: 'personal' },
  { id: '4', title: 'Bonus Project', amount: 2500000, type: 'income', category: 'Bonus', date: '2026-03-28', time: '14:15', classification: 'business' },
  { id: '5', title: 'Belanja Bulanan', amount: 1200000, type: 'expense', category: 'Shopping', date: '2026-03-29', time: '10:00', classification: 'personal' },
  { id: '6', title: 'Kopi Sore', amount: 35000, type: 'expense', category: 'Food', date: '2026-03-30', time: '16:45', classification: 'personal' },
];

interface TransactionItemProps {
  transaction: Transaction;
  onDelete: () => void;
  onEdit: () => void;
  onToggleSettled: () => void;
  formatCurrency: (amount: number) => string;
  isRevealed: boolean;
  onReveal: (isRevealed: boolean) => void;
}

const TransactionItem = React.memo<TransactionItemProps>(({ 
  transaction: t, 
  onDelete, 
  onEdit,
  onToggleSettled,
  formatCurrency,
  isRevealed,
  onReveal
}) => {
  const handleDragEnd = (_: any, info: any) => {
    // Threshold for revealing
    const threshold = t.isDebt ? -240 : -160;
    if (info.offset.x < threshold / 2) {
      onReveal(true);
    } else if (info.offset.x > 40) {
      onReveal(false);
    } else {
      onReveal(isRevealed);
    }
  };

  const getDebtLabel = () => {
    if (t.debtType === 'borrow') return 'Piutang (Pinjam)';
    if (t.debtType === 'lend') return 'Utang (Meminjami)';
    return 'Hutang';
  };

  return (
    <div className="relative mb-3 rounded-2xl overflow-hidden isolate shadow-sm border border-gray-100">
      {/* Background Layer - Actions */}
      <div className="absolute inset-[5px] bg-gray-100 flex justify-end items-center rounded-[11px] overflow-hidden">
        <div className="flex h-full">
          {t.isDebt && (
            <div 
              className={cn(
                "w-[80px] h-full flex flex-col items-center justify-center transition-colors cursor-pointer",
                t.isSettled ? "bg-orange-500 text-white" : "bg-green-600 text-white"
              )}
              onClick={(e) => {
                e.stopPropagation();
                onToggleSettled();
                onReveal(false);
              }}
            >
              <RotateCcw size={18} />
              <span className="text-[8px] font-bold uppercase mt-1">{t.isSettled ? 'Belum' : 'Lunas'}</span>
            </div>
          )}
          <div 
            className="w-[80px] h-full flex flex-col items-center justify-center bg-blu-primary text-white active:bg-blu-dark transition-colors cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
              onReveal(false);
            }}
          >
            <Edit2 size={18} />
            <span className="text-[8px] font-bold uppercase mt-1">Edit</span>
          </div>
          <div 
            className="w-[80px] h-full flex flex-col items-center justify-center bg-red-600 text-white active:bg-red-700 transition-colors cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
              onReveal(false);
            }}
          >
            <Trash2 size={18} />
            <span className="text-[8px] font-bold uppercase mt-1">Hapus</span>
          </div>
        </div>
      </div>

      {/* Foreground Content */}
      <motion.div 
        drag="x"
        dragConstraints={{ left: t.isDebt ? -240 : -160, right: 0 }}
        dragElastic={0.15}
        whileTap={{ cursor: 'grabbing' }}
        dragTransition={{ bounceStiffness: 500, bounceDamping: 35 }}
        animate={{ x: isRevealed ? (t.isDebt ? -240 : -160) : 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 40, mass: 0.6 }}
        onDragStart={() => {
          if (!isRevealed) {
            onReveal(false);
          }
        }}
        onDragEnd={handleDragEnd}
        onClick={() => {
          if (isRevealed) onReveal(false);
        }}
        className={cn(
          "p-4 flex items-center justify-between bg-white relative z-10 cursor-grab active:cursor-grabbing",
          isRevealed ? "shadow-inner" : "",
          t.isSettled && "opacity-60"
        )}
      >
        <div className="flex items-center gap-4">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center",
            t.type === 'income' ? "bg-green-100 text-green-600" : 
            t.type === 'expense' ? "bg-red-100 text-red-600" :
            "bg-orange-100 text-orange-600"
          )}>
            {t.type === 'income' ? <ArrowDownLeft size={20} /> : 
             t.type === 'expense' ? <ArrowUpRight size={20} /> :
             <CreditCard size={20} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className={cn(
                "font-semibold text-sm text-gray-800",
                t.isSettled && "line-through"
              )}>{t.title}</p>
              {t.type === 'debt' && (
                <span className={cn(
                  "text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-tighter",
                  t.isSettled ? "bg-gray-200 text-gray-500" : "bg-orange-100 text-orange-600"
                )}>
                  {t.isSettled ? 'Lunas' : getDebtLabel()}
                </span>
              )}
              <span className={cn(
                "text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-tighter",
                t.classification === 'business' ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600"
              )}>
                {t.classification === 'business' ? 'Bisnis' : 'Pribadi'}
              </span>
            </div>
            <p className="text-xs text-gray-400">{t.category} • {format(parseISO(t.date), 'dd MMM')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <p className={cn(
            "font-bold text-sm",
            t.isSettled ? "text-gray-400" : 
            t.type === 'income' ? "text-green-600" : 
            t.type === 'expense' ? "text-red-600" :
            "text-orange-600"
          )}>
            {t.isSettled ? '' : (t.type === 'income' ? '+' : t.type === 'expense' ? '-' : '')}{formatCurrency(t.amount)}
          </p>
        </div>
      </motion.div>
    </div>
  );
});

export default function App() {
  // Register Service Worker for PWA
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(registration => {
          console.log('SW registered: ', registration);
        }).catch(registrationError => {
          console.log('SW registration failed: ', registrationError);
        });
      });
    }
  }, []);

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('blutracker_transactions');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    const hasVisited = localStorage.getItem('blutracker_visited');
    if (!hasVisited) {
      localStorage.setItem('blutracker_visited', 'true');
      return INITIAL_TRANSACTIONS;
    }
    return [];
  });

  useEffect(() => {
    if (authReady && !user) {
      localStorage.setItem('blutracker_transactions', JSON.stringify(transactions));
    }
  }, [transactions, user, authReady]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      
      // Update User Doc
      if (currentUser) {
        const localSaved = localStorage.getItem('blutracker_transactions');
        if (localSaved) {
            try {
                const localTransactions: Transaction[] = JSON.parse(localSaved);
                const unsynced = localTransactions.filter(t => t.id.length < 10 && !t.id.includes('-'));
                if (unsynced.length > 0) {
                   const batch = writeBatch(db);
                   unsynced.forEach(t => {
                     const newRef = doc(collection(db, `users/${currentUser.uid}/transactions`));
                     const { id, ...data } = t;
                     const dataToSave: any = {
                        ...data,
                        ownerId: currentUser.uid,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                        isDebt: t.type === 'debt' ? true : false,
                     };
                     if (t.type === 'debt') {
                         dataToSave.isSettled = t.isSettled || false;
                         dataToSave.debtType = t.debtType || 'borrow';
                     }
                     batch.set(newRef, dataToSave);
                   });
                   batch.commit().then(() => {
                        console.log("Local transactions synced to Cloud.");
                        localStorage.removeItem('blutracker_transactions');
                   }).catch(e => console.error("Sync error", e));
                } else {
                    localStorage.removeItem('blutracker_transactions');
                }
            } catch (e) {
                console.error("Local sync parsing error", e);
            }
        }

        const userDocRef = doc(db, 'users', currentUser.uid);
        getDoc(userDocRef).then((uDoc) => {
          if (!uDoc.exists()) {
            setDoc(userDocRef, {
              email: currentUser.email,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            }).catch(error => {
              handleFirestoreError(error, OperationType.WRITE, `users/${currentUser.uid}`);
            });
          } else {
            setDoc(userDocRef, {
              updatedAt: serverTimestamp()
            }, { merge: true }).catch(error => {
              handleFirestoreError(error, OperationType.WRITE, `users/${currentUser.uid}`);
            });
          }
        }).catch(error => {
          handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
        });
      } else {
        const saved = localStorage.getItem('blutracker_transactions');
        if (saved) {
          try {
            setTransactions(JSON.parse(saved));
          } catch (e) {
            setTransactions([]);
          }
        } else {
          setTransactions([]);
        }
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;
    
    // Test connection first
    getDocs(collection(db, `users/${user.uid}/transactions`)).catch(error => {
      if(error instanceof Error && error.message.includes('the client is offline')) {
        console.error("Please check your Firebase configuration.");
      }
    });

    const q = collection(db, `users/${user.uid}/transactions`);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fbTransactions = snapshot.docs.map(doc => {
        const data = doc.data();
        let finalTx: Transaction = {
          id: doc.id,
          title: data.title,
          amount: data.amount,
          type: data.type,
          category: data.category,
          date: data.date,
          time: data.time,
          classification: data.classification,
          ownerId: data.ownerId,
        };
        if (data.isDebt !== undefined) finalTx.isDebt = data.isDebt;
        if (data.debtType !== undefined) finalTx.debtType = data.debtType;
        if (data.isSettled !== undefined) finalTx.isSettled = data.isSettled;
        return finalTx;
      });
      // Fallback initially if none exists? No, user starts fresh
      setTransactions(fbTransactions);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}/transactions`);
    });

    return unsubscribe;
  }, [user]);

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
      if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
        // Silently ignore user cancellation
        return;
      }
      console.error("Login gagal:", e);
      alert("Gagal masuk dengan Google. Silakan coba lagi.");
    }
  };

  const logout = async () => {
    try {
      await auth.signOut();
    } catch (e) {
      console.error(e);
    }
  };


  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'debt'>('home');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isStatsDetailOpen, setIsStatsDetailOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [statsView, setStatsView] = useState<'weekly' | 'daily'>('weekly');
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<{ message: string, type: 'success' | 'error' | 'confirm', onConfirm?: () => void } | null>(null);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<string | null>(null);

  const [isAiAnalysisModalOpen, setIsAiAnalysisModalOpen] = useState(false);
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);

  // Form State
  const [newTitle, setNewTitle] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newType, setNewType] = useState<TransactionType>('expense');
  const [newCategory, setNewCategory] = useState('General');
  const [newClassification, setNewClassification] = useState<'personal' | 'business'>('personal');
  const [newDebtType, setNewDebtType] = useState<DebtType>('borrow');
  const [newIsSettled, setNewIsSettled] = useState(false);

  // Filter & Sort State
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'category'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterClassification, setFilterClassification] = useState<'all' | 'personal' | 'business'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSuggesting, setIsSuggesting] = useState(false);

  // Handle PWA Shortcuts
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    if (action === 'scan') {
      setIsScannerOpen(true);
    } else if (action === 'add') {
      setNewTime(format(new Date(), 'HH:mm'));
      setIsModalOpen(true);
    }
    // Clean up URL without refreshing
    if (action) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const [historySubTab, setHistorySubTab] = useState<'all' | 'debt'>('all');
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());

  const handlePrevMonth = () => {
    setSelectedMonth(prev => subMonths(prev, 1));
    setStatsView('weekly');
  };
  const handleNextMonth = () => setSelectedMonth(prev => addMonths(prev, 1));
  const isCurrentMonth = isSameMonth(selectedMonth, new Date());

  // Local Keyword Rules for Instant Categorization
  const LOCAL_RULES: Record<string, { category: string, classification: 'personal' | 'business' }> = {
    'bensin': { category: 'Bensin', classification: 'personal' },
    'pertamax': { category: 'Bensin', classification: 'personal' },
    'pertalite': { category: 'Bensin', classification: 'personal' },
    'shell': { category: 'Bensin', classification: 'personal' },
    'bp': { category: 'Bensin', classification: 'personal' },
    'v-power': { category: 'Bensin', classification: 'personal' },
    'servis': { category: 'Perbaikan', classification: 'personal' },
    'oli': { category: 'Perbaikan', classification: 'personal' },
    'bengkel': { category: 'Perbaikan', classification: 'personal' },
    'perbaikan': { category: 'Perbaikan', classification: 'personal' },
    'ban': { category: 'Perbaikan', classification: 'personal' },
    'cuci': { category: 'Perbaikan', classification: 'personal' },
    'makan': { category: 'Food', classification: 'personal' },
    'nasi': { category: 'Food', classification: 'personal' },
    'bakso': { category: 'Food', classification: 'personal' },
    'soto': { category: 'Food', classification: 'personal' },
    'kopi': { category: 'Food', classification: 'personal' },
    'teabreak': { category: 'Food', classification: 'personal' },
    'esteh': { category: 'Food', classification: 'personal' },
    'gaji': { category: 'Salary', classification: 'personal' },
    'salary': { category: 'Salary', classification: 'personal' },
    'netflix': { category: 'Entertainment', classification: 'personal' },
    'spotify': { category: 'Entertainment', classification: 'personal' },
    'bioskop': { category: 'Entertainment', classification: 'personal' },
    'belanja': { category: 'Shopping', classification: 'personal' },
    'indomaret': { category: 'Shopping', classification: 'personal' },
    'alfamart': { category: 'Shopping', classification: 'personal' },
    'shopee': { category: 'Shopping', classification: 'personal' },
    'tokopedia': { category: 'Shopping', classification: 'personal' },
    'bonus': { category: 'Bonus', classification: 'business' },
    'project': { category: 'Bonus', classification: 'business' },
    'klien': { category: 'Bonus', classification: 'business' },
    'parkir': { category: 'Bensin', classification: 'personal' },
    'gojek': { category: 'General', classification: 'personal' },
    'grab': { category: 'General', classification: 'personal' },
  };

  // Reset revealedId when tab changes
  useEffect(() => {
    setRevealedId(null);
  }, [activeTab]);

  const handleReveal = useCallback((id: string, isRevealed: boolean) => {
    setRevealedId(isRevealed ? id : null);
  }, []);

  const CATEGORY_CONFIG: Record<string, { color: string, icon: any }> = {
    'Food': { color: '#FF6B6B', icon: Utensils },
    'Shopping': { color: '#4ECDC4', icon: ShoppingBag },
    'Bensin': { color: '#FFD93D', icon: Fuel },
    'Perbaikan': { color: '#A29BFE', icon: Wrench },
    'Entertainment': { color: '#6C5CE7', icon: Play },
    'General': { color: '#95afc0', icon: LayoutGrid },
  };

  const categoryPieData = useMemo(() => {
    const categories = ['Food', 'Shopping', 'Bensin', 'Perbaikan', 'Entertainment', 'General'];
    return categories.map(cat => {
      const amount = transactions
        .filter(t => t.type === 'expense' && t.category === cat && isSameMonth(parseISO(t.date), selectedMonth))
        .reduce((acc, t) => acc + t.amount, 0);
      return { name: cat, value: amount };
    }).filter(item => item.value > 0);
  }, [transactions]);

  const totalBalance = useMemo(() => {
    return transactions.reduce((acc, t) => {
      if (t.type === 'income') return acc + t.amount;
      if (t.type === 'expense') return acc - t.amount;
      if (t.type === 'debt') {
        if (t.isSettled) return acc; // Settled debts don't affect current balance in this simple model (assuming payment was a separate transaction or just cleared)
        // Actually, if I borrow and it's NOT settled, I have the cash.
        // If it IS settled, I paid it back, so the cash is gone.
        return t.debtType === 'borrow' ? acc + t.amount : acc - t.amount;
      }
      return acc;
    }, 0);
  }, [transactions]);

  const debtStats = useMemo(() => {
    const activeDebts = transactions.filter(t => t.type === 'debt' && !t.isSettled);
    const borrow = activeDebts.filter(t => t.debtType === 'borrow').reduce((acc, t) => acc + t.amount, 0);
    const lend = activeDebts.filter(t => t.debtType === 'lend').reduce((acc, t) => acc + t.amount, 0);
    return { borrow, lend };
  }, [transactions]);

  const monthlyIncome = useMemo(() => 
    transactions
      .filter(t => t.type === 'income' && isSameMonth(parseISO(t.date), selectedMonth))
      .reduce((acc, t) => acc + t.amount, 0)
  , [transactions, selectedMonth]);

  const monthlyExpense = useMemo(() => 
    transactions
      .filter(t => t.type === 'expense' && isSameMonth(parseISO(t.date), selectedMonth))
      .reduce((acc, t) => acc + t.amount, 0)
  , [transactions, selectedMonth]);

  const startBalance = useMemo(() => {
    const start = startOfMonth(selectedMonth);
    return transactions
      .filter(t => parseISO(t.date) < start)
      .reduce((acc, t) => {
        if (t.type === 'income') return acc + t.amount;
        if (t.type === 'expense') return acc - t.amount;
        if (t.type === 'debt') {
          if (t.isSettled) return acc;
          return t.debtType === 'borrow' ? acc + t.amount : acc - t.amount;
        }
        return acc;
      }, 0);
  }, [transactions, selectedMonth]);

  const endBalance = useMemo(() => {
    return startBalance + transactions.filter(t => t.type === 'income' && isSameMonth(parseISO(t.date), selectedMonth)).reduce((a,b) => a+b.amount, 0) - transactions.filter(t => t.type === 'expense' && isSameMonth(parseISO(t.date), selectedMonth)).reduce((a,b) => a+b.amount, 0) + transactions.filter(t => t.type === 'debt' && isSameMonth(parseISO(t.date), selectedMonth) && !t.isSettled).reduce((acc, t) => t.debtType === 'borrow' ? acc + t.amount : acc - t.amount, 0);
  }, [startBalance, transactions, selectedMonth]);

  const totalBalanceToDisplay = isCurrentMonth ? totalBalance : endBalance;

  const chartData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return format(d, 'yyyy-MM-dd');
    });

    return last7Days.map(date => {
      const dayIncome = transactions
        .filter(t => t.type === 'income' && t.date === date)
        .reduce((acc, t) => acc + t.amount, 0);
      const dayExpense = transactions
        .filter(t => t.type === 'expense' && t.date === date)
        .reduce((acc, t) => acc + t.amount, 0);
      
      return {
        name: format(parseISO(date), 'EEE'),
        income: dayIncome,
        expense: dayExpense,
      };
    });
  }, [transactions]);

  const monthlyChartData = useMemo(() => {
    const start = startOfMonth(selectedMonth);
    const end = isCurrentMonth ? new Date() : endOfMonth(selectedMonth);
    const days = eachDayOfInterval({ start, end });

    // Calculate balance before this month started
    const balanceBeforeMonth = transactions
      .filter(t => new Date(t.date) < start)
      .reduce((acc, t) => t.type === 'income' ? acc + t.amount : acc - t.amount, 0);

    let runningBalance = balanceBeforeMonth;

    return days.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayIncome = transactions
        .filter(t => t.type === 'income' && t.date === dateStr)
        .reduce((acc, t) => acc + t.amount, 0);
      const dayExpense = transactions
        .filter(t => t.type === 'expense' && t.date === dateStr)
        .reduce((acc, t) => acc + t.amount, 0);
      
      runningBalance += (dayIncome - dayExpense);
      
      return {
        name: format(day, 'd'),
        balance: runningBalance,
        income: dayIncome,
        expense: dayExpense,
      };
    });
  }, [transactions]);

  const categoryChartData = useMemo(() => {
    if (!selectedCategory) return [];
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return format(d, 'yyyy-MM-dd');
    });

    return last7Days.map(date => {
      const dayExpense = transactions
        .filter(t => t.type === 'expense' && t.category === selectedCategory && t.date === date)
        .reduce((acc, t) => acc + t.amount, 0);
      
      return {
        name: format(parseISO(date), 'EEE'),
        amount: dayExpense,
      };
    });
  }, [transactions, selectedCategory]);

  const hourlyData = useMemo(() => {
    // Generate 24 hours
    const hours = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);
    const today = format(new Date(), 'yyyy-MM-dd');
    
    return hours.map(hour => {
      const hourInt = parseInt(hour.split(':')[0]);
      const amount = transactions
        .filter(t => {
          if (t.type !== 'expense' || !t.time || t.date !== today) return false;
          if (selectedCategory && t.category !== selectedCategory) return false;
          const tHour = parseInt(t.time.split(':')[0]);
          return tHour === hourInt;
        })
        .reduce((acc, t) => acc + t.amount, 0);
      
      return {
        name: hour,
        amount,
      };
    });
  }, [transactions, selectedCategory]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleRemoveDuplicates = async () => {
    if (!user) return;
    if (!window.confirm("Apakah Anda yakin ingin menghapus data transaksi yang persis sama (duplikat)? Ini akan memeriksa cloud dan menghapusnya secara permanen.")) return;
    
    try {
      const seen = new Set();
      const duplicateIds: string[] = [];
      
      transactions.forEach(t => {
        const key = `${t.title}-${t.amount}-${t.date}-${t.time}-${t.type}-${t.category}`;
        if (seen.has(key)) {
          duplicateIds.push(t.id);
        } else {
          seen.add(key);
        }
      });

      if (duplicateIds.length === 0) {
        alert("Tidak ada data duplikat yang ditemukan.");
        return;
      }

      setImportStatus({ message: `Menghapus ${duplicateIds.length} data ganda, mohon tunggu...`, type: 'confirm' });

      const batchArray = [];
      let currentBatch = writeBatch(db);
      let opCount = 0;

      for (const id of duplicateIds) {
        const docRef = doc(db, `users/${user.uid}/transactions`, id);
        currentBatch.delete(docRef);
        opCount++;
        if (opCount === 500) {
          batchArray.push(currentBatch.commit());
          currentBatch = writeBatch(db);
          opCount = 0;
        }
      }
      if (opCount > 0) {
        batchArray.push(currentBatch.commit());
      }

      await Promise.all(batchArray);
      setImportStatus({ message: `Berhasil menghapus ${duplicateIds.length} transaksi ganda dari cloud.`, type: 'success' });
      setRevealedId(null);
    } catch (e) {
      console.error(e);
      alert("Gagal menghapus data ganda.");
    }
  };

  const handleExportCSV = () => {
    const mappedTransactions = transactions.map(t => ({
      'Tanggal': t.date,
      'Waktu': t.time,
      'Judul Transaksi': t.title,
      'Jumlah': t.amount,
      'Tipe': t.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
      'Kategori': t.category,
      'Klasifikasi': t.classification === 'business' ? 'Bisnis' : 'Pribadi'
    }));
    
    const csv = Papa.unparse(mappedTransactions);
    // Add BOM for Excel UTF-8 support
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `riwayat_transaksi_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = () => {
    const mappedTransactions = transactions.map(t => ({
      'Tanggal': t.date,
      'Waktu': t.time,
      'Judul Transaksi': t.title,
      'Jumlah': t.amount,
      'Tipe': t.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
      'Kategori': t.category,
      'Klasifikasi': t.classification === 'business' ? 'Bisnis' : 'Pribadi'
    }));

    const worksheet = XLSX.utils.json_to_sheet(mappedTransactions);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Transaksi");
    
    // Generate buffer
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `riwayat_transaksi_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        let importedData: any[] = [];

        if (isExcel) {
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          importedData = XLSX.utils.sheet_to_json(worksheet);
        } else {
          // Assume CSV
          const content = typeof data === 'string' ? data : new TextDecoder().decode(data as ArrayBuffer);
          const parsed = Papa.parse(content, { 
            header: true, 
            skipEmptyLines: true,
            transformHeader: (h) => h.trim()
          });
          importedData = parsed.data;
        }
        
        if (!Array.isArray(importedData) || importedData.length === 0) {
          setImportStatus({ message: 'File kosong atau tidak valid.', type: 'error' });
          return;
        }

        const validTransactions: Transaction[] = [];
        const errors: string[] = [];

        importedData.forEach((t: any, index) => {
          const findValue = (keys: string[]) => {
            const entry = Object.entries(t).find(([key]) => {
              const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
              return keys.some(k => {
                const normalizedK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                return normalizedKey === normalizedK;
              });
            });
            return entry ? entry[1] : undefined;
          };

          const title = String(findValue(['judul', 'judultransaksi', 'title', 'name', 'nama', 'description', 'deskripsi', 'label', 'keterangan']) || 'Tanpa Judul');
          
          const rawAmount = findValue(['amount', 'nominal', 'value', 'nilai', 'harga', 'jumlah', 'total']);
          let amount = 0;
          if (typeof rawAmount === 'number') {
            amount = rawAmount;
          } else {
            const cleanAmount = String(rawAmount || '0')
              .replace(/\./g, '')
              .replace(/,/g, '.')
              .replace(/[^\d.-]/g, '');
            amount = parseFloat(cleanAmount);
          }
          
          let type = String(findValue(['type', 'tipe', 'kind', 'status', 'kategori_transaksi']) || 'expense').toLowerCase();
          const isIncome = type.includes('in') || type.includes('masuk') || type.includes('pemasukan');
          const finalType: 'income' | 'expense' = isIncome ? 'income' : 'expense';

          const category = String(findValue(['category', 'kategori', 'group', 'kelompok']) || 'General');
          const date = String(findValue(['date', 'tanggal', 'time', 'timestamp', 'waktu']) || format(new Date(), 'yyyy-MM-dd'));
          const time = String(findValue(['time', 'jam', 'waktu_transaksi']) || (String(date).includes('T') ? format(new Date(String(date)), 'HH:mm') : '00:00'));
          const classificationRaw = String(findValue(['classification', 'klasifikasi', 'type_pribadi', 'bisnis_pribadi']) || 'personal').toLowerCase();
          const classification: 'personal' | 'business' = (classificationRaw.includes('business') || classificationRaw.includes('bisnis')) ? 'business' : 'personal';

          if (!isNaN(amount) && amount > 0) {
            validTransactions.push({
              id: String(findValue(['id', 'uuid', 'key']) || Math.random().toString(36).substr(2, 9)),
              title,
              amount,
              type: finalType,
              category,
              date: String(date).includes('T') ? String(date).split('T')[0] : String(date),
              time: String(time).includes(':') ? String(time) : '00:00',
              classification
            });
          } else {
            errors.push(`Baris ${index + 1}`);
          }
        });

        if (validTransactions.length > 0) {
          const performImport = async () => {
            if (!user) {
                setTransactions(validTransactions);
                setRevealedId(null);
                setImportStatus({ message: `Berhasil mengimpor ${validTransactions.length} transaksi di penyimpanan lokal (tidak tersinkronisasi, silakan login).`, type: 'success' });
                return;
            }
            
            try {
                const batch = writeBatch(db);
                validTransactions.forEach(t => {
                    const newTransactionRef = doc(collection(db, `users/${user.uid}/transactions`));
                    const { id, ...transactionData } = t;
                    const dataToSave: any = {
                        ...transactionData,
                        ownerId: user.uid,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                        isDebt: t.type === 'debt' ? true : false,
                    };
                    if (t.type === 'debt') {
                        dataToSave.isSettled = t.isSettled || false;
                        dataToSave.debtType = t.debtType || 'borrow';
                    }
                    batch.set(newTransactionRef, dataToSave);
                });
                await batch.commit();
                setRevealedId(null);
                setImportStatus({ message: `Berhasil mengimpor ${validTransactions.length} transaksi ke akun Google Anda.`, type: 'success' });
            } catch (error) {
                setImportStatus({ message: 'Gagal mengimpor data ke Cloud.', type: 'error' });
                handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/transactions`);
            }
          };

          if (errors.length > 0) {
            setImportStatus({ 
              message: `Ditemukan ${validTransactions.length} transaksi valid dan ${errors.length} data tidak valid. Impor data yang valid saja?`, 
              type: 'confirm',
              onConfirm: performImport
            });
          } else {
            performImport();
          }
        } else {
          setImportStatus({ message: 'Tidak ada data transaksi yang valid ditemukan dalam file ini.', type: 'error' });
        }
      } catch (err) {
        setImportStatus({ message: 'Gagal membaca file. Pastikan formatnya benar.', type: 'error' });
      }
      if (event.target) event.target.value = '';
    };

    if (isExcel) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  };

  const filteredTransactions = useMemo(() => {
    let result = [...transactions];

    // Month filter for history
    if (activeTab === 'history') {
      result = result.filter(t => isSameMonth(parseISO(t.date), selectedMonth));
    }

    // Tab filter
    if (activeTab === 'history') {
      result = result.filter(t => t.type !== 'debt');
    } else if (activeTab === 'debt') {
      result = result.filter(t => t.type === 'debt');
    }

    // Search filter
    if (searchQuery) {
      result = result.filter(t => 
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Category filter
    if (filterCategory !== 'All') {
      result = result.filter(t => t.category === filterCategory);
    }

    // Classification filter
    if (filterClassification !== 'all') {
      result = result.filter(t => t.classification === filterClassification);
    }

    // Sorting
    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'date') {
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortBy === 'amount') {
        comparison = a.amount - b.amount;
      } else if (sortBy === 'category') {
        comparison = a.category.localeCompare(b.category);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [transactions, searchQuery, filterCategory, filterClassification, sortBy, sortOrder, activeTab, historySubTab, selectedMonth]);

  const filteredMonthlyIncome = useMemo(() => 
    filteredTransactions
      .filter(t => t.type === 'income' && isSameMonth(parseISO(t.date), selectedMonth))
      .reduce((acc, t) => acc + t.amount, 0)
  , [filteredTransactions, selectedMonth]);

  const filteredMonthlyExpense = useMemo(() => 
    filteredTransactions
      .filter(t => t.type === 'expense' && isSameMonth(parseISO(t.date), selectedMonth))
      .reduce((acc, t) => acc + t.amount, 0)
  , [filteredTransactions, selectedMonth]);

  const analyzeBusinessWithAI = async () => {
    const businessTransactions = filteredTransactions.filter(
      t => t.classification === 'business' && isSameMonth(parseISO(t.date), selectedMonth)
    );
    if (businessTransactions.length === 0) {
      alert("Tidak ada transaksi bisnis untuk bulan ini.");
      return;
    }

    setIsAiAnalyzing(true);
    setAiAnalysisResult(null);

    try {
      const prompt = `Saya memiliki data transaksi bisnis berikut untuk bulan ${format(selectedMonth, 'MMMM yyyy', {locale: id})}:
${businessTransactions.map(t => `- ${t.date} ${t.time}: ${t.title} (${t.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}) Rp ${t.amount} [Kategori: ${t.category}]`).join('\n')}

Tolong berikan analisis singkat dan saran yang membangun untuk bisnis saya. Fokus pada kesehatan arus kas, kategori pengeluaran terbesar, dan saran untuk bulan berikutnya. Berikan dalam bahasa Indonesia yang ringkas dan profesional, format plain text atau markdown sederhana.`;

      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: prompt })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghubungi AI");

      setAiAnalysisResult(data.text);
      setIsAiAnalysisModalOpen(true);
    } catch (error: any) {
      console.error(error);
      if (error?.message?.toLowerCase().includes('api key')) {
         setAiAnalysisResult("Fitur AI: Harap pastikan Anda telah memasukkan API Key Gemini yang valid di menu pengaturan.");
         setIsAiAnalysisModalOpen(true);
      } else {
         setAiAnalysisResult("Maaf, terjadi kesalahan saat menganalisis data.");
         setIsAiAnalysisModalOpen(true);
      }
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 backdrop-blur-sm p-1.5 rounded-lg shadow-lg border border-gray-100 flex flex-col gap-1">
          {payload.map((entry: any, index: number) => {
            const isIncome = entry.dataKey === 'income';
            const isExpense = entry.dataKey === 'expense' || entry.dataKey === 'amount';
            
            let Icon = Wallet;
            let color = entry.color || entry.fill || "#00AEEF";
            
            // Match app's icon logic
            if (isIncome) { Icon = ArrowDownLeft; }
            if (isExpense) { Icon = ArrowUpRight; }

            return (
              <div key={index} className="flex items-center gap-1">
                <Icon size={8} style={{ color }} />
                <span className="text-[8px] font-extrabold text-gray-700 leading-none">
                  {formatCurrency(entry.value)}
                </span>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  const formatInputNumber = (value: string) => {
    const rawValue = value.replace(/\D/g, '');
    if (!rawValue) return '';
    const num = parseInt(rawValue);
    if (isNaN(num)) return '';
    return new Intl.NumberFormat('id-ID').format(num);
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawAmount = newAmount.replace(/\D/g, '');
    if (!newTitle || !rawAmount) return;

    const now = new Date();
    const currentTime = format(now, 'HH:mm');
    const finalTime = newTime || currentTime;

    if (!user) {
      let savedTx: Transaction = {
        id: editingTransaction ? editingTransaction.id : Math.random().toString(36).substring(2, 9),
        title: newTitle,
        amount: parseFloat(rawAmount),
        type: newType,
        category: newCategory,
        date: newDate || (editingTransaction ? editingTransaction.date : format(now, 'yyyy-MM-dd')),
        time: finalTime,
        classification: newClassification,
        isDebt: newType === 'debt',
      };
      if (newType === 'debt') {
        savedTx.debtType = newDebtType;
        savedTx.isSettled = editingTransaction ? (editingTransaction.isSettled || false) : false;
      }

      if (editingTransaction) {
        setTransactions(prev => prev.map(t => t.id === editingTransaction.id ? savedTx : t));
      } else {
        setTransactions(prev => [...prev, savedTx]);
      }

      setNewTitle('');
      setNewAmount('');
      setNewDate('');
      setNewTime('');
      setEditingTransaction(null);
      setIsModalOpen(false);
      return;
    }

    try {
      if (editingTransaction) {
        const docId = editingTransaction.id.length < 10 && !editingTransaction.id.includes('-') ? Math.random().toString(36).substring(2, 9) : editingTransaction.id;
        const docRef = doc(db, `users/${user.uid}/transactions`, docId);
        const updateData: any = {
          title: newTitle,
          amount: parseFloat(rawAmount),
          type: newType,
          category: newCategory,
          date: newDate || editingTransaction.date,
          time: finalTime,
          classification: newClassification,
          ownerId: user.uid,
          updatedAt: serverTimestamp(),
          isDebt: newType === 'debt' ? true : false,
        };
        if (newType === 'debt') {
          updateData.debtType = newDebtType;
          updateData.isSettled = newIsSettled;
        }
        await setDoc(docRef, updateData, { merge: true });
      } else {
        const newTransactionRef = doc(collection(db, `users/${user.uid}/transactions`));
        const newData: any = {
          title: newTitle,
          amount: parseFloat(rawAmount),
          type: newType,
          category: newCategory,
          date: newDate || format(now, 'yyyy-MM-dd'),
          time: finalTime,
          classification: newClassification,
          ownerId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          isDebt: newType === 'debt' ? true : false,
        };
        if (newType === 'debt') {
          newData.debtType = newDebtType;
          newData.isSettled = false;
        }
        await setDoc(newTransactionRef, newData);
      }
      
      // Reset form
      setNewTitle('');
      setNewAmount('');
      setNewDate('');
      setNewTime('');
      setEditingTransaction(null);
      setIsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, editingTransaction ? OperationType.UPDATE : OperationType.CREATE, `users/${user.uid}/transactions`);
    }
  };

  const handleToggleSettled = async (t: Transaction) => {
    if (!user) {
      setTransactions(prev => prev.map(item => item.id === t.id ? { ...item, isSettled: !item.isSettled } : item));
      setRevealedId(null);
      return;
    }
    try {
      const docRef = doc(db, `users/${user.uid}/transactions`, t.id);
      await setDoc(docRef, {
        isSettled: !t.isSettled,
        ownerId: user.uid,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setRevealedId(null);
    } catch (error) {
       handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/transactions`);
    }
  };

  const handleEditClick = (t: Transaction) => {
    setEditingTransaction(t);
    setNewTitle(t.title);
    setNewAmount(formatInputNumber(t.amount.toString()));
    setNewType(t.type);
    setNewCategory(t.category);
    setNewDate(t.date);
    setNewTime(t.time || '');
    setNewClassification(t.classification);
    setNewDebtType(t.debtType || 'borrow');
    setNewIsSettled(t.isSettled || false);
    setIsModalOpen(true);
  };

  const handleDeleteTransaction = async () => {
    if (transactionToDelete) {
      if (!user) {
        setTransactions(prev => prev.filter(t => t.id !== transactionToDelete.id));
        setTransactionToDelete(null);
        return;
      }
      try {
        const docRef = doc(db, `users/${user.uid}/transactions`, transactionToDelete.id);
        await deleteDoc(docRef);
        setTransactionToDelete(null);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/transactions`);
      }
    }
  };

  // AI Suggestion for Category & Classification
  useEffect(() => {
    if (!isModalOpen || isScanning || newTitle.length < 3) return;

    // Check Local Rules First (Instant)
    const lowerTitle = newTitle.toLowerCase();
    const matchedRule = Object.keys(LOCAL_RULES).find(key => lowerTitle.includes(key));
    
    if (matchedRule) {
      const rule = LOCAL_RULES[matchedRule];
      setNewCategory(rule.category);
      setNewClassification(rule.classification);
      return; // Skip AI if local rule matches
    }

    const timer = setTimeout(async () => {
      setIsSuggesting(true);
      try {
        const res = await fetch("/api/gemini", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gemini-3.5-flash",
            contents: [
              {
                text: `Analyze: "${newTitle}". 
                Categories: Food, Salary, Entertainment, Shopping, Bensin, Perbaikan, Bonus, General.
                Classifications: personal, business.
                Return JSON: {category, classification}`,
              }
            ],
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: "OBJECT",
                properties: {
                  category: { type: "STRING" },
                  classification: { type: "STRING", enum: ["personal", "business"] },
                },
                required: ["category", "classification"],
              },
            }
          })
        });
        
        if (!res.ok) return;
        const data = await res.json();
        const result = JSON.parse(data.text || '{}');
        if (result.category) setNewCategory(result.category);
        if (result.classification) setNewClassification(result.classification);
      } catch (error) {
        console.error("AI Suggestion Error:", error);
      } finally {
        setIsSuggesting(false);
      }
    }, 500); // Reduced debounce to 500ms

    return () => clearTimeout(timer);
  }, [newTitle, isModalOpen, isScanning]);

  const handleScanReceipt = async (base64Image: string) => {
    if (!base64Image) return;

    setIsScanning(true);
    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gemini-3.5-flash",
          contents: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Image.includes(',') ? base64Image.split(',')[1] : base64Image,
              },
            },
            {
              text: "Extract transaction details from this receipt. Return JSON with fields: title, amount (number), type (income or expense), category (Food, Salary, Entertainment, Shopping, Bensin, Perbaikan, Bonus, General), and classification (personal or business).",
            },
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                title: { type: "STRING" },
                amount: { type: "NUMBER" },
                type: { type: "STRING", enum: ["income", "expense"] },
                category: { type: "STRING" },
                classification: { type: "STRING", enum: ["personal", "business"] },
              },
              required: ["title", "amount", "type", "category", "classification"],
            },
          }
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal AI Scan");

      const extracted = JSON.parse(data.text || '{}');
      setNewTitle(extracted.title || '');
      setNewAmount(formatInputNumber(extracted.amount?.toString() || ''));
      setNewType(extracted.type || 'expense');
      setNewCategory(extracted.category || 'General');
      setNewClassification(extracted.classification || 'personal');
      setNewTime(format(new Date(), 'HH:mm'));
      setIsScannerOpen(false);
      setIsModalOpen(true);
    } catch (error: any) {
      console.error("Scanning failed:", error);
      if (error?.message?.toLowerCase().includes('api key')) {
         alert("Fitur AI: Harap pastikan Anda telah memasukkan API Key Gemini yang valid di menu pengaturan.");
      } else {
         alert("Gagal memindai struk. Pastikan struk terlihat jelas dan lurus.");
      }
    } finally {
      setIsScanning(false);
    }
  };

  const renderInsideLabels = (props: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, name, value } = props;
    const RADIAN = Math.PI / 180;
    const maxVal = Math.max(...categoryPieData.map(d => d.value)) || 1;
    const extraRadius = (value / maxVal) * 50;
    
    // Calculate precise center radius for the variable radius slice
    const radius = innerRadius + (outerRadius + extraRadius - innerRadius) / 2;
    
    // Recharts midAngle is in degrees, 0 is 3 o'clock, clockwise
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    
    const Icon = CATEGORY_CONFIG[name]?.icon || LayoutGrid;
    
    return (
      <g>
        <foreignObject x={x - 15} y={y - 15} width={30} height={30}>
          <div className="flex items-center justify-center w-full h-full pointer-events-none">
            <Icon size={20} className="text-white drop-shadow-md" />
          </div>
        </foreignObject>
      </g>
    );
  };

  const VariableRadiusSector = (props: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload } = props;
    const maxVal = Math.max(...categoryPieData.map(d => d.value)) || 1;
    const extraRadius = (payload.value / maxVal) * 50;
    
    return (
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + extraRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        stroke="#fff"
        strokeWidth={2}
        className="outline-none cursor-pointer hover:brightness-110 transition-all"
        style={{ outline: 'none' }}
      />
    );
  };

  return (
    <div className="max-w-md mx-auto bg-gray-50 min-h-screen pb-24 relative shadow-2xl overflow-hidden">
      {/* Header - Only on Home */}
      {activeTab === 'home' && (
        <header className="bg-blu-primary text-white p-6 rounded-b-[32px] shadow-lg">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center overflow-hidden shadow-sm uppercase font-bold text-blu-primary text-xl relative">
                {user?.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt="Logo" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span>{user?.displayName ? user.displayName.charAt(0) : 'U'}</span>
                )}
                {!user && (
                    <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                        <ArrowUpRight size={16} />
                    </div>
                )}
              </div>
              <div 
                className={cn("cursor-pointer", !user && "hover:opacity-80 transition-opacity")}
                onClick={!user ? loginWithGoogle : undefined}
              >
                <p className="text-xs opacity-80">{user ? 'Selamat Pagi,' : 'Belum Masuk'}</p>
                <p className="font-semibold">{user ? (user.displayName || user.email) : 'Klik untuk Login'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-1 justify-end">
              {user && (
                <button 
                  onClick={logout}
                  className="text-white/80 hover:text-white transition-colors text-xs"
                >
                  Logout
                </button>
              )}
              <AnimatePresence>
                {isSearchOpen && (
                  <motion.div 
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: '100%', opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    className="relative flex-1"
                  >
                    <input 
                      type="text"
                      autoFocus
                      placeholder="Cari transaksi..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-4 pr-10 py-2 bg-white/20 rounded-full text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 transition-all text-sm"
                    />
                    <button 
                      onClick={() => {
                        setIsSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                    >
                      <X size={16} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
              {!isSearchOpen && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setIsDebtModalOpen(true)}
                    className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors flex items-center justify-center text-white"
                    title="Hutang & Piutang"
                  >
                    <CreditCard size={20} />
                  </button>
                  <button 
                    onClick={() => setIsSearchOpen(true)}
                    className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors flex items-center justify-center text-white"
                  >
                    <Search size={20} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1 mb-6">
            <p className="text-sm opacity-80">{isCurrentMonth ? 'Total Saldo Kamu' : 'Saldo Akhir Bulan'}</p>
            <h2 className="text-3xl font-bold tracking-tight">
              {formatCurrency(totalBalanceToDisplay)}
            </h2>
            {!isCurrentMonth && (
              <p className="text-xs opacity-70 font-medium">Saldo Awal: {formatCurrency(startBalance)}</p>
            )}
          </div>

          <div className="flex items-center justify-between mb-6 bg-white/5 rounded-full px-3 py-1 text-xs max-w-[220px] mx-auto border border-white/5">
            <button onClick={handlePrevMonth} className="p-0.5 hover:bg-white/10 rounded-full transition-colors text-white/80 hover:text-white">
              <ArrowDownLeft size={14} className="rotate-45" />
            </button>
            <div className="font-semibold tracking-wider text-[11px] text-white/90">
              {format(selectedMonth, 'MMMM yyyy', { locale: id })}
            </div>
            <button 
              onClick={handleNextMonth} 
              disabled={isCurrentMonth}
              className={cn("p-0.5 rounded-full transition-colors", isCurrentMonth ? "opacity-30 cursor-not-allowed" : "text-white/80 hover:text-white hover:bg-white/10")}
            >
              <ArrowUpRight size={14} className="rotate-45" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/10">
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1 bg-green-500/20 rounded-md">
                  <ArrowDownLeft size={14} className="text-green-400" />
                </div>
                <span className="text-xs opacity-80">Pemasukan</span>
              </div>
              <p className="font-semibold">{formatCurrency(monthlyIncome)}</p>
            </div>
            <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/10">
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1 bg-red-500/20 rounded-md">
                  <ArrowUpRight size={14} className="text-red-400" />
                </div>
                <span className="text-xs opacity-80">Pengeluaran</span>
              </div>
              <p className="font-semibold">{formatCurrency(monthlyExpense)}</p>
            </div>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className="p-6 space-y-8">
        {activeTab === 'home' && (
          <>
            {/* Chart Section */}
            <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-50">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-gray-800">Statistik Mingguan</h3>
                <button 
                  onClick={() => setIsStatsDetailOpen(true)}
                  className="text-blu-primary text-xs font-semibold flex items-center gap-1"
                >
                  Detail <ChevronRight size={14} />
                </button>
              </div>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} tabIndex={-1}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                    <Tooltip 
                      cursor={{ fill: '#f9fafb' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    />
                    <Bar dataKey="income" fill="#00AEEF" radius={[4, 4, 0, 0]} barSize={12} />
                    <Bar dataKey="expense" fill="#FFD700" radius={[4, 4, 0, 0]} barSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Recent Transactions */}
            <section className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-gray-800">Transaksi Terakhir</h3>
                <button 
                  onClick={() => setActiveTab('history')}
                  className="text-blu-primary text-xs font-semibold"
                >
                  Lihat Semua
                </button>
              </div>
              <div className="space-y-3">
                <AnimatePresence>
                  {filteredTransactions.slice(0, 6).map(t => (
                    <TransactionItem 
                      key={t.id} 
                      transaction={t} 
                      onDelete={() => setTransactionToDelete(t)} 
                      onEdit={() => handleEditClick(t)}
                      onToggleSettled={() => handleToggleSettled(t.id)}
                      formatCurrency={formatCurrency}
                      isRevealed={revealedId === t.id}
                      onReveal={(isRevealed) => handleReveal(t.id, isRevealed)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </section>
          </>
        )}

        {activeTab === 'history' && (
          <section className="space-y-6">
            <div className="flex items-center justify-between bg-white rounded-full px-4 py-2 border border-gray-100 shadow-sm">
              <button onClick={handlePrevMonth} className="p-1 hover:bg-gray-50 text-gray-500 hover:text-blu-primary rounded-full transition-colors">
                <ArrowDownLeft size={18} className="rotate-45" />
              </button>
              <div className="text-sm font-bold text-gray-800 tracking-widest uppercase">
                {format(selectedMonth, 'MMMM yyyy', { locale: id })}
              </div>
              <button 
                onClick={handleNextMonth} 
                disabled={isCurrentMonth}
                className={cn("p-1 rounded-full transition-colors", isCurrentMonth ? "opacity-30 text-gray-400" : "hover:bg-gray-50 text-gray-500 hover:text-blu-primary")}
              >
                <ArrowUpRight size={18} className="rotate-45" />
              </button>
            </div>

            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-800">Catatan Riwayat</h2>
              <div className="flex items-center gap-2">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleUpload} 
                  accept=".csv,.xlsx,.xls" 
                  className="hidden" 
                />
                <div className="flex bg-white rounded-xl shadow-sm overflow-hidden">
                  {user && (
                    <button 
                      onClick={handleRemoveDuplicates}
                      className="p-2 text-rose-500 hover:bg-rose-50 transition-colors border-r border-gray-100 flex items-center gap-1"
                      title="Hapus Data Duplikat"
                    >
                      <span className="text-[10px] font-bold">Hapus Ganda</span>
                      <X size={14} />
                    </button>
                  )}
                  <button 
                    onClick={handleExportCSV}
                    className="p-2 text-gray-500 hover:text-blu-primary hover:bg-gray-50 transition-colors border-r border-gray-100 flex items-center gap-1"
                    title="Export CSV"
                  >
                    <span className="text-[10px] font-bold">CSV</span>
                    <Download size={14} />
                  </button>
                  <button 
                    onClick={handleExportExcel}
                    className="p-2 text-gray-500 hover:text-blu-primary hover:bg-gray-50 transition-colors flex items-center gap-1"
                    title="Export Excel"
                  >
                    <span className="text-[10px] font-bold">XLSX</span>
                    <Download size={14} />
                  </button>
                </div>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 bg-white rounded-xl shadow-sm text-gray-500 hover:text-blu-primary transition-colors"
                  title="Import Spreadsheet"
                >
                  <Upload size={18} />
                </button>
                <AnimatePresence>
                  {isSearchOpen && (
                    <motion.div 
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: 160, opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      className="relative"
                    >
                      <input 
                        type="text"
                        autoFocus
                        placeholder="Cari..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-3 pr-8 py-2 bg-white rounded-xl shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blu-primary/20 transition-all"
                      />
                      <button 
                        onClick={() => {
                          setIsSearchOpen(false);
                          setSearchQuery('');
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X size={14} />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {!isSearchOpen && (
                  <button 
                    onClick={() => setIsSearchOpen(true)}
                    className="p-2 bg-white rounded-xl shadow-sm text-gray-500 hover:text-blu-primary transition-colors"
                  >
                    <Search size={18} />
                  </button>
                )}

                <button 
                  onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className="p-2 bg-white rounded-xl shadow-sm text-gray-500 hover:text-blu-primary transition-colors"
                >
                  <TrendingUp size={18} className={cn(sortOrder === 'asc' ? "rotate-180" : "")} />
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="space-y-4">
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {['all', 'personal', 'business'].map((c) => (
                  <button
                    key={c}
                    onClick={() => setFilterClassification(c as any)}
                    className={cn(
                      "px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all",
                      filterClassification === c 
                        ? "bg-blu-primary text-white shadow-md shadow-blu-primary/20" 
                        : "bg-white text-gray-500 hover:bg-gray-100"
                    )}
                  >
                    {c === 'all' ? 'Semua' : c === 'personal' ? 'Pribadi' : 'Bisnis'}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {['All', 'Food', 'Salary', 'Entertainment', 'Shopping', 'Bensin', 'Perbaikan', 'Bonus', 'General'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={cn(
                      "px-4 py-2 rounded-full text-[10px] font-bold whitespace-nowrap transition-all border",
                      filterCategory === cat 
                        ? "bg-gray-800 text-white border-gray-800" 
                        : "bg-white text-gray-500 border-gray-100 hover:bg-gray-50"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                <span>Urutkan:</span>
                <div className="flex gap-2">
                  {(['date', 'amount', 'category'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSortBy(s)}
                      className={cn(
                        "px-3 py-1 rounded-lg transition-all border",
                        sortBy === s 
                          ? "border-blu-primary text-blu-primary bg-blu-primary/5" 
                          : "border-transparent text-gray-400 hover:text-gray-600"
                      )}
                    >
                      {s === 'date' ? 'Tanggal' : s === 'amount' ? 'Jumlah' : 'Kategori'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Filter Summary */}
            {(filterClassification !== 'all' || filterCategory !== 'All' || searchQuery) && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Ringkasan {filterClassification === 'personal' ? 'Pribadi' : filterClassification === 'business' ? 'Bisnis' : ''} • {format(selectedMonth, 'MMMM yyyy', {locale: id})}
                  </p>
                  {filterClassification === 'business' && (
                    <button 
                      onClick={analyzeBusinessWithAI}
                      disabled={isAiAnalyzing}
                      className="text-xs font-bold text-blu-primary flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-full hover:bg-blue-100 transition-colors"
                    >
                      {isAiAnalyzing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                      Analisis AI
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 p-4 rounded-2xl border border-green-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1 bg-green-500/20 rounded-md">
                        <ArrowDownLeft size={12} className="text-green-600" />
                      </div>
                      <p className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Pemasukan</p>
                    </div>
                    <p className="text-lg font-bold text-green-700">{formatCurrency(filteredMonthlyIncome)}</p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-2xl border border-red-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1 bg-red-500/20 rounded-md">
                        <ArrowUpRight size={12} className="text-red-600" />
                      </div>
                      <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Pengeluaran</p>
                    </div>
                    <p className="text-lg font-bold text-red-700">{formatCurrency(filteredMonthlyExpense)}</p>
                  </div>
                </div>
              </motion.div>
            )}

            <div className="space-y-4">
              <AnimatePresence>
                {filteredTransactions.length > 0 ? (
                  filteredTransactions.map(t => (
                    <TransactionItem 
                      key={t.id} 
                      transaction={t} 
                      onDelete={() => setTransactionToDelete(t)} 
                      onEdit={() => handleEditClick(t)}
                      onToggleSettled={() => handleToggleSettled(t.id)}
                      formatCurrency={formatCurrency}
                      isRevealed={revealedId === t.id}
                      onReveal={(isRevealed) => handleReveal(t.id, isRevealed)}
                    />
                  ))
                ) : (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="py-12 text-center space-y-4"
                  >
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto text-gray-400">
                      <Search size={32} />
                    </div>
                    <p className="text-gray-500 text-sm">Tidak ada transaksi yang ditemukan</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>
        )}
      </main>

      {/* Stats Detail Overlay */}
      <AnimatePresence>
        {isStatsDetailOpen && (
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 bg-gray-50 z-[150] flex flex-col"
          >
            <header className="p-6 bg-white border-b border-gray-100 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  {selectedCategory && (
                    <button 
                      onClick={() => setSelectedCategory(null)}
                      className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                    >
                      <ArrowDownLeft className="rotate-45" size={18} />
                    </button>
                  )}
                  <h2 className="text-xl font-bold text-gray-800">
                    {selectedCategory ? `Statistik ${selectedCategory}` : 'Detail Statistik'}
                  </h2>
                </div>
                <button 
                  onClick={() => {
                    setIsStatsDetailOpen(false);
                    setSelectedCategory(null);
                  }}
                  className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Month Picker for Stats */}
              <div className="flex items-center justify-between bg-gray-50 rounded-full px-4 py-2 border border-gray-100">
                <button onClick={handlePrevMonth} className="p-1 hover:bg-white text-gray-500 rounded-full transition-colors">
                  <ArrowDownLeft size={16} className="rotate-45" />
                </button>
                <div className="text-sm font-bold text-gray-700 tracking-widest uppercase">
                  {format(selectedMonth, 'MMMM yyyy', { locale: id })}
                </div>
                <button 
                  onClick={handleNextMonth} 
                  disabled={isCurrentMonth}
                  className={cn("p-1 rounded-full transition-colors", isCurrentMonth ? "opacity-30 text-gray-400" : "hover:bg-white text-gray-500")}
                >
                  <ArrowUpRight size={16} className="rotate-45" />
                </button>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {!selectedCategory ? (
                <>
                  <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-gray-800">Ringkasan Pengeluaran</h3>
                      <div className="flex p-1 bg-gray-100 rounded-xl">
                        <button 
                          onClick={() => setStatsView('weekly')}
                          className={cn(
                            "px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all",
                            statsView === 'weekly' ? "bg-white text-blu-primary shadow-sm" : "text-gray-500"
                          )}
                        >
                          Bulanan
                        </button>
                        {isCurrentMonth && (
                          <button 
                            onClick={() => setStatsView('daily')}
                            className={cn(
                              "px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all",
                              statsView === 'daily' ? "bg-white text-blu-primary shadow-sm" : "text-gray-500"
                            )}
                          >
                            Hari Ini
                          </button>
                        )}
                      </div>
                    </div>

                    {statsView === 'daily' && isCurrentMonth ? (
                      <div className="space-y-6">
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={hourlyData} tabIndex={-1}>
                              <defs>
                                <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#00AEEF" stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor="#00AEEF" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                              <XAxis 
                                dataKey="name" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 8, fill: '#9ca3af' }}
                                interval={3}
                              />
                              <YAxis hide />
                              <Tooltip content={<CustomTooltip />} />
                              <Area 
                                type="monotone" 
                                dataKey="amount" 
                                stroke="#00AEEF" 
                                fillOpacity={1} 
                                fill="url(#colorAmount)" 
                                strokeWidth={3}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="space-y-4">
                          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pengeluaran per Kategori (Hari Ini)</h4>
                          <div className="space-y-3">
                            {['Food', 'Shopping', 'Bensin', 'Perbaikan', 'Entertainment', 'General'].map(cat => {
                              const today = format(new Date(), 'yyyy-MM-dd');
                              const amount = transactions
                                .filter(t => t.type === 'expense' && t.category === cat && t.date === today)
                                .reduce((acc, t) => acc + t.amount, 0);
                              if (amount === 0) return null;
                              return (
                                <div key={cat} className="flex justify-between items-center p-3 bg-gray-50 rounded-2xl">
                                  <span className="text-sm font-medium text-gray-600">{cat}</span>
                                  <span className="text-sm font-bold text-gray-800">{formatCurrency(amount)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <div className="relative h-80 w-full flex items-center justify-center">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart tabIndex={-1}>
                              {/* Center clickable area for Total */}
                              <Pie
                                data={[{ name: 'Total Pengeluaran', value: monthlyExpense }]}
                                cx="50%"
                                cy="50%"
                                innerRadius={0}
                                outerRadius={40}
                                dataKey="value"
                                stroke="none"
                                fill="transparent"
                                isAnimationActive={false}
                                tabIndex={-1}
                              >
                                <Cell key="center" fill="transparent" />
                              </Pie>

                              <Pie
                                data={categoryPieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={85}
                                paddingAngle={4}
                                dataKey="value"
                                labelLine={false}
                                stroke="none"
                                shape={VariableRadiusSector}
                                tabIndex={-1}
                              >
                                {categoryPieData.map((entry, index) => (
                                  <Cell 
                                    key={`cell-${index}`} 
                                    fill={CATEGORY_CONFIG[entry.name]?.color || '#00AEEF'}
                                    className="outline-none"
                                  />
                                ))}
                              </Pie>
                              
                              {/* Labels Layer */}
                              <Pie
                                data={categoryPieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={85}
                                paddingAngle={4}
                                dataKey="value"
                                label={renderInsideLabels}
                                labelLine={false}
                                stroke="none"
                                fill="transparent"
                                isAnimationActive={false}
                                pointerEvents="none"
                              />

                              <Tooltip content={<CustomTooltip />} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        
                        {/* Legend Section */}
                        <div className="grid grid-cols-3 gap-x-3 gap-y-6 mt-8 px-4 w-full">
                          {categoryPieData.map((entry, index) => {
                            const Icon = CATEGORY_CONFIG[entry.name]?.icon || LayoutGrid;
                            const percentage = Math.round((entry.value / (monthlyExpense || 1)) * 100);
                            return (
                              <div key={index} className="flex items-center gap-2">
                                <div 
                                  className="w-10 h-10 rounded-xl flex items-center justify-center relative shrink-0"
                                  style={{ backgroundColor: `${CATEGORY_CONFIG[entry.name]?.color}15` }}
                                >
                                  <Icon size={18} style={{ color: CATEGORY_CONFIG[entry.name]?.color }} />
                                  <span 
                                    className="absolute top-1 right-1 text-[7px] font-black leading-none" 
                                    style={{ color: CATEGORY_CONFIG[entry.name]?.color }}
                                  >
                                    {percentage}%
                                  </span>
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-[7px] font-bold text-gray-400 uppercase tracking-widest leading-none truncate">
                                    {entry.name}
                                  </span>
                                  <span className="text-[9px] font-black text-gray-800 leading-none mt-1.5">
                                    {new Intl.NumberFormat('id-ID', { notation: 'compact' }).format(entry.value)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </section>

                  <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-800 mb-4">Perbandingan Mingguan</h3>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} tabIndex={-1}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                          <YAxis hide />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="income" fill="#00AEEF" radius={[4, 4, 0, 0]} barSize={20} />
                          <Bar dataKey="expense" fill="#FFD700" radius={[4, 4, 0, 0]} barSize={20} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </section>

                  <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-800 mb-4">Analisis Saldo & Arus Kas</h3>
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={monthlyChartData} tabIndex={-1}>
                          <defs>
                            <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#00AEEF" stopOpacity={0.1}/>
                              <stop offset="95%" stopColor="#00AEEF" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                          <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 9, fill: '#9ca3af' }}
                            interval={Math.floor(monthlyChartData.length / 7)}
                          />
                          <YAxis hide domain={['auto', 'auto']} />
                          <Tooltip content={<CustomTooltip />} />
                          <Area 
                            type="monotone" 
                            dataKey="balance" 
                            stroke="#00AEEF" 
                            fillOpacity={1} 
                            fill="url(#colorBalance)" 
                            strokeWidth={2}
                            dot={false}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="income" 
                            stroke="#10b981" 
                            strokeWidth={2} 
                            dot={false}
                            activeDot={{ r: 4 }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="expense" 
                            stroke="#ef4444" 
                            strokeWidth={2} 
                            dot={false}
                            activeDot={{ r: 4 }}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 mt-4">
                      <div className="flex items-center gap-1.5">
                        <Wallet size={10} className="text-[#00AEEF]" />
                        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Saldo</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <ArrowDownLeft size={10} className="text-[#10b981]" />
                        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Masuk</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <ArrowUpRight size={10} className="text-[#ef4444]" />
                        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Keluar</span>
                      </div>
                    </div>
                  </section>
                </>
              ) : (
                <>
                  <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                    <div className="flex flex-col space-y-4 mb-6">
                      <div className="flex justify-between items-center">
                        <h3 className="font-bold text-gray-800">
                          {statsView === 'daily' 
                            ? `Pengeluaran Per Jam (${selectedCategory})` 
                            : `Pengeluaran Harian ${selectedCategory}`}
                        </h3>
                        <div className="text-right">
                          <p className="text-xs text-gray-400">
                            {statsView === 'daily' ? 'Total Hari Ini' : 'Total Minggu Ini'}
                          </p>
                          <p className="font-bold text-blu-primary">
                            {statsView === 'daily'
                              ? formatCurrency(hourlyData.reduce((acc, d) => acc + d.amount, 0))
                              : formatCurrency(categoryChartData.reduce((acc, d) => acc + d.amount, 0))}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex p-1 bg-gray-100 rounded-xl self-start">
                        <button 
                          onClick={() => setStatsView('weekly')}
                          className={cn(
                            "px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all",
                            statsView === 'weekly' ? "bg-white text-blu-primary shadow-sm" : "text-gray-500"
                          )}
                        >
                          Mingguan
                        </button>
                        <button 
                          onClick={() => setStatsView('daily')}
                          className={cn(
                            "px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all",
                            statsView === 'daily' ? "bg-white text-blu-primary shadow-sm" : "text-gray-500"
                          )}
                        >
                          Hari Ini
                        </button>
                      </div>
                    </div>

                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        {statsView === 'daily' ? (
                          <AreaChart data={hourlyData} tabIndex={-1}>
                            <defs>
                              <linearGradient id="colorAmountCat" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#00AEEF" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#00AEEF" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis 
                              dataKey="name" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontSize: 8, fill: '#9ca3af' }}
                              interval={3}
                            />
                            <YAxis hide />
                            <Tooltip content={<CustomTooltip />} />
                            <Area 
                              type="monotone" 
                              dataKey="amount" 
                              stroke="#00AEEF" 
                              fillOpacity={1} 
                              fill="url(#colorAmountCat)" 
                              strokeWidth={3}
                            />
                          </AreaChart>
                        ) : (
                          <BarChart data={categoryChartData} tabIndex={-1}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                            <YAxis hide />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="amount" fill="#00AEEF" radius={[8, 8, 0, 0]} barSize={30} />
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <h3 className="font-bold text-gray-800">Transaksi {selectedCategory} Terakhir</h3>
                    <div className="space-y-3">
                      {transactions
                        .filter(t => t.category === selectedCategory)
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .slice(0, 10)
                        .map(t => (
                          <TransactionItem 
                            key={t.id} 
                            transaction={t} 
                            onDelete={() => setTransactionToDelete(t)} 
                            onEdit={() => handleEditClick(t)}
                            onToggleSettled={() => handleToggleSettled(t.id)}
                            formatCurrency={formatCurrency}
                            isRevealed={revealedId === t.id}
                            onReveal={(isRevealed) => handleReveal(t.id, isRevealed)}
                          />
                        ))}
                    </div>
                  </section>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB Menu */}
      <AnimatePresence>
        {isAddMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsAddMenuOpen(false)}
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[90]"
          />
        )}
      </AnimatePresence>

      <div className="fixed bottom-28 right-6 flex flex-col items-end gap-4 z-[100]">
        <AnimatePresence>
          {isAddMenuOpen && (
            <div className="flex flex-col items-end gap-3 mb-2">
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.3 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.3 }}
                transition={{ type: "spring", stiffness: 600, damping: 25 }}
              >
                <button 
                  onClick={() => {
                    setIsScannerOpen(true);
                    setIsAddMenuOpen(false);
                  }}
                  className="w-12 h-12 bg-blu-primary text-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
                >
                  <Camera size={20} />
                </button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.3 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.3 }}
                transition={{ type: "spring", stiffness: 600, damping: 25, delay: 0.05 }}
              >
                <button 
                  onClick={() => {
                    setNewTime(format(new Date(), 'HH:mm'));
                    setIsModalOpen(true);
                    setIsAddMenuOpen(false);
                  }}
                  className="w-12 h-12 bg-blu-accent text-blu-dark rounded-full shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
                >
                  <Plus size={24} strokeWidth={3} />
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <button 
          onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
          className={cn(
            "w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300",
            isAddMenuOpen ? "bg-gray-800 text-white rotate-45" : "bg-blu-primary text-white"
          )}
        >
          <Plus size={32} strokeWidth={2.5} />
        </button>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-200 px-2 py-3 flex justify-around items-center z-50 rounded-t-[32px] shadow-[0_-10px_30px_rgba(0,0,0,0.08)]">
        {[
          { id: 'home', icon: <Wallet size={24} />, label: 'Beranda' },
          { id: 'history', icon: <History size={24} />, label: 'Riwayat' },
        ].map((tab) => (
          <button 
            key={tab.id}
            onClick={() => {
              console.log('Switching to tab:', tab.id);
              setActiveTab(tab.id as any);
            }}
            className={cn(
              "flex flex-col items-center gap-1.5 p-2 transition-all flex-1",
              activeTab === tab.id ? "text-blu-primary" : "text-gray-400"
            )}
          >
            <div className={cn(
              "p-2.5 rounded-2xl transition-all",
              activeTab === tab.id ? "bg-blu-primary/10" : "hover:bg-gray-50"
            )}>
              {tab.icon}
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* AI Analysis Modal */}
      <AnimatePresence>
        {isAiAnalysisModalOpen && (
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 bg-gray-50 z-[150] flex flex-col"
          >
            <header className="p-6 bg-white border-b border-gray-100 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100/50 rounded-xl">
                    <Sparkles size={20} className="text-blu-primary" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-800">Analisis AI Bisnis</h2>
                </div>
                <button 
                  onClick={() => setIsAiAnalysisModalOpen(false)}
                  className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50">
              <div className="bg-white p-6 rounded-3xl border border-blue-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-100/40 to-transparent rounded-bl-full pointer-events-none" />
                <div className="flex items-center gap-2 mb-6">
                  <Bot size={20} className="text-blu-primary" />
                  <p className="text-sm font-bold text-blu-primary">Insight AI - {format(selectedMonth, 'MMMM yyyy', {locale: id})}</p>
                </div>
                <div className="text-sm text-gray-700 space-y-4 whitespace-pre-wrap leading-relaxed relative z-10">
                  {aiAnalysisResult}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Debt Detail Overlay */}
      <AnimatePresence>
        {isDebtModalOpen && (
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 bg-gray-50 z-[150] flex flex-col"
          >
            <header className="p-6 bg-white border-b border-gray-100 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100/50 rounded-xl text-orange-600">
                    <CreditCard size={20} />
                  </div>
                  <h2 className="text-xl font-bold text-gray-800">Hutang & Piutang</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleExportExcel}
                    className="p-2 text-gray-500 hover:text-blu-primary hover:bg-gray-100 rounded-full transition-colors flex items-center justify-center"
                    title="Export Excel"
                  >
                    <Download size={18} />
                  </button>
                  <button 
                    onClick={() => setIsDebtModalOpen(false)}
                    className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-orange-50 p-4 rounded-3xl border border-orange-100 shadow-sm relative overflow-hidden">
                  <div className="absolute -right-2 -top-2 opacity-10">
                    <ArrowDownLeft size={64} className="text-orange-600" />
                  </div>
                  <p className="text-[10px] font-bold text-orange-600 uppercase tracking-tighter mb-1 relative z-10">Piutang (Pinjam)</p>
                  <p className="text-xl font-black text-orange-900 relative z-10">{formatCurrency(debtStats.borrow)}</p>
                  <p className="text-[9px] text-orange-600/60 mt-1">Uang yang kamu pinjam</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-3xl border border-blue-100 shadow-sm relative overflow-hidden">
                  <div className="absolute -right-2 -top-2 opacity-10">
                    <ArrowUpRight size={64} className="text-blue-600" />
                  </div>
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-tighter mb-1 relative z-10">Utang (Meminjami)</p>
                  <p className="text-xl font-black text-blue-900 relative z-10">{formatCurrency(debtStats.lend)}</p>
                  <p className="text-[9px] text-blue-600/60 mt-1">Uang yang kamu pinjamkan</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Daftar Tagihan</h3>
                  {transactions.filter(t => t.type === 'debt').length > 0 && (
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold">
                      {transactions.filter(t => t.type === 'debt').length} Transaksi
                    </span>
                  )}
                </div>
                
                {transactions.filter(t => t.type === 'debt').length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 bg-white rounded-3xl border border-dashed border-gray-200">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                      <CreditCard size={32} className="text-gray-300" />
                    </div>
                    <p className="text-gray-400 font-bold text-sm">Tidak ada hutang aktif</p>
                    <p className="text-gray-300 text-xs mt-1">Gunakan tombol + untuk menambah</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <AnimatePresence>
                      {transactions.filter(t => t.type === 'debt').map(t => (
                        <TransactionItem 
                          key={t.id}
                          transaction={t} 
                          onDelete={() => setTransactionToDelete(t)} 
                          onEdit={() => {
                            handleEditClick(t);
                          }}
                          onToggleSettled={() => handleToggleSettled(t)}
                          formatCurrency={formatCurrency}
                          isRevealed={revealedId === t.id}
                          onReveal={(isRevealed) => handleReveal(t.id, isRevealed)}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scanner Modal */}
      {isScannerOpen && (
        <ScannerModal 
          onClose={() => setIsScannerOpen(false)} 
          onScan={handleScanReceipt}
          isScanning={isScanning}
        />
      )}

      {/* Add/Edit Transaction Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end justify-center sm:items-center p-4">
          <div className="bg-white w-full max-w-md rounded-t-[32px] sm:rounded-[32px] p-8 space-y-6 animate-in fade-in slide-in-from-bottom-10 duration-300">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-800">
                {editingTransaction ? 'Edit Transaksi' : 'Tambah Transaksi'}
              </h3>
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingTransaction(null);
                  setNewTitle('');
                  setNewAmount('');
                }} 
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div className="flex p-1 bg-gray-100 rounded-xl">
                <button 
                  type="button"
                  onClick={() => setNewType('expense')}
                  className={cn(
                    "flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all",
                    newType === 'expense' ? "bg-white text-red-600 shadow-sm" : "text-gray-500"
                  )}
                >
                  Pengeluaran
                </button>
                <button 
                  type="button"
                  onClick={() => setNewType('income')}
                  className={cn(
                    "flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all",
                    newType === 'income' ? "bg-white text-green-600 shadow-sm" : "text-gray-500"
                  )}
                >
                  Pemasukan
                </button>
                <button 
                  type="button"
                  onClick={() => setNewType('debt')}
                  className={cn(
                    "flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all",
                    newType === 'debt' ? "bg-white text-orange-600 shadow-sm" : "text-gray-500"
                  )}
                >
                  Hutang
                </button>
              </div>

              {newType === 'debt' && (
                <div className="flex p-1 bg-orange-50 rounded-xl">
                  <button 
                    type="button"
                    onClick={() => setNewDebtType('borrow')}
                    className={cn(
                      "flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all",
                      newDebtType === 'borrow' ? "bg-white text-orange-600 shadow-sm border border-orange-100" : "text-gray-500"
                    )}
                  >
                    Piutang (Pinjam)
                  </button>
                  <button 
                    type="button"
                    onClick={() => setNewDebtType('lend')}
                    className={cn(
                      "flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all",
                      newDebtType === 'lend' ? "bg-white text-orange-600 shadow-sm border border-orange-100" : "text-gray-500"
                    )}
                  >
                    Utang (Meminjami)
                  </button>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Judul Transaksi</label>
                  {isSuggesting && (
                    <motion.div 
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-1 text-[10px] font-bold text-blu-primary"
                    >
                      <Loader2 size={10} className="animate-spin" />
                      <span>AI Menganalisis...</span>
                    </motion.div>
                  )}
                </div>
                <div className="relative">
                  <input 
                    type="text" 
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Contoh: Makan Siang" 
                    className={cn(
                      "blu-input pr-10",
                      isSuggesting && "border-blu-primary/30"
                    )}
                    required
                  />
                  {newTitle.length >= 3 && !isSuggesting && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-blu-primary/40">
                      <ScanLine size={16} />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Jumlah (IDR)</label>
                <div className="blu-input flex items-center gap-3 focus-within:ring-2 focus-within:ring-blu-primary/20 focus-within:border-blu-primary transition-all">
                  <span className="text-gray-400 font-bold text-lg shrink-0">Rp</span>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    value={newAmount}
                    onChange={(e) => setNewAmount(formatInputNumber(e.target.value))}
                    placeholder="0" 
                    className="w-full bg-transparent text-2xl font-bold text-blu-primary focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Kategori</label>
                  <select 
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="blu-input appearance-none"
                  >
                    <option>Food</option>
                    <option>Salary</option>
                    <option>Entertainment</option>
                    <option>Shopping</option>
                    <option>Bensin</option>
                    <option>Perbaikan</option>
                    <option>Bonus</option>
                    <option>General</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Klasifikasi</label>
                  <div className="flex p-1 bg-gray-100 rounded-xl">
                    <button 
                      type="button"
                      onClick={() => setNewClassification('personal')}
                      className={cn(
                        "flex-1 py-2 text-[10px] font-bold rounded-lg transition-all",
                        newClassification === 'personal' ? "bg-white text-purple-600 shadow-sm" : "text-gray-500"
                      )}
                    >
                      Pribadi
                    </button>
                    <button 
                      type="button"
                      onClick={() => setNewClassification('business')}
                      className={cn(
                        "flex-1 py-2 text-[10px] font-bold rounded-lg transition-all",
                        newClassification === 'business' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500"
                      )}
                    >
                      Bisnis
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tanggal</label>
                  <input 
                    type="date" 
                    value={newDate || format(new Date(), 'yyyy-MM-dd')}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="blu-input"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Waktu</label>
                  <input 
                    type="time" 
                    value={newTime || format(new Date(), 'HH:mm')}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="blu-input"
                  />
                </div>
              </div>

              <button type="submit" className="blu-button w-full mt-4">
                {editingTransaction ? 'Simpan Perubahan' : 'Simpan Transaksi'}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Import Status Modal */}
      {importStatus && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-6">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-sm rounded-[32px] p-8 space-y-6 shadow-2xl"
          >
            <div className="flex flex-col items-center text-center space-y-4">
              <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center",
                importStatus.type === 'success' ? "bg-green-100 text-green-600" : 
                importStatus.type === 'error' ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"
              )}>
                {importStatus.type === 'success' ? <Check size={32} /> : 
                 importStatus.type === 'error' ? <AlertCircle size={32} /> : <Upload size={32} />}
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-gray-800">
                  {importStatus.type === 'success' ? 'Berhasil' : 
                   importStatus.type === 'error' ? 'Kesalahan' : 'Konfirmasi Impor'}
                </h3>
                <p className="text-sm text-gray-500">{importStatus.message}</p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {importStatus.type === 'confirm' && (
                <button 
                  onClick={() => {
                    importStatus.onConfirm?.();
                  }}
                  className="w-full py-4 bg-blu-primary text-white font-bold rounded-2xl hover:bg-blu-dark transition-colors"
                >
                  Lanjutkan Impor
                </button>
              )}
              <button 
                onClick={() => setImportStatus(null)}
                className={cn(
                  "w-full py-4 font-bold rounded-2xl transition-colors",
                  importStatus.type === 'confirm' ? "bg-gray-100 text-gray-600 hover:bg-gray-200" : "bg-blu-primary text-white hover:bg-blu-dark"
                )}
              >
                {importStatus.type === 'confirm' ? 'Batal' : 'Tutup'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {transactionToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-sm rounded-[32px] p-8 space-y-6 shadow-2xl"
          >
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
                <AlertCircle size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-gray-800">Hapus Transaksi?</h3>
                <p className="text-sm text-gray-500">
                  Apakah kamu yakin ingin menghapus transaksi <span className="font-bold text-gray-700">"{transactionToDelete.title}"</span>? Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={handleDeleteTransaction}
                className="w-full py-4 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 transition-colors"
              >
                Ya, Hapus
              </button>
              <button 
                onClick={() => setTransactionToDelete(null)}
                className="w-full py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 transition-colors"
              >
                Batal
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function ScannerModal({ onClose, onScan, isScanning }: { onClose: () => void, onScan: (img: string) => void, isScanning: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  useEffect(() => {
    async function startCamera() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
        });
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      } catch (err) {
        console.error("Camera access denied:", err);
        alert("Akses kamera ditolak. Berikan izin kamera untuk menggunakan fitur ini.");
        onClose();
      }
    }
    startCamera();
    return () => {
      stream?.getTracks().forEach(track => track.stop());
    };
  }, []);

  const capture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg');
      setCapturedImage(dataUrl);
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-[70] flex flex-col">
      <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
        {!capturedImage ? (
          <>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover"
            />
            {/* Visual Guide Overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-4/5 aspect-[3/4] border-2 border-white/50 rounded-2xl relative">
                {/* Corners */}
                <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-blu-primary rounded-tl-xl"></div>
                <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-blu-primary rounded-tr-xl"></div>
                <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-blu-primary rounded-bl-xl"></div>
                <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-blu-primary rounded-br-xl"></div>
                
                {/* Scanning Animation Line */}
                <div className="absolute inset-x-0 top-0 h-0.5 bg-blu-primary/80 shadow-[0_0_15px_rgba(0,174,239,0.8)] animate-[scan_2s_ease-in-out_infinite]"></div>
              </div>
            </div>
            <div className="absolute top-10 left-0 right-0 text-center px-6">
              <p className="text-white font-medium text-sm bg-black/40 backdrop-blur-md py-2 px-4 rounded-full inline-block">
                Luruskan struk di dalam kotak agar tidak buram
              </p>
            </div>
          </>
        ) : (
          <img src={capturedImage} className="w-full h-full object-contain" alt="Captured" />
        )}

        {isScanning && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center text-white space-y-4">
            <Loader2 className="animate-spin text-blu-primary" size={48} />
            <div className="text-center">
              <p className="text-lg font-bold">Memproses Struk...</p>
              <p className="text-sm opacity-70">AI sedang mengekstrak data transaksi</p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-black p-8 flex justify-between items-center">
        <button 
          onClick={onClose}
          className="p-4 text-white/70 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>

        {!capturedImage ? (
          <button 
            onClick={capture}
            className="w-20 h-20 bg-white rounded-full flex items-center justify-center p-1"
          >
            <div className="w-full h-full border-4 border-white/20 rounded-full flex items-center justify-center">
              <div className="w-14 h-14 bg-blu-primary rounded-full"></div>
            </div>
          </button>
        ) : (
          <div className="flex gap-6">
            <button 
              onClick={() => setCapturedImage(null)}
              className="w-16 h-16 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20"
            >
              <RotateCcw size={24} />
            </button>
            <button 
              onClick={() => onScan(capturedImage)}
              className="w-16 h-16 bg-blu-primary text-white rounded-full flex items-center justify-center hover:bg-blu-dark"
            >
              <Check size={28} />
            </button>
          </div>
        )}

        <div className="w-12 h-12"></div> {/* Spacer */}
      </div>
      <canvas ref={canvasRef} className="hidden" />
      
      <style>{`
        @keyframes scan {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
      `}</style>
    </div>
  );
}
