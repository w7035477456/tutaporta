import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { ReactRenderer } from '@tiptap/react';

/**
 * Generic, dependency-free keyboard-navigable dropdown shared by the
 * Mention (@) and Emoji (:) suggestion plugins.
 */
const SuggestionList = forwardRef(function SuggestionList(props, ref) {
  const { items = [], command, renderItem, toCommandProps } = props;
  const [selected, setSelected] = useState(0);

  useEffect(() => setSelected(0), [items]);

  const select = (index) => {
    const item = items[index];
    if (!item) return;
    command(toCommandProps ? toCommandProps(item) : item);
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (!items.length) return false;
      if (event.key === 'ArrowUp') {
        setSelected((s) => (s + items.length - 1) % items.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelected((s) => (s + 1) % items.length);
        return true;
      }
      if (event.key === 'Enter') {
        select(selected);
        return true;
      }
      return false;
    }
  }));

  if (!items.length) {
    return <div className="rv-suggestion rv-suggestion--empty">No result</div>;
  }

  return (
    <div className="rv-suggestion">
      {items.map((item, i) => (
        <button
          type="button"
          key={item.id ?? item.name ?? i}
          className={`rv-suggestion__item${i === selected ? ' is-selected' : ''}`}
          onMouseEnter={() => setSelected(i)}
          onMouseDown={(e) => {
            e.preventDefault();
            select(i);
          }}
        >
          {renderItem(item)}
        </button>
      ))}
    </div>
  );
});

/** Build a TipTap suggestion `render()` that mounts the dropdown near the caret. */
export function createSuggestionRender({ renderItem, toCommandProps }) {
  return () => {
    let component = null;
    let portal = null;

    const position = (props) => {
      const rect = props.clientRect?.();
      if (!portal || !rect) return;
      portal.style.position = 'fixed';
      portal.style.left = `${Math.round(rect.left)}px`;
      portal.style.top = `${Math.round(rect.bottom + 4)}px`;
      portal.style.zIndex = '20000';
    };

    return {
      onStart: (props) => {
        component = new ReactRenderer(SuggestionList, {
          props: { ...props, renderItem, toCommandProps },
          editor: props.editor
        });
        portal = document.createElement('div');
        portal.className = 'rv-suggestion-portal';
        portal.appendChild(component.element);
        document.body.appendChild(portal);
        position(props);
      },
      onUpdate: (props) => {
        component?.updateProps({ ...props, renderItem, toCommandProps });
        position(props);
      },
      onKeyDown: (props) => {
        if (props.event.key === 'Escape') {
          portal?.remove();
          portal = null;
          component?.destroy();
          component = null;
          return true;
        }
        return component?.ref?.onKeyDown(props) ?? false;
      },
      onExit: () => {
        portal?.remove();
        portal = null;
        component?.destroy();
        component = null;
      }
    };
  };
}
