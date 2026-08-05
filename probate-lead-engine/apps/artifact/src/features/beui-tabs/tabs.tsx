import { useEffect, useRef, useState, type KeyboardEvent } from "react";

interface BeuiTabDefinition {
  id: string;
  label: string;
  disabled?: boolean;
}

interface BeuiTabsProps {
  tabs: readonly BeuiTabDefinition[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  ariaLabel: string;
  panelId?: string;
}

function BeuiTabs({
  tabs,
  value,
  defaultValue,
  onValueChange,
  ariaLabel,
  panelId,
}: BeuiTabsProps) {
  const firstTab = tabs.find((tab) => !tab.disabled)?.id ?? "";
  const [internalValue, setInternalValue] = useState(defaultValue ?? firstTab);
  const activeValue = value ?? internalValue;
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    if (tabs.some((tab) => tab.id === activeValue && !tab.disabled)) return;
    if (firstTab && firstTab !== activeValue) {
      if (value === undefined) setInternalValue(firstTab);
      onValueChange?.(firstTab);
    }
  }, [activeValue, firstTab, onValueChange, tabs, value]);

  function selectTab(nextValue: string) {
    const next = tabs.find((tab) => tab.id === nextValue);
    if (!next || next.disabled) return;
    if (value === undefined) setInternalValue(nextValue);
    onValueChange?.(nextValue);
  }

  function moveFocus(currentValue: string, direction: 1 | -1 | 0) {
    const enabled = tabs.filter((tab) => !tab.disabled);
    const currentIndex = Math.max(0, enabled.findIndex((tab) => tab.id === currentValue));
    const nextIndex = direction === 0
      ? direction
      : (currentIndex + direction + enabled.length) % enabled.length;
    const next = enabled[nextIndex];
    if (!next) return;
    tabRefs.current[next.id]?.focus({ preventScroll: true });
    selectTab(next.id);
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentValue: string) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      moveFocus(currentValue, 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      moveFocus(currentValue, -1);
    } else if (event.key === "Home") {
      event.preventDefault();
      moveFocus(currentValue, 0);
    } else if (event.key === "End") {
      event.preventDefault();
      const enabled = tabs.filter((tab) => !tab.disabled);
      const last = enabled[enabled.length - 1];
      if (last) {
        tabRefs.current[last.id]?.focus({ preventScroll: true });
        selectTab(last.id);
      }
    }
  }

  return (
    <div className="beui-tabs" data-beui-tabs="true">
      <div className="beui-tabs-list" role="tablist" aria-label={ariaLabel}>
        {tabs.map((tab) => {
          const selected = tab.id === activeValue;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                tabRefs.current[tab.id] = node;
              }}
              type="button"
              role="tab"
              id={`${panelId ?? ariaLabel.replace(/\s+/g, "-").toLowerCase()}-${tab.id}-tab`}
              aria-selected={selected}
              aria-controls={panelId ? `${panelId}-${tab.id}` : undefined}
              tabIndex={selected ? 0 : -1}
              disabled={tab.disabled}
              data-beui-tab={tab.id}
              data-state={selected ? "active" : "inactive"}
              onClick={() => selectTab(tab.id)}
              onKeyDown={(event) => onTabKeyDown(event, tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { BeuiTabs };
export type { BeuiTabDefinition, BeuiTabsProps };
