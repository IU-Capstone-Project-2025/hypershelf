import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { GripVertical, Plus, Trash } from "lucide-react";
import React from "react";
import { SortableItem } from "./sortable-item";

interface OptionsInputProps {
  options: string[];
  onChange: (options: string[]) => void;
  disabled?: boolean;
}

export const OptionsInput: React.FC<OptionsInputProps> = ({
  options,
  onChange,
  disabled = false
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = options.indexOf(String(active.id));
      const newIndex = options.indexOf(String(over.id));
      onChange(arrayMove(options, oldIndex, newIndex));
    }
  };

  const addOption = () => onChange([...options, ""]);
  const updateOption = (i: number, v: string) =>
    onChange(options.map((opt, idx) => (idx === i ? v : opt)));
  const removeOption = (i: number) =>
    onChange(options.filter((_, idx) => idx !== i));

  return (
    <div className="flex flex-col gap-2">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={options}
          strategy={verticalListSortingStrategy}
          disabled={disabled}
        >
          {options.map((opt, idx) => (
            <SortableItem key={opt || `opt-${idx}`} id={opt || `opt-${idx}`}>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 cursor-grab"
                  disabled={disabled}
                >
                  <GripVertical className="size-3" />
                </Button>
                <Input
                  value={opt}
                  onChange={e => updateOption(idx, e.target.value)}
                  placeholder="Option"
                  className="h-auto flex-1 py-1 text-xs"
                  disabled={disabled}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeOption(idx)}
                  className="size-7"
                  disabled={disabled}
                >
                  <Trash className="size-3" />
                </Button>
              </div>
            </SortableItem>
          ))}
        </SortableContext>
      </DndContext>

      <Button
        size="sm"
        onClick={addOption}
        className="w-fit"
        disabled={disabled}
      >
        <Plus className="h-4 w-4" /> Add option
      </Button>
    </div>
  );
};
