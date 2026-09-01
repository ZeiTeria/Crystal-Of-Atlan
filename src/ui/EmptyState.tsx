import type { ReactNode } from 'react';

export default function EmptyState({ children }: { children: ReactNode }) {
  return <p className="muted">{children}</p>;
}
