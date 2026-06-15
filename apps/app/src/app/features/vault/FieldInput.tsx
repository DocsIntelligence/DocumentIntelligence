import type { VaultFieldDef } from '@org/api-client';
import {
  DatePicker,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@org/ui';
import { useLookupOptions } from '../documents/queries';

/**
 * Render the right input for a typed vault field. Pulled out of the
 * detail/edit pages so both routes share identical input rendering;
 * lookup-typed fields hit the same cached options query.
 */
export function FieldInput({
  def,
  value,
  onChange,
}: {
  def: VaultFieldDef;
  value: string;
  onChange: (v: string) => void;
}) {
  const { data: lookups } = useLookupOptions();

  if (def.type === 'select' || def.type === 'lookup') {
    const opts =
      def.type === 'lookup' && def.lookupKey
        ? (lookups?.[def.lookupKey] ?? []).map((o) => ({
            value: o.value,
            label: o.label,
          }))
        : (def.options ?? []).map((o) => ({ value: o, label: o }));
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {opts.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (def.type === 'textarea') {
    return (
      <Textarea
        value={value}
        placeholder={def.placeholder}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
      />
    );
  }
  if (def.type === 'date') {
    return (
      <DatePicker value={value} onChange={onChange} placeholder={def.placeholder} />
    );
  }
  const type =
    def.type === 'number'
      ? 'number'
      : def.type === 'email'
        ? 'email'
        : def.type === 'tel'
          ? 'tel'
          : 'text';
  return (
    <Input
      type={type}
      value={value}
      placeholder={def.placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
