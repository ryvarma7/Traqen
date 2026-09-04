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
  deleteHackathon,
  saveHackathon,
} from "@/lib/actions/applications";
import { HACKATHON_STATUSES, PRIORITIES, type Hackathon } from "@/lib/types";

const url = z.union([z.literal(""), z.string().url("Enter a valid URL")]);
const optionalNumber = z.union([
  z.literal(""),
  z.coerce.number().int().min(1).max(50),
]);

const schema = z.object({
  hackathon_name: z.string().min(1, "Name is required"),
  organizing_company: z.string().optional(),
  type: z.string().optional(),
  purpose: z.string().optional(),
  theme_track: z.string().optional(),
  track_details: z.string().optional(),
  mode: z.string().optional(),
  team_size: optionalNumber.optional(),
  team_members: z.string().optional(),
  status: z.string(),
  round_detail: z.string().optional(),
  priority: z.string(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  deadline: z.string().optional(),
  applied_date: z.string().optional(),
  follow_up_date: z.string().optional(),
  application_link: url.optional(),
  source: z.string().optional(),
  result_rank: z.string().optional(),
  project_link: url.optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function HackathonForm({
  item,
  customOptions,
  onClose,
}: {
  item: Hackathon | null;
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
      hackathon_name: item?.hackathon_name ?? "",
      organizing_company: item?.organizing_company ?? "",
      type: item?.type ?? "",
      purpose: item?.purpose ?? "",
      theme_track: item?.theme_track ?? "",
      track_details: item?.track_details ?? "",
      mode: item?.mode ?? "",
      team_size: item?.team_size ?? "",
      team_members: item?.team_members ?? "",
      status: item?.status ?? "Saved",
      round_detail: item?.round_detail ?? "",
      priority: item?.priority ?? "Medium",
      start_date: item?.start_date ?? "",
      end_date: item?.end_date ?? "",
      deadline: item?.deadline ?? "",
      applied_date: item?.applied_date ?? "",
      follow_up_date: item?.follow_up_date ?? "",
      application_link: item?.application_link ?? "",
      source: item?.source ?? "",
      result_rank: item?.result_rank ?? "",
      project_link: item?.project_link ?? "",
      notes: item?.notes ?? "",
    },
  });

  const onSubmit = async (data: FormData) => {
    setError(null);
    const result = await saveHackathon(data, item?.id);
    if (result.error) {
      setError(result.error);
      return;
    }
    toast.success(item ? "Hackathon updated" : "Hackathon added");
    onClose();
  };

  const remove = async () => {
    if (!item) return;
    const result = await deleteHackathon(item.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Hackathon deleted");
    onClose();
  };

  const add = (field: string) => (value: string) =>
    addDropdownOption("hackathons", field, value);

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
        <Label htmlFor="hackathon_name">Hackathon name *</Label>
        <Input id="hackathon_name" placeholder="HackMIT 2026" {...register("hackathon_name")} />
        <FormError message={errors.hackathon_name?.message ?? null} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="organizing_company">Organizer</Label>
          <Input id="organizing_company" {...register("organizing_company")} />
        </div>
        <ExtensibleSelect
          name="type"
          label="Type"
          control={control}
          options={customOptions.type ?? []}
          placeholder="e.g. Hackathon, Buildathon"
          onAddOption={add("type")}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ExtensibleSelect
          name="purpose"
          label="Purpose"
          control={control}
          options={customOptions.purpose ?? []}
          placeholder="e.g. Learning, Prize"
          onAddOption={add("purpose")}
        />
        <ExtensibleSelect
          name="theme_track"
          label="Theme / track"
          control={control}
          options={customOptions.theme_track ?? []}
          placeholder="e.g. AI/ML, FinTech"
          onAddOption={add("theme_track")}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="track_details">Track details</Label>
        <Input id="track_details" {...register("track_details")} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ExtensibleSelect
          name="mode"
          label="Mode"
          control={control}
          options={customOptions.mode ?? []}
          placeholder="e.g. Online, In-person"
          onAddOption={add("mode")}
        />
        <div className="space-y-1.5">
          <Label htmlFor="team_size">Team size</Label>
          <Input id="team_size" type="number" min={1} {...register("team_size")} />
          <FormError message={errors.team_size?.message ?? null} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="team_members">Team members</Label>
        <Input id="team_members" placeholder="Comma-separated names" {...register("team_members")} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="status">Status</Label>
          <Select id="status" {...register("status")}>
            {HACKATHON_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="round_detail">Round detail</Label>
          <Input id="round_detail" {...register("round_detail")} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
        <DateField id="deadline" label="Deadline" register={register} />
        <DateField id="follow_up_date" label="Follow-up date" register={register} />
        <DateField id="applied_date" label="Applied date" register={register} />
        <DateField id="start_date" label="Start date" register={register} />
        <DateField id="end_date" label="End date" register={register} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="application_link">Application link</Label>
          <Input id="application_link" placeholder="https://…" {...register("application_link")} />
          <FormError message={errors.application_link?.message ?? null} />
        </div>
        <ExtensibleSelect
          name="source"
          label="Source"
          control={control}
          options={customOptions.source ?? []}
          placeholder="e.g. Devpost"
          onAddOption={add("source")}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="result_rank">Result / rank</Label>
          <Input id="result_rank" placeholder="e.g. Top 10" {...register("result_rank")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="project_link">Project link</Label>
          <Input id="project_link" placeholder="https://…" {...register("project_link")} />
          <FormError message={errors.project_link?.message ?? null} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" rows={3} {...register("notes")} />
      </div>

      <FormError message={error} />

      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" size="lg" className="flex-1" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : item ? "Save changes" : "Add hackathon"}
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
