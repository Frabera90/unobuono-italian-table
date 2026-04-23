export function Stub({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="font-display text-3xl">{title}</h1>
      <p className="mt-2 text-muted-foreground">{desc}</p>
      <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center text-sm text-muted-foreground">
        🚧 In arrivo nella prossima fase del rilascio.
      </div>
    </div>
  );
}
