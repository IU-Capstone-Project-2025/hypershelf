import { useEffect, useRef } from "react";

type GlobalKeySequenceListenerProps = {
  onMatch: () => void;
};

export function GlobalKeySequenceListener({
  onMatch
}: GlobalKeySequenceListenerProps) {
  const buffer = useRef<string>("");

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          (active as HTMLElement).isContentEditable)
      ) {
        return;
      }

      const char = e.key.length === 1 ? e.key : "";
      if (!char) return;

      buffer.current += char.toLowerCase();
      buffer.current = buffer.current.slice(-6);

      if (buffer.current === "galina") {
        onMatch();
        buffer.current = "";
      }
    };

    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [onMatch]);

  return null;
}
