import PropTypes from 'prop-types';
import { useEditorState } from '@tiptap/react';
import { themedPrompt } from 'utils/themedDialog';

const FONT_FAMILIES = [
  { label: 'Default', value: '' },
  { label: 'Sans', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Serif', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Mono', value: '"Courier New", monospace' },
  { label: 'Comic', value: '"Comic Sans MS", "Comic Neue", cursive' }
];

const FONT_SIZES = ['', '12px', '14px', '16px', '18px', '24px', '32px', '48px'];
const LINE_HEIGHTS = ['', '1', '1.15', '1.5', '2'];

function Btn({ onClick, active, disabled, title, children }) {
  return (
    <button
      type="button"
      className={`rv-tb__btn${active ? ' is-active' : ''}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
    >
      {children}
    </button>
  );
}

Btn.propTypes = {
  onClick: PropTypes.func,
  active: PropTypes.bool,
  disabled: PropTypes.bool,
  title: PropTypes.string,
  children: PropTypes.node
};

export default function PhotoAlbumsEditorToolbar({ editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return null;
      return {
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
        isBold: e.isActive('bold'),
        isItalic: e.isActive('italic'),
        isUnderline: e.isActive('underline'),
        isStrike: e.isActive('strike'),
        isCode: e.isActive('code'),
        isSub: e.isActive('subscript'),
        isSuper: e.isActive('superscript'),
        isHighlight: e.isActive('highlight'),
        isLink: e.isActive('link'),
        isBulletList: e.isActive('bulletList'),
        isOrderedList: e.isActive('orderedList'),
        isTaskList: e.isActive('taskList'),
        isBlockquote: e.isActive('blockquote'),
        isCodeBlock: e.isActive('codeBlock'),
        isDetails: e.isActive('details'),
        alignLeft: e.isActive({ textAlign: 'left' }),
        alignCenter: e.isActive({ textAlign: 'center' }),
        alignRight: e.isActive({ textAlign: 'right' }),
        alignJustify: e.isActive({ textAlign: 'justify' }),
        heading:
          [1, 2, 3, 4].find((l) => e.isActive('heading', { level: l })) ?? 0
      };
    }
  });

  if (!editor || !s) return null;

  const chain = () => editor.chain().focus();

  const onHeading = (value) => {
    const level = Number(value);
    if (!level) chain().setParagraph().run();
    else chain().toggleHeading({ level }).run();
  };

  const promptLink = async () => {
    const prev = editor.getAttributes('link').href || '';
    const url = await themedPrompt('Link URL', prev);
    if (url === null) return;
    if (url === '') {
      chain().extendMarkRange('link').unsetLink().run();
      return;
    }
    chain().extendMarkRange('link').setLink({ href: url }).run();
  };

  const promptImage = async () => {
    const url = await themedPrompt('Image URL');
    if (url) chain().setImage({ src: url }).run();
  };

  const promptYoutube = async () => {
    const url = await themedPrompt('YouTube URL');
    if (url) chain().setYoutubeVideo({ src: url }).run();
  };

  const promptMath = async () => {
    const latex = await themedPrompt('LaTeX (e.g. E = mc^2)');
    if (latex) chain().insertInlineMath({ latex }).run();
  };

  return (
    <div className="rv-tb" role="toolbar" aria-label="Editor toolbar">
      <div className="rv-tb__group">
        <Btn title="Undo" disabled={!s.canUndo} onClick={() => chain().undo().run()}>
          ↶
        </Btn>
        <Btn title="Redo" disabled={!s.canRedo} onClick={() => chain().redo().run()}>
          ↷
        </Btn>
      </div>

      <div className="rv-tb__group">
        <select
          className="rv-tb__select"
          title="Paragraph style"
          value={s.heading}
          onChange={(e) => onHeading(e.target.value)}
        >
          <option value={0}>Paragraph</option>
          <option value={1}>Heading 1</option>
          <option value={2}>Heading 2</option>
          <option value={3}>Heading 3</option>
          <option value={4}>Heading 4</option>
        </select>
        <select
          className="rv-tb__select"
          title="Font family"
          onChange={(e) =>
            e.target.value ? chain().setFontFamily(e.target.value).run() : chain().unsetFontFamily().run()
          }
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <select
          className="rv-tb__select"
          title="Font size"
          onChange={(e) =>
            e.target.value ? chain().setFontSize(e.target.value).run() : chain().unsetFontSize().run()
          }
        >
          {FONT_SIZES.map((v) => (
            <option key={v || 'default'} value={v}>
              {v || 'Size'}
            </option>
          ))}
        </select>
        <select
          className="rv-tb__select"
          title="Line height"
          onChange={(e) =>
            e.target.value ? chain().setLineHeight(e.target.value).run() : chain().unsetLineHeight().run()
          }
        >
          {LINE_HEIGHTS.map((v) => (
            <option key={v || 'default'} value={v}>
              {v ? `↕ ${v}` : '↕'}
            </option>
          ))}
        </select>
      </div>

      <div className="rv-tb__group">
        <Btn title="Bold" active={s.isBold} onClick={() => chain().toggleBold().run()}>
          <b>B</b>
        </Btn>
        <Btn title="Italic" active={s.isItalic} onClick={() => chain().toggleItalic().run()}>
          <i>I</i>
        </Btn>
        <Btn title="Underline" active={s.isUnderline} onClick={() => chain().toggleUnderline().run()}>
          <u>U</u>
        </Btn>
        <Btn title="Strikethrough" active={s.isStrike} onClick={() => chain().toggleStrike().run()}>
          <s>S</s>
        </Btn>
        <Btn title="Inline code" active={s.isCode} onClick={() => chain().toggleCode().run()}>
          {'</>'}
        </Btn>
        <Btn title="Subscript" active={s.isSub} onClick={() => chain().toggleSubscript().run()}>
          x₂
        </Btn>
        <Btn title="Superscript" active={s.isSuper} onClick={() => chain().toggleSuperscript().run()}>
          x²
        </Btn>
      </div>

      <div className="rv-tb__group">
        <label className="rv-tb__color" title="Text color">
          <span>A</span>
          <input type="color" onChange={(e) => chain().setColor(e.target.value).run()} />
        </label>
        <label className="rv-tb__color" title="Highlight color">
          <span className="rv-tb__hl">A</span>
          <input
            type="color"
            defaultValue="#fff176"
            onChange={(e) => chain().toggleHighlight({ color: e.target.value }).run()}
          />
        </label>
        <label className="rv-tb__color" title="Background color">
          <span className="rv-tb__bg">A</span>
          <input type="color" onChange={(e) => chain().setBackgroundColor(e.target.value).run()} />
        </label>
        <Btn
          title="Clear color / highlight"
          onClick={() => chain().unsetColor().unsetBackgroundColor().unsetHighlight().run()}
        >
          ⌫
        </Btn>
      </div>

      <div className="rv-tb__group">
        <Btn title="Bullet list" active={s.isBulletList} onClick={() => chain().toggleBulletList().run()}>
          •≡
        </Btn>
        <Btn title="Ordered list" active={s.isOrderedList} onClick={() => chain().toggleOrderedList().run()}>
          1.≡
        </Btn>
        <Btn title="Task list" active={s.isTaskList} onClick={() => chain().toggleTaskList().run()}>
          ☑≡
        </Btn>
      </div>

      <div className="rv-tb__group">
        <Btn title="Blockquote" active={s.isBlockquote} onClick={() => chain().toggleBlockquote().run()}>
          ❝
        </Btn>
        <Btn title="Code block" active={s.isCodeBlock} onClick={() => chain().toggleCodeBlock().run()}>
          {'{ }'}
        </Btn>
        <Btn title="Horizontal rule" onClick={() => chain().setHorizontalRule().run()}>
          ―
        </Btn>
        <Btn title="Details / collapsible" active={s.isDetails} onClick={() => chain().setDetails().run()}>
          ▸▾
        </Btn>
      </div>

      <div className="rv-tb__group">
        <Btn title="Align left" active={s.alignLeft} onClick={() => chain().setTextAlign('left').run()}>
          ⯇
        </Btn>
        <Btn title="Align center" active={s.alignCenter} onClick={() => chain().setTextAlign('center').run()}>
          ≡
        </Btn>
        <Btn title="Align right" active={s.alignRight} onClick={() => chain().setTextAlign('right').run()}>
          ⯈
        </Btn>
        <Btn
          title="Justify"
          active={s.alignJustify}
          onClick={() => chain().setTextAlign('justify').run()}
        >
          ☰
        </Btn>
      </div>

      <div className="rv-tb__group">
        <Btn title="Link" active={s.isLink} onClick={promptLink}>
          🔗
        </Btn>
        <Btn title="Image" onClick={promptImage}>
          🖼
        </Btn>
        <Btn title="YouTube" onClick={promptYoutube}>
          ▶
        </Btn>
        <Btn title="Inline math" onClick={promptMath}>
          √x
        </Btn>
        <Btn title="Emoji (type :)" onClick={() => chain().insertContent(':').run()}>
          😊
        </Btn>
        <Btn title="Mention (type @)" onClick={() => chain().insertContent('@').run()}>
          @
        </Btn>
      </div>

      <div className="rv-tb__group">
        <Btn title="Insert table" onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
          ▦
        </Btn>
        <Btn title="Add column" onClick={() => chain().addColumnAfter().run()}>
          ▯+
        </Btn>
        <Btn title="Add row" onClick={() => chain().addRowAfter().run()}>
          ▭+
        </Btn>
        <Btn title="Delete column" onClick={() => chain().deleteColumn().run()}>
          ▯✕
        </Btn>
        <Btn title="Delete row" onClick={() => chain().deleteRow().run()}>
          ▭✕
        </Btn>
        <Btn title="Delete table" onClick={() => chain().deleteTable().run()}>
          ▦✕
        </Btn>
      </div>

      <div className="rv-tb__group">
        <Btn title="Toggle invisible characters" onClick={() => chain().toggleInvisibleCharacters().run()}>
          ¶
        </Btn>
        <Btn
          title="Clear formatting"
          onClick={() => chain().unsetAllMarks().clearNodes().run()}
        >
          ✗
        </Btn>
      </div>
    </div>
  );
}

PhotoAlbumsEditorToolbar.propTypes = {
  editor: PropTypes.object
};
