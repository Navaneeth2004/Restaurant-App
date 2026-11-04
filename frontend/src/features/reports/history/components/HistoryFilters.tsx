import Icon from 'components/ui/base/Icon';

interface Props {
  from: string; to: string; error: string; loading: boolean;
  onFrom: (v: string) => void; onTo: (v: string) => void; onSearch: () => void; onToday: () => void;
}

export default function HistoryFilters({ from, to, error, loading, onFrom, onTo, onSearch, onToday }: Props) {
  const bad = error ? 'border-red-500/60 focus:border-red-500' : '';
  return (
    <div className="mb-4">
      <div className="flex items-end gap-2.5 flex-wrap">
        <div className="flex-1 min-w-[140px] sm:flex-none sm:w-44"><label className="label" htmlFor="hist-from">From</label>
          <input id="hist-from" type="date" className={`input h-10 w-full ${bad}`} value={from} onChange={e => onFrom(e.target.value)} /></div>
        <div className="flex-1 min-w-[140px] sm:flex-none sm:w-44"><label className="label" htmlFor="hist-to">To</label>
          <input id="hist-to" type="date" className={`input h-10 w-full ${bad}`} value={to} onChange={e => onTo(e.target.value)} /></div>
        <div className="flex items-stretch gap-2 flex-1 sm:flex-none">
          <button type="button" className="btn btn-brand h-10 px-5 min-w-[104px] flex-1 sm:flex-none justify-center" onClick={onSearch} disabled={loading || !!error}>{loading ? 'Loading…' : 'Search'}</button>
          <button type="button" className="btn h-10 px-4 min-w-[88px] justify-center flex-1 sm:flex-none" onClick={onToday}>Today</button>
        </div>
      </div>
      {error && <div role="alert" className="flex items-start gap-2 px-3 py-2 mt-3 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 text-xs"><Icon name="alert" className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{error}</div>}
    </div>
  );
}
