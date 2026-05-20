"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Check } from "lucide-react";

interface SelectProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "value"> {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  placeholder?: string;
}

const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  ({ className, children, value, onChange, disabled, id, placeholder, ...props }, ref) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    // Extract options from children <option> tags
    const options = React.useMemo(() => {
      return React.Children.toArray(children)
        .map((child) => {
          if (React.isValidElement(child) && (child.type === "option" || (child.type as any)?.displayName === "option")) {
            const childProps = child.props as any;
            return {
              value: childProps.value?.toString() ?? "",
              label: childProps.children?.toString() ?? "",
            };
          }
          return null;
        })
        .filter((opt): opt is { value: string; label: string } => opt !== null);
    }, [children]);

    const selectedOption = React.useMemo(() => {
      return options.find((opt) => opt.value === value) || options[0];
    }, [options, value]);

    const label = selectedOption ? selectedOption.label : (placeholder || "Select an option...");

    const handleSelect = (newValue: string) => {
      if (onChange) {
        // Create a synthetic event that mimics HTMLSelectElement change
        const syntheticEvent = {
          target: {
            value: newValue,
            name: id || "",
            id: id || "",
          },
          currentTarget: {
            value: newValue,
            name: id || "",
            id: id || "",
          },
        } as unknown as React.ChangeEvent<HTMLSelectElement>;
        onChange(syntheticEvent);
      }
      setIsOpen(false);
    };

    // Close when clicking outside
    React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, []);

    return (
      <div ref={containerRef} className="relative w-full">
        <button
          ref={ref}
          id={id}
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen((prev) => !prev)}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-border/65 bg-background/55 px-3 py-2 text-sm text-left transition-all dark:text-white text-black outline-hidden",
            "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-0 focus:border-primary/50",
            disabled ? "cursor-not-allowed opacity-50 bg-slate-900/20" : "cursor-pointer hover:bg-background/80 hover:border-white/20",
            isOpen && "border-primary/50 ring-2 ring-primary/20",
            className
          )}
          {...props}
        >
          <span className="truncate pr-2">{label}</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 transition-transform duration-200 text-slate-400",
              isOpen && "rotate-180 text-violet-400"
            )}
          />
        </button>

        {isOpen && !disabled && (
          <div 
            className={cn(
              "absolute left-0 mt-1.5 w-full z-50 rounded-lg border border-white/10 bg-slate-950/95 backdrop-blur-xl shadow-2xl py-1.5 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent",
              "animate-in fade-in-0 zoom-in-95 duration-100 origin-top"
            )}
          >
            {options.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-500 text-center">No options available</div>
            ) : (
              options.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={cn(
                      "flex w-full items-center justify-between px-3 py-2 text-sm text-left transition-colors cursor-pointer text-slate-300",
                      isSelected 
                        ? "bg-violet-600/25 text-violet-200 font-semibold" 
                        : "hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <span className="truncate pr-2">{opt.label}</span>
                    {isSelected && (
                      <Check className="h-4 w-4 text-violet-400 shrink-0 ml-2 animate-in fade-in-0 duration-200" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    );
  }
);
Select.displayName = "Select";

export { Select };
