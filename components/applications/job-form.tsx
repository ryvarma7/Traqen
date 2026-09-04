"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { useForm, type Path, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ExtensibleSelect } from "@/components/applications/extensible-select";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  addDropdownOption,
  deleteJobApplication,
  saveJobApplication,
} from "@/lib/actions/applications";
import { JOB_STATUSES, PRIORITIES, type JobApplication } from "@/lib/types";

const url = z.union([z.literal(""), z.string().url("Enter a valid URL")]);

const schema = z.object({
  company: z.string().min(1, "Company is required"),
  role_type: z.string().optional(),
  status: z.string(),
  stage_detail: z.string().optional(),
  priority: z.string(),
  location_mode: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  deadline: z.string().optional(),
  applied_date: z.string().optional(),
  follow_up_date: z.string().optional(),
  application_link: url.optional(),
  source: z.string().optional(),
  contact_person: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function JobForm({
  item,
  customOptions,
  onClose,
}: {
  item: JobApplication | null;
  customOptions: Record<string, string[]>;
  onClose: () => void;
}) {
  const [error, setError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      company: item?.company ?? "",
      role_type: item?.role_type ?? "",
      status: item?.status ?? "Saved",
      stage_detail: item?.stage_detail ?? "",
      priority: item?.priority ?? "Medium",
      location_mode: item?.location_mode ?? "",
      start_date: item?.start_date ?? "",
      end_date: item?.end_date ?? "",
      deadline: item?.deadline ?? "",
      applied_date: item?.applied_date ?? "",
      follow_up_date: item?.follow_up_date ?? "",
      application_link: item?.application_link ?? "",
      source: item?.source ?? "",
      contact_person: item?.contact_person ?? "",
      notes: item?.notes ?? "",
    },
  });

  const onSubmit = async (data: FormData) => {
    setError(null);
    const result = await saveJobApplication(data, item?.id);
    if (result.error) {
      setError(result.error);
      return;
    }
    toast.success(item ? "Application updated" : "Application added");
    onClose();
  };

  const remove = async () => {
    if (!item) return;
    const result = await deleteJobApplication(item.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Application deleted");
    onClose();
  };

  const add = (field: string) => (value: string) =>
    addDropdownOption("jobs", field, value);

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
        <Label htmlFor="company">Company *</Label>
        <Input id="company" placeholder="Acme Inc." {...register("company")} />
        <FormError message={errors.company?.message ?? null} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ExtensibleSelect
          name="role_type"
          label="Role type"
          control={control}
          options={customOptions.role_type ?? []}
          placeholder="e.g. Frontend Intern"
          onAddOption={add("role_type")}
        />
        <div className="space-y-1.5">
          <Label htmlFor="status">Status</Label>
          <Select id="status" {...register("status")}>
            {JOB_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="stage_detail">Stage detail</Label>
          <Input id="stage_detail" placeholder="e.g. Round 2, take-home" {...register("stage_detail")} />
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

      <ExtensibleSelect
        name="location_mode"
        label="Location mode"
        control={control}
        options={customOptions.location_mode ?? []}
        placeholder="e.g. Remote, Hybrid"
        onAddOption={add("location_mode")}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DateField id="deadline" label="Deadline" register={register} />
        <DateField id="follow_up_date" label="Follow-up date" register={register} />
        <DateField id="applied_date" label="Applied date" register={register} />
        <DateField id="start_date" label="Start date" register={register} />
        <DateField id="end_date" label="End date" register={register} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="application_link">Application link</Label>
        <Input id="application_link" placeholder="https://…" {...register("application_link")} />
        <FormError message={errors.application_link?.message ?? null} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ExtensibleSelect
          name="source"
          label="Source"
          control={control}
          options={customOptions.source ?? []}
          placeholder="e.g. LinkedIn, referral"
          onAddOption={add("source")}
        />
        <div className="space-y-1.5">
          <Label htmlFor="contact_person">Contact person</Label>
          <Input id="contact_person" {...register("contact_person")} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" rows={3} {...register("notes")} />
      </div>

      <FormError message={error} />

      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" size="lg" className="flex-1" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : item ? "Save changes" : "Add application"}
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

function DateField({
  id,
  label,
  register,
}: {
  id: Path<FormData>;
  label: string;
  register: UseFormRegister<FormData>;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="date" className="font-mono text-xs" {...register(id)} />
    </div>
  );
}
