import { Notice } from "@/components/Notice";

/** Form error message, announced by screen readers. */
export function FormError({ id, message }: { id?: string; message?: string | undefined }) {
  if (!message) return null;
  return (
    <Notice id={id} role="alert" tone="danger" className="px-3 py-2.5">
      {message}
    </Notice>
  );
}
