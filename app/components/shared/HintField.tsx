"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type ReactElement,
  type ReactNode,
} from "react";
import type { HintCopy } from "@/lib/yard/hints";

const WRAP = "group/hint relative z-0 flex flex-col gap-1 hover:z-40 focus-within:z-40";
const LABEL = "w-fit cursor-help border-b border-dotted border-zinc-600 text-xs text-zinc-500 max-sm:text-sm";

type ControlProps = { id?: string; "aria-describedby"?: string };

function isControl(child: ReactNode): child is ReactElement<ControlProps> {
  return isValidElement(child) && (child.type === "input" || child.type === "select" || child.type === "textarea");
}

export function HintBubble({ id, hint, example }: { id: string } & HintCopy) {
  return (
    <span
      id={id}
      role="tooltip"
      className="pointer-events-none invisible absolute left-0 top-full z-30 mt-1 w-[min(20rem,100%)] rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-left text-xs leading-relaxed text-zinc-300 opacity-0 shadow-lg group-hover/hint:visible group-hover/hint:opacity-100 group-focus-within/hint:visible group-focus-within/hint:opacity-100"
    >
      {hint}
      {example
        ? (
            <>
              {"\n"}
              <span className="mt-1.5 block break-all font-mono text-[11px] text-zinc-500">
                e.g. {example}
              </span>
            </>
          )
        : null}
    </span>
  );
}

export function HintField({
  label,
  hint,
  example,
  aside,
  className = "",
  children,
}: {
  label: string;
  hint: string;
  example?: string;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const inputId = useId();
  const tipId = useId();
  return (
    <div className={`${WRAP} ${className}`}>
      <span className="inline-flex flex-wrap items-baseline gap-x-2">
        <label htmlFor={inputId} className={LABEL}>
          {label}
        </label>
        {aside}
      </span>
      {Children.map(children, (child) => {
        if (!isControl(child)) {
          return child;
        }
        const described = [child.props["aria-describedby"], tipId].filter(Boolean).join(" ");
        return cloneElement(child, { id: child.props.id ?? inputId, "aria-describedby": described });
      })}
      <HintBubble id={tipId} hint={hint} example={example} />
    </div>
  );
}

export function HintLegend({
  label,
  hint,
  example,
  className = "",
  children,
}: {
  label: string;
  hint: string;
  example?: string;
  className?: string;
  children: ReactNode;
}) {
  const tipId = useId();
  return (
    <fieldset className={`${WRAP} ${className}`} aria-describedby={tipId}>
      <legend className={LABEL}>{label}</legend>
      {children}
      <HintBubble id={tipId} hint={hint} example={example} />
    </fieldset>
  );
}
