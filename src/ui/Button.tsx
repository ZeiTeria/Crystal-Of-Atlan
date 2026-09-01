import type { ButtonHTMLAttributes } from 'react';
import './Button.css';

type Variant = 'solid' | 'outline' | 'quiet';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** Full width. The default is auto - the opposite of the old `.button`. */
  block?: boolean;
}

export default function Button({
  variant = 'solid',
  block = false,
  className = '',
  type = 'button',
  ...rest
}: Props) {
  const classes = ['btn', `btn-${variant}`, block ? 'btn-block' : '', className]
    .filter(Boolean)
    .join(' ');
  return <button type={type} className={classes} {...rest} />;
}
