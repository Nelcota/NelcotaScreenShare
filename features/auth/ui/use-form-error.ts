import { useState } from "react";
import { useActionData } from "react-router";

/**
 * The form's error: the one set by the page after a request with JS, or the one the route
 * action answered when the form was posted without JS.
 */
export function useFormError() {
  const posted = useActionData<{ error?: string }>();
  const [clientError, setError] = useState<string>();
  return [clientError ?? posted?.error, setError] as const;
}
