import { Button } from '@/components/ui/button';
import { QUESTION_TYPES } from './FormFieldRenderer';
import { Plus, Type, SeparatorHorizontal, Image } from 'lucide-react';

interface Props {
  onAddQuestion: (type: string) => void;
  onAddSection: () => void;
  onAddTextBlock: () => void;
}

export function FormBuilderSidebar({ onAddQuestion, onAddSection, onAddTextBlock }: Props) {
  return (
    <div className="w-14 flex flex-col items-center gap-1 py-2 border rounded-lg bg-card shadow-sm sticky top-4">
      {/* Add question (opens submenu on hover) */}
      <div className="relative group">
        <Button variant="ghost" size="icon" className="h-10 w-10" title="Adicionar pergunta">
          <Plus className="h-5 w-5" />
        </Button>
        <div className="absolute right-full top-0 hidden group-hover:block z-50 pr-2">
          <div className="bg-popover border rounded-lg shadow-lg p-2 w-48 space-y-1">
            <p className="text-xs font-medium text-muted-foreground px-2 py-1">Tipo de pergunta</p>
            {QUESTION_TYPES.map(qt => (
              <button
                key={qt.value}
                className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent flex items-center gap-2"
                onClick={() => onAddQuestion(qt.value)}
              >
                <span>{qt.icon}</span>
                <span>{qt.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <Button variant="ghost" size="icon" className="h-10 w-10" onClick={onAddTextBlock} title="Título e descrição">
        <Type className="h-5 w-5" />
      </Button>

      <Button variant="ghost" size="icon" className="h-10 w-10" onClick={onAddSection} title="Nova seção">
        <SeparatorHorizontal className="h-5 w-5" />
      </Button>
    </div>
  );
}
