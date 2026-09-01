import './Meter.css';

/** A 2px rule. Decorative - the figures it depicts are always printed beside it. */
export default function Meter({
  value,
  max,
  tone = 'accent',
}: {
  value: number;
  max: number;
  tone?: 'accent' | 'warn' | 'danger';
}) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <span className={`meter meter-${tone}`} aria-hidden="true">
      <i style={{ width: `${pct}%` }} />
    </span>
  );
}
