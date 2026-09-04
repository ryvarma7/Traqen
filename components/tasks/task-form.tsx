"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { deleteTask, saveTask } from "@/lib/actions/tasks";
import { PRIORITIES, TASK_STATUSES, type Task } from "@/lib/types";

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  status: z.enum(["To do", "In progress", "Done"]),
  priority: z.string(),
  due_date: z.string().optional(),
  category: z.string().optional(),
  related_type: z.string().optional(),
  related_id: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export type LinkableItem = {
  id: string;
  label: string;
  type: "job" | "hackathon";
};

export function TaskForm({
  item,
  linkables,
  onClose,
}: {
  item: Task | null;
  linkables: LinkableItem[];
  onClose: () => void;
}) {
  const [error, setError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: item?.title ?? "",
      description: item?.description ?? "",
      status: item?.status ?? "To do",
      priority: item?.priority ?? "Medium",
      due_date: item?.due_date ?? "",
      category: item?.category ?? "",
      related_type: item?.related_type ?? "",
      related_id: item?.related_id ?? "",
    },
  });

  const relatedType = watch("related_type");

  const onSubmit = async (data: FormData) => {
    setError(null);
    const result = await saveTask(data, item?.id);
    if (result.error) {
      setError(result.error);
      return;
    }
    toast.success(item ? "Task updated" : "Task added");
    onClose();
  };

  const remove = async () => {
    if (!item) return;
    const result = await deleteTask(item.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Task deleted");
    onClose();
  };

  return (
    <motion.form
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15, delay: 0.05 }}
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 pt-3"
      noValidate
    >
      <div className="space-y-1.5">
        <Label htmlFor="title">Title *</Label>
        <Input id="title" placeholder="What needs doing?" {...register("title")} />
        <FormError message={errors.title?.message ?? null} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={2} {...register("description")} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="status">Status</Label>
          <Select id="status" {...register("status")}>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="priority">Priority</Label>
          <Select id="priority" {...register("priority")}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="due_date">Due date</Label>
          <Input id="due_date" type="date" className="font-mono text-xs" {...register("due_date")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="category">Category</Label>
          <Input id="category" placeholder="e.g. Prep, Admin" {...register("category")} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="related_type">Link to application (optional)</Label>
        <Select
          id="related_type"
          value={relatedType ?? ""}
          onChange={(e) => {
            setValue("related_type", e.target.value);
            setValue("related_id", "");
          }}
        >
          <option value="">Not linked</option>
          <option value="job">Job application</option>
          <option value="hackathon">Hackathon</option>
        </Select>
      </div>

      {relatedType && (
        <div className="space-y-1.5">
          <Label htmlFor="related_id">Which one?</Label>
          <Select id="related_id" {...register("related_id")}>
            <option value="">Select…</option>
            {linkables
              .filter((l) => l.type === relatedType)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
          </Select>
        </div>
      )}

      <FormError message={error} />

      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" size="lg" className="flex-1" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : item ? "Save changes" : "Add task"}
        </Button>
        {item && (
          <Button type="button" variant="outline" size="lg" onClick={remove}>
            Delete
          </Button>
        )}
      </div>
    </motion.form>
  );
}
