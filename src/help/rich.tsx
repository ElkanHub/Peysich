/** "**bold**" in a step means the exact words on a button. Nothing else. */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return <>{parts.map((p, i) => (i % 2 ? <b key={i} className="font-semibold text-foreground">{p}</b> : p))}</>;
}
