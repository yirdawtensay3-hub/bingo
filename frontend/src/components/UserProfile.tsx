import React, { useState, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { transactionAPI, type CombinedTransaction, TransactionStatus } from '@/services/api';
import BingoInstructions from './BingoInstructions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { telegramService } from '@/services/telegram';

interface DepositInfo {
  phoneNumber: string;
  creditedPartyName: string;
  cbeReceiverName: string;
  cbeReceiverAccount: string;
}

interface DepositResult {
  amount: number;
  receiptNo: string;
  paymentDate: string;
  balance: number;
}

export const UserProfile: React.FC = () => {
  const { user, logout, updateBalance } = useUser();
  const [showDeposit, setShowDeposit] = useState<boolean>(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'telebirr' | 'cbe' | null>(null);
  const [telebirrRef, setTelebirrRef] = useState<string>('');
  const [cbeRef, setCbeRef] = useState<string>('');
  const [isDepositing, setIsDepositing] = useState<boolean>(false);
  const [depositInfo, setDepositInfo] = useState<DepositInfo | null>(null);
  const [transactions, setTransactions] = useState<CombinedTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'wallet' | 'instructions'>('wallet');
  const [withdrawOpen, setWithdrawOpen] = useState<boolean>(false);
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [withdrawMethod, setWithdrawMethod] = useState<'telebirr' | 'cbe'>('telebirr');
  const [withdrawAccountName, setWithdrawAccountName] = useState<string>('');
  const [withdrawAccountNumber, setWithdrawAccountNumber] = useState<string>('');
  const [withdrawLoading, setWithdrawLoading] = useState<boolean>(false);
  const [withdrawMessage, setWithdrawMessage] = useState<string | null>(null);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  // Dialog states
  const [depositSuccessOpen, setDepositSuccessOpen] = useState<boolean>(false);
  const [depositResult, setDepositResult] = useState<DepositResult | null>(null);
  const [depositErrorOpen, setDepositErrorOpen] = useState<boolean>(false);
  const [depositErrorMessage, setDepositErrorMessage] = useState<string>('');

  useEffect(() => {
    const loadDepositInfo = async () => {
      try {
        const info = await transactionAPI.getDepositInfo();
        setDepositInfo(info);
      } catch (err) {
        console.error('Failed to load deposit info:', err);
      }
    };

    loadDepositInfo();
  }, []);

  useEffect(() => {
    const loadTransactions = async () => {
      if (!user) return;

      setLoading(true);
      setError(null);

      try {
        const response = await transactionAPI.getTransactions(page, 10);
        setTransactions(prev => page === 1 ? response : [...prev, ...response]);
        setHasMore(response.length === 10);
      } catch (err) {
        console.error('Failed to load transactions:', err);
        setError('Failed to load transactions. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadTransactions();
  }, [user, page]);

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      setPage(prev => prev + 1);
    }
  };

  if (!user) return null;

  const parseReferenceFromText = (text: string): string => {
    // Parse Telebirr SMS format
    const telebirrMatch = text.match(/transaction number is ([A-Z0-9]+)/i);
    if (telebirrMatch) {
      return telebirrMatch[1].toUpperCase();
    }

    // Parse CBE SMS format
    const cbeMatch = text.match(/ref[#:]?\s*([A-Z0-9]+)/i);
    if (cbeMatch) {
      return cbeMatch[1].toUpperCase();
    }

    // If no pattern matches, return the text as is (uppercase)
    return text.toUpperCase();
  };

  const handleReferenceChange = (value: string) => {
    const parsed = parseReferenceFromText(value);
    setTelebirrRef(parsed);
  };

  const parseCbeReferenceFromText = (text: string): string => {
    // Parse CBE SMS format - extract from URL or direct reference
    const urlMatch = text.match(/id=([A-Z0-9]+)/i);
    if (urlMatch) {
      return urlMatch[1].toUpperCase();
    }

    // Direct reference match (FT + numbers/letters + 8 digits)
    const directMatch = text.match(/(FT[A-Z0-9]+)/i);
    if (directMatch) {
      return directMatch[1].toUpperCase();
    }

    // If no pattern matches, return the text as is (uppercase)
    return text.toUpperCase();
  };

  const handleCbeReferenceChange = (value: string) => {
    const parsed = parseCbeReferenceFromText(value);
    setCbeRef(parsed);
  };

  const splitCbeReference = (reference: string): { ref: string; accountSuffix: string } => {
    if (reference.length >= 8) {
      const accountSuffix = reference.slice(-8); // Last 8 characters
      const ref = reference.slice(0, -8); // Everything except last 8 characters
      return { ref, accountSuffix };
    }
    return { ref: reference, accountSuffix: '' };
  };

  const handleDepositByReference = async () => {
    if (!selectedPaymentMethod) return;

    const reference = selectedPaymentMethod === 'telebirr' ? telebirrRef : cbeRef;
    if (!reference.trim()) {
      setDepositErrorMessage('Please enter a reference number');
      setDepositErrorOpen(true);
      return;
    }

    if (selectedPaymentMethod === 'cbe' && reference.length < 8) {
      setDepositErrorMessage('CBE reference must be at least 8 characters long');
      setDepositErrorOpen(true);
      return;
    }

    setIsDepositing(true);
    try {
      let accountSuffix: string | undefined;
      let actualReference = reference.trim();

      if (selectedPaymentMethod === 'cbe') {
        const split = splitCbeReference(reference.trim());
        actualReference = split.ref;
        accountSuffix = split.accountSuffix;
      }

      const result = await transactionAPI.depositByReference(
        actualReference,
        selectedPaymentMethod,
        accountSuffix
      );

      if (result.success) {
        setDepositResult({
          amount: result.amount,
          receiptNo: result.receiptNo,
          paymentDate: result.paymentDate,
          balance: (result.main_balance + result.reward_balance),
        });
        setDepositSuccessOpen(true);
        updateBalance(result.main_balance, result.reward_balance);

        // Clear form
        setTelebirrRef('');
        setCbeRef('');
        setSelectedPaymentMethod(null);
        setShowDeposit(false);

        // Refresh transactions
        setPage(1);
      } else {
        setDepositErrorMessage('Deposit verification failed. Please check your reference number.');
        setDepositErrorOpen(true);
      }
    } catch (err: any) {
      console.error('Deposit failed:', err);
      setDepositErrorMessage(err.response?.data?.message || 'Deposit failed. Please try again.');
      setDepositErrorOpen(true);
    } finally {
      setIsDepositing(false);
    }
  };

  const getInvitationUrl = () => {
    const userId = user.userId || user.telegramId;
    return `https://t.me/goatbingobot/invite?startapp=${userId}`;
  };

  const copyReferralLink = () => {
    const referralLink = getInvitationUrl();
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareInvitation = () => {
    const invitationUrl = getInvitationUrl();
    const shareText = 'Join me on Bingo Bot and let\'s play together!';
    telegramService.shareUrl(invitationUrl, shareText);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getTransactionType = (tx: CombinedTransaction): string => {
    if (tx.transactionType === 'payment') {
      // Heuristic: deposits have a reference; withdrawals don't
      return tx.reference ? 'deposit' : 'withdrawal';
    }
    return tx.type === 0
      ? 'win'
      : tx.type === 1
        ? 'bet'
        : tx.type === 2
          ? 'reward'
          : 'unknown';
  };

  const getTransactionAmount = (tx: CombinedTransaction): number => {
    return tx.transaction.amount;
  };

  const getTransactionStatus = (tx: CombinedTransaction): string => {
    return tx.transaction.status === TransactionStatus.Completed ? 'completed' :
      tx.transaction.status === TransactionStatus.Declined ? 'failed' : 'pending';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* User Info Section */}
        <Card className="p-6 mb-8">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-4xl font-bold text-primary">
              {(user.username || "Unknown").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-center">{user.username}</h1>
              <div className="mt-2 text-center">
                <div className="mb-2">
                  <span className="text-3xl font-bold">${(user.balance || 0).toFixed(2)}</span>
                  <span className="ml-2 text-sm text-muted-foreground">birr</span>
                </div>
                <div className="flex justify-center gap-6 text-sm">
                  <div className="text-center">
                    <div className="text-muted-foreground">Main</div>
                    <div className="font-semibold text-primary">${(user.main_balance || 0).toFixed(2)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-muted-foreground">Reward</div>
                    <div className="font-semibold text-green-600">${(user.reward_balance || 0).toFixed(2)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Tabs */}
        <div className="flex border-b backdrop-blur-2xl rounded-t-2xl">
          <button
            className={`px-4 py-2 font-medium ${activeTab === 'wallet'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
              }`}
            onClick={() => setActiveTab('wallet')}
          >
            Wallet & Transactions
          </button>
          <button
            className={`px-4 py-2 font-medium ${activeTab === 'instructions'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
              }`}
            onClick={() => setActiveTab('instructions')}
          >
            Game Instructions
          </button>
        </div>

        {activeTab === 'wallet' ? (
          <>
            {/* Wallet Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <Card className="p-6 rounded-b-lg rounded-t-none">
                <h2 className="text-xl font-semibold mb-4">Wallet</h2>
                <div className="space-y-4">
                  <Button
                    className="w-full"
                    onClick={() => setShowDeposit(true)}
                  >
                    Deposit
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setWithdrawOpen(true)}
                  >
                    Withdraw
                  </Button>

                  {showDeposit && (
                    <div className="mt-4 space-y-4">
                      {!selectedPaymentMethod ? (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">Choose payment method:</p>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              onClick={() => setSelectedPaymentMethod('telebirr')}
                              className="flex-1"
                            >
                              Telebirr
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => setSelectedPaymentMethod('cbe')}
                              className="flex-1"
                            >
                              CBE Birr
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {selectedPaymentMethod === 'telebirr' && depositInfo && (
                            <div className="space-y-3">
                              <div className="p-3 bg-muted rounded-lg">
                                <p className="text-sm font-medium">Send money to:</p>
                                <p className="text-sm">Name: {depositInfo.creditedPartyName}</p>
                                <p className="text-sm">Phone: {depositInfo.phoneNumber}</p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1">
                                  Transaction Reference
                                </label>
                                <input
                                  type="text"
                                  value={telebirrRef}
                                  onChange={(e) => handleReferenceChange(e.target.value)}
                                  placeholder="Paste SMS or enter reference"
                                  className="w-full p-2 border rounded"
                                />
                              </div>
                            </div>
                          )}

                          {selectedPaymentMethod === 'cbe' && depositInfo && (
                            <div className="space-y-3">
                              <div className="p-3 bg-muted rounded-lg">
                                <p className="text-sm font-medium">Send money to:</p>
                                <p className="text-sm">Name: {depositInfo.cbeReceiverName}</p>
                                <p className="text-sm">Account: {depositInfo.cbeReceiverAccount}</p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1">
                                  Transaction Reference (e.g., FT25**************51)
                                </label>
                                <input
                                  type="text"
                                  value={cbeRef}
                                  onChange={(e) => handleCbeReferenceChange(e.target.value)}
                                  placeholder="Paste SMS or enter full reference"
                                  className="w-full p-2 border rounded"
                                />
                                {cbeRef && cbeRef.length >= 8 && (
                                  <div className="mt-2 text-xs text-muted-foreground">
                                    <p>Reference: {splitCbeReference(cbeRef).ref}</p>
                                    <p>Account Suffix: {splitCbeReference(cbeRef).accountSuffix}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="flex gap-2">
                            <Button
                              onClick={handleDepositByReference}
                              disabled={isDepositing}
                              className="flex-1"
                            >
                              {isDepositing ? 'Processing...' : 'Submit Reference'}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setTelebirrRef('');
                                setCbeRef('');
                                setSelectedPaymentMethod(null);
                                setShowDeposit(false);
                              }}
                            >
                              Clear
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>

              {/* Referral Section */}
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">Invite Friends</h2>
                <p className="text-muted-foreground mb-4">
                  Invite friends and earn rewards when they join and play!
                </p>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={getInvitationUrl()}
                      className="flex-1 p-2 border rounded text-sm"
                    />
                    <Button onClick={copyReferralLink}>
                      {copied ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                  <Button
                    onClick={shareInvitation}
                    className="w-full"
                    variant="outline"
                  >
                    Share on Telegram
                  </Button>
                </div>
              </Card>
            </div>

            {/* Recent Transactions */}
            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-4">Recent Transactions</h2>
              {loading && page === 1 ? (
                <div className="text-center py-4">Loading transactions...</div>
              ) : error ? (
                <div className="text-red-500 text-center py-4">{error}</div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">No transactions found</div>
              ) : (
                <Card className="overflow-hidden">
                  <div className="divide-y">
                    {transactions.map((tx) => (
                      <div key={tx._id} className="p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-medium capitalize">{getTransactionType(tx)}</div>
                            <div className="text-sm text-muted-foreground">
                              {formatDate(tx.createdAt)}
                            </div>
                            {tx.reference && (
                              <div className="text-xs text-muted-foreground">
                                Ref: {tx.reference}
                              </div>
                            )}
                          </div>
                          <div className={`font-medium ${getTransactionType(tx) === 'deposit' || getTransactionType(tx) === 'win' || getTransactionType(tx) === 'reward'
                            ? 'text-green-600'
                            : 'text-red-600'
                            }`}>
                            {(getTransactionType(tx) === 'deposit' || getTransactionType(tx) === 'win' || getTransactionType(tx) === 'reward') ? '+' : '-'}
                            {getTransactionAmount(tx).toFixed(2)}
                          </div>
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          Status: <span className="capitalize">{getTransactionStatus(tx)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {hasMore && (
                    <div className="p-4 text-center">
                      <Button
                        variant="outline"
                        onClick={handleLoadMore}
                        disabled={loading}
                      >
                        {loading ? 'Loading...' : 'Load More'}
                      </Button>
                    </div>
                  )}
                </Card>
              )}
            </div>
          </>
        ) : (
          <BingoInstructions />
        )}

        {/* Logout Button */}
        <div className="mt-8 text-center">
          <Button variant="outline" onClick={logout}>
            Logout
          </Button>
        </div>
      </div>

      {/* Success Dialog */}
      <Dialog open={depositSuccessOpen} onOpenChange={setDepositSuccessOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deposit Successful!</DialogTitle>
            <DialogDescription>
              Your deposit has been processed successfully.
            </DialogDescription>
          </DialogHeader>
          {depositResult && (
            <div className="space-y-2">
              <p><strong>Amount:</strong> ${depositResult.amount.toFixed(2)}</p>
              <p><strong>Receipt:</strong> {depositResult.receiptNo}</p>
              <p><strong>Date:</strong> {formatDate(depositResult.paymentDate)}</p>
              <p><strong>New Balance:</strong> ${depositResult.balance.toFixed(2)}</p>
            </div>
          )}
          <Button onClick={() => setDepositSuccessOpen(false)} className="w-full">
            Close
          </Button>
        </DialogContent>
      </Dialog>

      {/* Error Dialog */}
      <AlertDialog open={depositErrorOpen} onOpenChange={setDepositErrorOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deposit Failed</AlertDialogTitle>
            <AlertDialogDescription>
              {depositErrorMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setDepositErrorOpen(false)}>
              Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Withdraw Dialog */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Withdrawal</DialogTitle>
            <DialogDescription>Enter the amount and destination details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Amount</label>
              <input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="0.00"
                className="w-full p-2 border rounded"
                min={0}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Method</label>
              <div className="flex gap-2">
                <Button variant={withdrawMethod === 'telebirr' ? 'default' : 'outline'} onClick={() => setWithdrawMethod('telebirr')}>Telebirr</Button>
                <Button variant={withdrawMethod === 'cbe' ? 'default' : 'outline'} onClick={() => setWithdrawMethod('cbe')}>CBE</Button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Account Name</label>
              <input
                type="text"
                value={withdrawAccountName}
                onChange={(e) => setWithdrawAccountName(e.target.value)}
                placeholder="e.g., John Doe"
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Account / Phone Number</label>
              <input
                type="text"
                value={withdrawAccountNumber}
                onChange={(e) => setWithdrawAccountNumber(e.target.value)}
                placeholder="e.g., 0912345678"
                className="w-full p-2 border rounded"
              />
            </div>
            {withdrawMessage && (
              <div className="text-sm text-muted-foreground">{withdrawMessage}</div>
            )}
            {withdrawError && (
              <div className="text-sm text-red-500">{withdrawError}</div>
            )}
            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={withdrawLoading}
                onClick={async () => {
                  const amount = parseFloat(withdrawAmount);
                  if (!amount || amount <= 0) {
                    setWithdrawMessage('Enter a valid amount.');
                    return;
                  }
                  if (!withdrawAccountNumber.trim()) {
                    setWithdrawMessage('Enter a destination account/phone number.');
                    return;
                  }
                  setWithdrawLoading(true);
                  setWithdrawMessage(null);
                  setWithdrawError(null);
                  try {
                    await transactionAPI.requestWithdraw({
                      amount,
                      method: withdrawMethod,
                      accountName: withdrawAccountName || undefined,
                      accountNumber: withdrawAccountNumber,
                    });
                    setWithdrawMessage('Withdrawal requested successfully.');
                    setWithdrawOpen(false);
                  } catch (err: any) {
                    setWithdrawError(err?.response?.data?.message || 'Failed to request withdrawal.');
                  } finally {
                    setWithdrawLoading(false);
                  }
                }}
              >
                {withdrawLoading ? 'Requesting...' : 'Request Withdrawal'}
              </Button>
              <Button variant="outline" onClick={() => setWithdrawOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

