import React from "react";

export const inputClass =
"w-full rounded-xl bg-white/[0.06] px-3.5 py-2.5 text-sm text-white ring-1 ring-inset ring-white/10 placeholder:text-white/30 transition-shadow duration-150 focus:outline-none focus:ring-white/40";

interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

export function Field({ label, htmlFor, hint, error, children }: FieldProps) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-white/80">
        {label}
      </label>
      {children}
      {error ?
      <p className="mt-1.5 text-xs text-ember" role="alert">
          {error}
        </p> :
      hint ?
      <p className="mt-1.5 text-xs text-white/45">{hint}</p> :
      null}
    </div>);

}