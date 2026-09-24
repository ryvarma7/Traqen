"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

const ADD_NEW = "__add_new__";

/** Dropdown field whose options come from defaults + user-saved
 *  dropdown_options, plus an inline "+ Add new" input. */
export function ExtensibleSelect<T extends FieldValues>({
  name,
  label,
  control,
  options,
  placeholder = "Select…",
  onAddOption,
}: {
  name: Path<T>;
  label: string;
  control: Control<T>;
  options: string[];
  placeholder?: string;
  onAddOption: (value: string) => Promise<{ error?: string }>;
}) {
  const [adding, setAdding] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <div className="space-y-1.5">
          <Label htmlFor={name}>{label}</Label>
          <Select
            id={name}
            value={adding ? ADD_NEW : field.value ?? ""}
            onChange={async (e) => {
              if (e.target.value === ADD_NEW) {
                setAdding(true);
                requestAnimationFrame(() =>
                  inputRef.current?.focus({ preventScroll: true })
                );
              } else {
                field.onChange(e.target.value);
              }
            }}
          >
            <option value="">{placeholder}</option>
            {options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
            <option value={ADD_NEW}>+ Add new</option>
          </Select>

          <div className="overflow-hidden">
            <AnimatePresence initial={false}>
              {adding && (
                <motion.div
                  initial={{ opacity: 0, y: -6, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -6, height: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="mt-2"
                >
                  <div className="rounded-field border border-white/10 bg-white/[0.02] p-2.5">
                    <div className="flex items-center gap-2">
                      <Input
                        ref={inputRef}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder={`New ${label.toLowerCase()}`}
                        className="h-10 flex-1"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            save(field.onChange);
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="md"
                        className="h-10 shrink-0"
                        disabled={saving || !draft.trim()}
                        onClick={() => save(field.onChange)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="mt-2 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="md"
                        className="h-8 px-2.5 text-xs"
                        onClick={cancel}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    />
  );

  async function save(onChange: (value: string) => void) {
    const value = draft.trim();
    if (!value) return;
    setSaving(true);
    const result = await onAddOption(value);
    setSaving(false);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Option added");
    onChange(value);
    setAdding(false);
    setDraft("");
  }

  function cancel() {
    setDraft("");
    setAdding(false);
  }
}
