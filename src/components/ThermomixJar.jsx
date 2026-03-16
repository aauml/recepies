export default function ThermomixJar({ size = 18, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M6 5h12l-1.2 14.5c-.1.8-.7 1.5-1.5 1.5H8.7c-.8 0-1.4-.7-1.5-1.5L6 5z" />
      <path d="M5 5h14" />
      <path d="M18.5 8.5h1.5a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1.3" />
    </svg>
  )
}
