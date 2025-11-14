import React from 'react';

type LiveRegionProps = {
  text: string;
};

export function LiveRegion({ text }: LiveRegionProps) {
  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {text}
    </div>
  );
}
