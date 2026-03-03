export default function BrandLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg
        viewBox="0 0 100 100"
        className="h-9 w-9 shrink-0 text-text"
        aria-hidden="true"
      >
        <path
          d="M68 16H30C20 16 12 24 12 34v24c0 10 8 18 18 18h18l16 12v-12h4c10 0 18-8 18-18V34c0-10-8-18-18-18Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinejoin="round"
        />
        <path
          d="M44 30c0 7-5 12-12 12 7 0 12 5 12 12 0-7 5-12 12-12-7 0-12-5-12-12Z"
          fill="currentColor"
        />
        <path
          d="M66 26c0 4-3 7-7 7 4 0 7 3 7 7 0-4 3-7 7-7-4 0-7-3-7-7Z"
          fill="currentColor"
        />
      </svg>
      <h1 className="flex items-baseline font-brand text-3xl font-bold tracking-tight">
        <span className="text-primary">AI</span>
        <span className="text-text">FAQ</span>
      </h1>
    </div>
  );
}
