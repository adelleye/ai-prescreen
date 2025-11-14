import React from 'react';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary';
};

export function Button({ variant = 'primary', children, ...rest }: ButtonProps) {
  const base =
    'inline-flex items-center justify-center rounded-md text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 transition';
  const style =
    variant === 'primary'
      ? 'bg-black text-white hover:bg-gray-800 focus-visible:ring-black'
      : 'bg-white text-black border border-gray-300 hover:bg-gray-50 focus-visible:ring-black';
  return (
    <button className={`${base} ${style}`} {...rest}>
      {children}
    </button>
  );
}





