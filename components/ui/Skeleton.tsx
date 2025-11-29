import React from 'react';
import { cn } from '../../utils/cn';

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse bg-panel-strong', className)}
      {...props}
    />
  );
}

export { Skeleton };