export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-full text-text-secondary text-sm">
      {message}
    </div>
  );
}
