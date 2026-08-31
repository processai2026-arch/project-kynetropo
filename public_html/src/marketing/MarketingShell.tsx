export default function MarketingShell() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <h1 className="text-3xl font-bold text-foreground mb-2">Kynetropo ERP</h1>
      <p className="text-muted-foreground mb-4">Please sign in to continue.</p>
      <a href="/login" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">Sign In</a>
    </div>
  );
}
