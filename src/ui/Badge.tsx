import type { ReactNode } from 'react';
import './Badge.css';

export default function Badge({
  children,
  tone = 'accent',
}: {
  children: ReactNode;
  tone?: 'accent' | 'warn';
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
