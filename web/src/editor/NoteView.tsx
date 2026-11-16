import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { Trash2 } from 'lucide-react';
import { IconButton } from '../components/ui';
import { t } from '../lib/i18n';

/** Versteckte Notiz: Kopfzeile wie beim Beat, Löschen erst beim Überfahren; der Text bleibt aus Manuskript, Wortzahl und KI heraus. */
export function NoteView({ deleteNode }: NodeViewProps) {
  return (
    <NodeViewWrapper className="note-node group/note">
      <div contentEditable={false} className="flex items-center gap-2 border-b border-sky-200/80 px-2 py-1 select-none dark:border-sky-800/50">
        <span className="rounded bg-sky-200 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-sky-900 uppercase dark:bg-sky-800 dark:text-sky-100">
          {t('Note · not part of the manuscript')}
        </span>
        <IconButton
          title={t('Delete note')}
          className="ml-auto size-6 opacity-0 group-hover/note:opacity-100"
          onClick={() => deleteNode()}
        >
          <Trash2 className="size-3.5" />
        </IconButton>
      </div>
      <NodeViewContent className="note-content" />
    </NodeViewWrapper>
  );
}
