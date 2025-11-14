import React from 'react';

type ScrollAreaProps = React.HTMLAttributes<HTMLDivElement>;

export function ScrollArea({ className, children, ...rest }: ScrollAreaProps) {
  const baseClasses =
    'relative w-full h-full overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent';

  return (
    <div
      className={className ? `${baseClasses} ${className}` : baseClasses}
      {...rest}
    >
      {children}
    </div>
  );
}



