// A simple class name utility for conditionally joining class names.
export function cn(...args: (string | undefined | null | boolean)[]) {
  return args.filter(Boolean).join(' ');
}
