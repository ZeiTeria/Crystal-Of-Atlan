import './Tabs.css';

export default function Tabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <nav className="tabs">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          className={item.value === value ? 'tab tab-active' : 'tab'}
          aria-current={item.value === value ? 'page' : undefined}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
