/*
https://github.com/hikariatama/hypershelf
Copyright (C) 2025  Daniil Gazizullin

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/
import { syntaxTree } from "@codemirror/language";
import { RangeSet, StateField } from "@codemirror/state";
import { Decoration, EditorView, WidgetType } from "@codemirror/view";

import markdoc from "@markdoc/markdoc";

import type { EditorState, Range } from "@codemirror/state";
import type { DecorationSet } from "@codemirror/view";
import type { Config } from "@markdoc/markdoc";
import { previewModeFacet } from "./preview-facet";
import { DynamicIcon, IconName } from "lucide-react/dynamic";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";

const mimeCache = new Map<string, string>();
const fileNameCache = new Map<string, string>();
let metaPressed = false;
let listenersInitialized = false;

function initializeKeyListeners() {
  if (listenersInitialized) return;
  listenersInitialized = true;

  window.addEventListener("keydown", e => {
    if (e.metaKey || e.ctrlKey) metaPressed = true;
  });
  window.addEventListener("keyup", e => {
    if (!e.metaKey && !e.ctrlKey) metaPressed = false;
  });
}

const patternTag =
  /{%\s*(?<closing>\/)?(?<tag>[a-zA-Z0-9-_]+)(?<attrs>\s+[^]+)?\s*(?<self>\/)?%}\s*$/m;

class RenderBlockWidget extends WidgetType {
  rendered: string;

  constructor(
    public source: string,
    config: Config
  ) {
    super();

    const document = markdoc.parse(source);
    const transformed = markdoc.transform(document, config);
    this.rendered = markdoc.renderers.html(transformed);
  }

  eq(widget: RenderBlockWidget): boolean {
    return widget.source === widget.source;
  }

  toDOM(): HTMLElement {
    const content = document.createElement("div");
    content.setAttribute("contenteditable", "false");
    content.className = "cm-markdoc-renderBlock";
    content.innerHTML = this.rendered;
    return content;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

function guessIcon(mime: string | null): string {
  if (!mime) return "file";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "file-audio";
  if (mime.startsWith("video/")) return "file-video";
  if (mime === "application/pdf") return "file-text";
  if (mime === "application/zip" || mime.includes("compressed"))
    return "file-archive";
  return "file";
}

class EmbedWidget extends WidgetType {
  constructor(private readonly src: string) {
    super();
  }

  eq(other: EmbedWidget) {
    return this.src === other.src;
  }

  private attachCommonHandlers(el: HTMLElement, view: EditorView) {
    el.addEventListener("click", event => {
      if (event.metaKey || event.ctrlKey) {
        if (el.tagName.toLowerCase() === "img") {
          window.open(this.src, "_blank");
        } else {
          const a = document.createElement("a");
          a.href = this.src;
          a.rel = "noopener noreferrer";
          a.click();
          a.remove();
        }
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const pos = view.posAtDOM(el);
      let from = pos,
        to = pos;

      syntaxTree(view.state).iterate({
        from: pos,
        to: pos,
        enter(node) {
          if (node.name === "Image") {
            from = node.from;
            to = node.to;
          }
        }
      });

      view.dispatch({ selection: { anchor: from, head: to } });

      syntaxTree(view.state).iterate({
        from: from - 2,
        to: to - 2,
        enter(node) {
          if (node.name === "EmbedTagUrl") {
            view.dispatch({
              selection: { anchor: node.from - 3, head: node.to + 2 }
            });
          }
        }
      });
    });
  }

  private async resolveMeta(): Promise<{
    mime: string | null;
    fileName: string | null;
  }> {
    if (mimeCache.has(this.src) && fileNameCache.has(this.src))
      return {
        mime: mimeCache.get(this.src) ?? null,
        fileName: fileNameCache.get(this.src) ?? null
      };

    try {
      const res = await fetch(this.src, { method: "HEAD" });
      const mime = res.headers.get("Content-Type");
      if (mime) mimeCache.set(this.src, mime);
      const fileName = res.headers.get("Content-Disposition");
      if (fileName) {
        const match = fileName.match(/filename="?([^";]+)"?/);
        if (match && match[1]) {
          fileNameCache.set(this.src, match[1]);
        }
      }
      return {
        mime: mime ?? null,
        fileName: fileNameCache.get(this.src) ?? null
      };
    } catch {
      return {
        mime: null,
        fileName: null
      };
    }
  }

  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "cm-markdoc-embedWrapper";
    wrapper.textContent = "Loading...";

    const renderImage = () => {
      const img = document.createElement("img");
      img.src = this.src;
      img.alt = "Image";
      img.draggable = false;
      img.className = "cm-markdoc-imageWidget";
      img.onerror = () => {
        mimeCache.set(this.src, "application/octet-stream");
        renderFile(
          "application/octet-stream",
          fileNameCache.get(this.src) ?? null
        );
      };
      this.attachCommonHandlers(img, view);
      wrapper.replaceChildren(img);
    };

    const renderFile = (mime: string | null, fileName: string | null) => {
      const block = document.createElement("div");
      block.className = "cm-markdoc-fileWidget";

      const tooltip = document.createElement("div");
      tooltip.className = "cm-markdoc-fileWidgetTooltip";
      tooltip.textContent = "Click to open";
      block.appendChild(tooltip);

      const icon = document.createElement("div");
      const root = createRoot(icon);
      flushSync(() =>
        root.render(
          <DynamicIcon
            name={guessIcon(mime) as IconName}
            className="cm-markdoc-fileWidgetIcon"
            size={24}
          />
        )
      );
      block.appendChild(icon);

      const label = document.createElement("span");
      label.textContent = fileName ?? "File";
      block.appendChild(label);

      const updateTooltip = () => {
        if (metaPressed && block.matches(":hover")) {
          block.classList.add("cm-markdoc-fileWidget-meta");
        } else {
          block.classList.remove("cm-markdoc-fileWidget-meta");
        }
      };

      window.addEventListener("keydown", updateTooltip);
      window.addEventListener("keyup", updateTooltip);
      block.addEventListener("mouseenter", updateTooltip);
      block.addEventListener("mouseleave", () =>
        block.removeAttribute("title")
      );

      this.attachCommonHandlers(block, view);
      wrapper.replaceChildren(block);
    };

    const proceed = (data: {
      mime: string | null;
      fileName: string | null;
    }) => {
      if (data.mime ? data.mime.startsWith("image/") : true) {
        renderImage();
      } else {
        renderFile(data.mime, data.fileName);
      }
    };

    this.resolveMeta().then(proceed);

    return wrapper;
  }

  ignoreEvent() {
    return true;
  }
}

function replaceBlocks(
  state: EditorState,
  config: Config,
  from?: number,
  to?: number
) {
  const decorations: Range<Decoration>[] = [];
  const [cursor] = state.selection.ranges;

  const tags: [number, number][] = [];
  const stack: number[] = [];

  syntaxTree(state).iterate({
    from,
    to,
    enter(node) {
      const inside = cursor.from >= node.from && cursor.to <= node.to;
      const isSelected = state.selection.ranges.some(
        range => node.to >= range.from && node.from <= range.to
      );
      const preview = state.facet(previewModeFacet);

      if (node.name === "EmbedTagUrl") {
        const src = state.doc.sliceString(node.from, node.to).trim();
        const decoration = Decoration.widget({
          widget: new EmbedWidget(src),
          side: 1,
          block: true
        });
        decorations.push(decoration.range(node.to + 2));

        if (
          preview ||
          (!inside &&
            !state.selection.ranges.some(
              range => node.to + 2 >= range.from && node.from - 3 <= range.to
            ))
        ) {
          decorations.push(
            Decoration.mark({ class: "cm-markdoc-hidden" }).range(
              node.from - 3,
              node.to + 2
            )
          );
        }
      }

      if (!["Table", "Blockquote", "MarkdocTag"].includes(node.name)) return;
      if (!preview && (inside || isSelected)) return false;

      if (node.name === "MarkdocTag") {
        const text = state.doc.sliceString(node.from, node.to);
        const match = text.match(patternTag);

        if (match?.groups?.self) {
          tags.push([node.from, node.to]);
          return;
        }

        if (match?.groups?.closing) {
          const last = stack.pop();
          if (last) tags.push([last, node.to]);
          return;
        }

        stack.push(node.from);
        return;
      }

      const text = state.doc.sliceString(node.from, node.to);
      const decoration = Decoration.replace({
        widget: new RenderBlockWidget(text, config),
        block: true
      });
      decorations.push(decoration.range(node.from, node.to));
    }
  });

  for (const [from, to] of tags) {
    if (cursor.from >= from && cursor.to <= to) continue;
    const text = state.doc.sliceString(from, to);
    const decoration = Decoration.replace({
      widget: new RenderBlockWidget(text, config),
      block: true
    });
    decorations.push(decoration.range(from, to));
  }

  return decorations;
}

export default function renderBlock(config: Config) {
  return StateField.define<DecorationSet>({
    create(state) {
      if (!listenersInitialized && typeof window !== "undefined") {
        initializeKeyListeners();
      }
      return RangeSet.of(replaceBlocks(state, config), true);
    },

    update(_, transaction) {
      if (!listenersInitialized && typeof window !== "undefined") {
        initializeKeyListeners();
      }
      return RangeSet.of(replaceBlocks(transaction.state, config), true);
    },

    provide(field) {
      return EditorView.decorations.from(field);
    }
  });
}
