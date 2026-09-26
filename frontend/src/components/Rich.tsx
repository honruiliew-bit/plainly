/** Renders plain paragraphs with **bold** spans. No HTML is ever injected. */
export default function Rich({ text, className = "" }: { text: string; className?: string }) {
  const paras = text.split(/\n\s*\n/).filter(Boolean);
  return (
    <div className={`space-y-3 ${className}`}>
      {paras.map((p, i) => (
        <p key={i} className="text-[15.5px] leading-[1.7]">
          {p.split(/(\*\*[^*]+\*\*)/g).map((part, k) =>
            part.startsWith("**") && part.endsWith("**") ? (
              <strong key={k} className="font-semibold">
                {part.slice(2, -2)}
              </strong>
            ) : (
              <span key={k}>{part}</span>
            )
          )}
        </p>
      ))}
    </div>
  );
}
