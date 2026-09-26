import Link from "next/link";

export default function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="font-display text-2xl tracking-tight leading-none">
      Plain<span className="text-vermilion">ly</span>
    </Link>
  );
}
