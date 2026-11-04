import Spinner from './Spinner';

export default function PageSpinner() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <Spinner className="w-8 h-8 border-zinc-700 border-t-brand-500" />
    </div>
  );
}
