const RULES = [
  { id: "len",     label: "At least 8 characters",   test: (v) => v.length >= 8 },
  { id: "upper",   label: "One uppercase letter",     test: (v) => /[A-Z]/.test(v) },
  { id: "lower",   label: "One lowercase letter",     test: (v) => /[a-z]/.test(v) },
  { id: "digit",   label: "One digit",                test: (v) => /\d/.test(v) },
  { id: "special", label: "One special character",    test: (v) => /[!@#$%^&*()\-_=+[\]{};:'",.<>?/\\|`~]/.test(v) },
];

const LEVELS = [
  { label: "Too weak",  color: "bg-red-400" },
  { label: "Weak",      color: "bg-orange-400" },
  { label: "Fair",      color: "bg-yellow-400" },
  { label: "Good",      color: "bg-blue-400" },
  { label: "Good",      color: "bg-blue-400" },
  { label: "Strong",    color: "bg-green-500" },
];

export function isPasswordStrong(password) {
  return RULES.every((r) => r.test(password));
}

export default function PasswordStrength({ password }) {
  if (!password) return null;

  const passed = RULES.filter((r) => r.test(password)).length;
  const level = LEVELS[passed] ?? LEVELS[0];

  return (
    <div className="mt-2 space-y-2">
      {/* Strength bar */}
      <div className="flex gap-1 items-center">
        {LEVELS.slice(1).map((l, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              i < passed ? level.color : "bg-slate-200"
            }`}
          />
        ))}
        <span className={`text-xs font-semibold ml-2 w-16 ${
          passed <= 1 ? "text-red-500" : passed <= 2 ? "text-orange-500" : passed <= 3 ? "text-yellow-600" : "text-green-600"
        }`}>
          {level.label}
        </span>
      </div>

      {/* Rule checklist */}
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
        {RULES.map((r) => {
          const ok = r.test(password);
          return (
            <li key={r.id} className={`flex items-center gap-1.5 text-xs transition-colors ${ok ? "text-green-600" : "text-slate-400"}`}>
              <span className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-white text-[9px] font-bold flex-shrink-0 ${ok ? "bg-green-500" : "bg-slate-300"}`}>
                {ok ? "✓" : "·"}
              </span>
              {r.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
