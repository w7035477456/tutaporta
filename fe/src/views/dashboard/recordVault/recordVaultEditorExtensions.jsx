import StarterKit from '@tiptap/starter-kit';
import { CharacterCount, Focus, Placeholder } from '@tiptap/extensions';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import {
  TextStyle,
  Color,
  BackgroundColor,
  FontFamily,
  FontSize,
  LineHeight
} from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details';
import Youtube from '@tiptap/extension-youtube';
import Mention from '@tiptap/extension-mention';
import { Emoji, gitHubEmojis } from '@tiptap/extension-emoji';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import TextAlign from '@tiptap/extension-text-align';
import Typography from '@tiptap/extension-typography';
import InvisibleCharacters from '@tiptap/extension-invisible-characters';
import FileHandler from '@tiptap/extension-file-handler';
import { Mathematics } from '@tiptap/extension-mathematics';
import { Markdown } from 'tiptap-markdown';
import { common, createLowlight } from 'lowlight';

import { createSuggestionRender } from './recordVaultEditorSuggestion';
import { RecordVaultResizableImage } from './recordVaultResizableImage';
import { RecordVaultAttachmentNode } from './recordVaultAttachmentNode';
import { RecordVaultSearchHighlight } from './recordVaultSearchHighlight';

const lowlight = createLowlight(common);

/**
 * Default mention directory. Replace with real vault members when wiring a
 * backend data source — the suggestion UI stays the same.
 */
export const RECORD_VAULT_MENTION_ITEMS = [
  { id: 'me', label: 'Me' },
  { id: 'team', label: 'Team' },
  { id: 'everyone', label: 'Everyone' }
];

function insertImageFiles(currentEditor, files, pos) {
  files
    .filter((file) => file.type.startsWith('image/'))
    .forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        currentEditor
          .chain()
          .insertContentAt(pos ?? currentEditor.state.selection.anchor, {
            type: 'image',
            attrs: { src: reader.result }
          })
          .focus()
          .run();
      };
      reader.readAsDataURL(file);
    });
}

/** All FREE TipTap extensions wired for the Record Vault note editor. */
export function buildRecordVaultEditorExtensions() {
  return [
    StarterKit.configure({
      codeBlock: false, // replaced by CodeBlockLowlight for syntax highlighting
      link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      heading: { levels: [1, 2, 3, 4] },
      // Bold red drop indicator so it's obvious where a dragged photo will land.
      dropcursor: { color: '#e60000', width: 4, class: 'rv-dropcursor' }
    }),

    // Text style + color family
    TextStyle,
    Color,
    BackgroundColor,
    FontFamily,
    FontSize,
    LineHeight,

    // Marks
    Highlight.configure({ multicolor: true }),
    Subscript,
    Superscript,

    // Lists
    TaskList,
    TaskItem.configure({ nested: true }),

    // Rich nodes
    CodeBlockLowlight.configure({ lowlight }),
    RecordVaultResizableImage.configure({ inline: false, allowBase64: true }),
    RecordVaultAttachmentNode,
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    Details.configure({ persist: true }),
    DetailsSummary,
    DetailsContent,
    Youtube.configure({ nocookie: true, controls: true }),
    Mathematics,

    // Mention (@)
    Mention.configure({
      HTMLAttributes: { class: 'rv-mention' },
      suggestion: {
        char: '@',
        items: ({ query }) =>
          RECORD_VAULT_MENTION_ITEMS.filter((item) =>
            item.label.toLowerCase().startsWith(query.toLowerCase())
          ).slice(0, 8),
        render: createSuggestionRender({
          renderItem: (item) => item.label,
          toCommandProps: (item) => ({ id: item.id, label: item.label })
        })
      }
    }),

    // Emoji (:)
    Emoji.configure({
      emojis: gitHubEmojis,
      enableEmoticons: true,
      suggestion: {
        char: ':',
        items: ({ query }) => {
          const q = query.toLowerCase();
          if (!q) return gitHubEmojis.slice(0, 12);
          return gitHubEmojis
            .filter((e) => e.shortcodes.some((s) => s.startsWith(q)) || e.tags.some((t) => t.startsWith(q)))
            .slice(0, 12);
        },
        render: createSuggestionRender({
          renderItem: (item) => `${item.fallbackImage ? '' : item.emoji ?? ''} :${item.name}:`,
          toCommandProps: (item) => ({ name: item.name })
        })
      }
    }),

    // Markdown import/export (community package). `html: true` keeps a lossless
    // HTML fallback for rich nodes markdown can't represent (colors, mentions,
    // math, resizable images, details, etc.). Read back with
    // editor.storage.markdown.getMarkdown(); import by passing a markdown string
    // to editor.commands.setContent(...).
    Markdown.configure({
      html: true,
      tightLists: true,
      bulletListMarker: '-',
      linkify: false,
      breaks: false,
      transformPastedText: true,
      transformCopiedText: false
    }),

    // Functionality
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Typography,
    InvisibleCharacters.configure({ visible: false }),
    CharacterCount,
    RecordVaultSearchHighlight,
    Focus.configure({ className: 'has-focus', mode: 'all' }),
    Placeholder.configure({ placeholder: 'Start writing your note…' }),
    FileHandler.configure({
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
      // OS file drops onto the content pane are handled by the workspace as
      // vault attachments (html/pdf/docx/mp4/png/jpg/…). Paste still inserts
      // inline images here.
      onPaste: (currentEditor, files) => insertImageFiles(currentEditor, files)
    })
  ];
}
