export function SocialButton({ icon, label, onClick, loading = false, disabled = false, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      className="w-full inline-flex justify-center items-center gap-2 py-2.5 px-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {icon}
      {loading ? "Signing in…" : label}
    </button>
  );
}

export function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12.0003 4.75C13.7703 4.75 15.3553 5.36002 16.6053 6.54998L20.0303 3.125C17.9502 1.19 15.2353 0 12.0003 0C7.31028 0 3.25527 2.69 1.28027 6.60998L5.27028 9.70498C6.21525 6.86002 8.87028 4.75 12.0003 4.75Z" fill="#EA4335" />
      <path d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L19.945 21.1C22.2 19.01 23.49 15.92 23.49 12.275Z" fill="#4285F4" />
      <path d="M5.26498 14.2949C5.02498 13.5699 4.88501 12.7999 4.88501 11.9999C4.88501 11.1999 5.01998 10.4299 5.26498 9.7049L1.275 6.60986C0.46 8.22986 0 10.0599 0 11.9999C0 13.9399 0.46 15.7699 1.28 17.3899L5.26498 14.2949Z" fill="#FBBC05" />
      <path d="M12.0004 24C15.2404 24 17.9654 22.935 19.9454 21.095L16.0804 18.095C15.0054 18.82 13.6204 19.245 12.0004 19.245C8.8704 19.245 6.21537 17.135 5.26538 14.29L1.27539 17.385C3.25539 21.31 7.3104 24 12.0004 24Z" fill="#34A853" />
    </svg>
  );
}

export function AppleIcon() {
  return (
    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16.365 21.444c-1.558.077-3.237-.878-4.406-.878-1.127 0-2.585.83-3.923.856-1.745.026-3.348-.988-4.253-2.502-1.848-3.09-.474-7.669 1.323-10.158.883-1.22 2.227-1.997 3.652-2.023 1.477-.026 2.846.962 3.754.962.909 0 2.584-1.221 4.38-1.04 1.477.078 2.82.727 3.702 1.95-3.09 1.82-2.571 6.136.363 7.28-1.168 2.91-3.22 6.575-4.592 5.553zm-1.895-15.03c1.013-1.169 1.688-2.833 1.506-4.414-1.428.052-3.167.91-4.207 2.078-.883.987-1.688 2.677-1.48 4.232 1.61.104 3.168-.727 4.181-1.896z" />
    </svg>
  );
}
