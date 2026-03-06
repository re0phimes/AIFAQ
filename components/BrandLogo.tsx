import Link from "next/link";

export default function BrandLogo() {
  return (
    <Link
      href="/#top"
      aria-label="Jump to the top of AIFAQ"
      className="group inline-flex items-center gap-2.5 rounded-2xl px-1.5 py-1 text-text transition-[transform,background-color,box-shadow] duration-200 ease-out transform-gpu hover:-translate-y-0.5 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-faq"
    >
      <svg viewBox="0 0 100 100" className="h-10 w-10 shrink-0 overflow-visible" aria-hidden="true">
        <path
          d="M68 16H30C20 16 12 24 12 34v24c0 10 8 18 18 18h18l16 12v-12h4c10 0 18-8 18-18V34c0-10-8-18-18-18Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinejoin="round"
          className="text-text transition-colors duration-200 group-hover:text-brand-ai"
        />
        <path
          d="M44 30c0 7-5 12-12 12 7 0 12 5 12 12 0-7 5-12 12-12-7 0-12-5-12-12Z"
          fill="currentColor"
          className="text-brand-ai"
        />
        <path
          d="M66 26c0 4-3 7-7 7 4 0 7 3 7 7 0-4 3-7 7-7-4 0-7-3-7-7Z"
          fill="currentColor"
          className="text-brand-faq"
        />
        <circle cx="72" cy="63" r="4" fill="currentColor" className="text-brand-faq" />
      </svg>
      <h1 className="flex items-baseline font-brand text-3xl font-bold leading-none tracking-tight">
        <span className="text-brand-ai">AI</span>
        <span className="text-brand-faq">FAQ</span>
      </h1>
    </Link>
  );
}
