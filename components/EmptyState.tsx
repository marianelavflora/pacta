import type { LucideIcon } from "lucide-react";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  text: string;
  children?: React.ReactNode;
};

/** Cajita punteada para lo que todavía no tiene contenido. */
export function EmptyState({ icon: Icon, title, text, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border px-6 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-chip text-chip-foreground">
        <Icon className="size-6" aria-hidden />
      </span>
      <p className="text-lg font-semibold">{title}</p>
      <p className="max-w-sm text-muted-foreground">{text}</p>
      {children}
    </div>
  );
}
