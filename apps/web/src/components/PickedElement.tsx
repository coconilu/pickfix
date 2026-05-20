"use client";

import type { ElementMeta } from "@/lib/bridge-protocol";

interface PickedElementProps {
  element: ElementMeta;
  onRemove: () => void;
}

export function PickedElement({ element, onRemove }: PickedElementProps) {
  return (
    <div className="picked-element">
      <div className="picked-element-header">
        <span className="picked-element-tag">&lt;{element.tag}&gt;</span>
        <button
          className="picked-element-remove"
          onClick={onRemove}
          title="Remove from context"
          aria-label="Remove element"
        >
          ×
        </button>
      </div>
      {element.classes && (
        <div className="picked-element-classes">
          {element.classes.split(/\s+/).map((cls, i) => (
            <span key={i} className="picked-element-class-chip">
              .{cls}
            </span>
          ))}
        </div>
      )}
      <div className="picked-element-text">"{element.text}"</div>
      <div className="picked-element-selector" title={element.selector}>
        {element.selector || "(no unique selector)"}
      </div>
    </div>
  );
}
