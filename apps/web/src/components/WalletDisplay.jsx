export default function WalletDisplay({ wallet }) {
  if (!wallet) {
    return null;
  }

  return (
    <div className="wallet-display card">
      <div className="eyebrow">我的钱包</div>
      <div className="wallet-balance">
        <span className="wallet-coin-icon">💰</span>
        <strong>{wallet.balanceCoin}</strong>
        <span>金币</span>
      </div>
      <p className="wallet-hint">1 金币 = 1 元人民币</p>
    </div>
  );
}
