import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { Trash2 } from 'lucide-react';
import { IconButton } from '../components/ui';
import { t } from '../lib/i18n';

/** Versteckte Notiz: Kopfzeile mit Beschriftung und Löschen; der Text bleibt aus Manuskript, Wortzahl und KI heraus. */
export function NoteView({ deleteNode }: NodeViewProps) {
  return (
    <NodeViewWrapper className="note-node">
      <div contentEditable={false} className="mb-1 flex items-center gap-2 font-sans select-none">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
          {t('Note · not part of the manuscript')}
        </span>
        <IconButton
          title={t('Delete note')}
          className="ml-auto size-6 text-sky-600/80 hover:bg-red-50 hover:text-red-600 dark:text-sky-400/80 dark:hover:bg-red-950/40"
          onClick={() => deleteNode()}
        >
          <Trash2 className="size-3.5" />
        </IconButton>
      </div>
      <NodeViewContent />
    </NodeViewWrapper>
  );
}
