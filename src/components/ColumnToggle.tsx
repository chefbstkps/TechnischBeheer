import { useState, useEffect, useRef } from 'react';
import './ColumnToggle.css';

export interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
}

interface ColumnToggleProps {
  columns: ColumnConfig[];
  onToggle: (key: string, visible: boolean) => void;
}

export default function ColumnToggle({ columns, onToggle }: ColumnToggleProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="column-toggle" ref={ref}>
      <button
        type="button"
        className="column-toggle-btn"
        onClick={() => setOpen(!open)}
      >
        Kolommen
      </button>
      {open && (
        <div className="column-toggle-dropdown">
          {columns.map((col) => (
            <label key={col.key} className="column-toggle-item app-switch-field">
              <span>{col.label}</span>
              <span className="app-switch-control">
                <input
                  type="checkbox"
                  checked={col.visible}
                  onChange={(e) => onToggle(col.key, e.target.checked)}
                />
                <span className="app-switch-slider" aria-hidden="true" />
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
