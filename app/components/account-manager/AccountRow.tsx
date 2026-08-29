function AccountRow({ id, isUsed, onToggle }: { id: string; isUsed: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`
        w-8 h-8 rounded-full flex items-center justify-center ${isUsed ? "bg-green-600 text-white shadow" : "bg-gray-700 border border-gray-600 text-gray-400 hover:bg-gray-800 transition-colors"}
        relative
      `}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M18 6L9 17L3 6" />
      </svg>
    </button>
  );
}

export default AccountRow;