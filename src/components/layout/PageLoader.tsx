export function PageLoader() {
  return (
    <div
      className="flex min-h-[50vh] items-center justify-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <p className="text-muted-foreground">Carregando...</p>
    </div>
  );
}
