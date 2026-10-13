import { authErrorMessage } from "@/features/auth/domain/auth-errors";
import { newPasswordError, PASSWORD_LIMITS } from "@/features/auth/domain/password-rules";
import { checkSignUp } from "@/features/auth/domain/sign-up";
import { formText } from "@/lib/utils";
import {
  asksForSecondFactor,
  forwardAuthForm,
  formFailure,
  redirectWithCookies,
} from "./native-auth-form.server";

/** One Better Auth instance: its handler and where its endpoints live. */
interface AuthInstance {
  handle: (request: Request) => Promise<Response>;
  basePath: string;
}

/** E-mail and password posted without JS: the form error, the 2FA step or the next page. */
export async function signInFromForm(
  request: Request,
  auth: AuthInstance,
  { done, secondFactor }: { done: string; secondFactor: string },
) {
  const form = await request.formData();
  const result = await forwardAuthForm(request, auth.handle, `${auth.basePath}/sign-in/email`, {
    email: formText(form, "email").trim(),
    password: formText(form, "password"),
  });
  if (!result.ok) return formFailure(authErrorMessage(result.error));
  redirectWithCookies(asksForSecondFactor(result.body) ? secondFactor : done, result.cookies);
}

/** The authenticator or backup code posted without JS; the two-factor cookie goes along. */
export async function secondFactorFromForm(
  request: Request,
  auth: AuthInstance,
  { done }: { done: string },
) {
  const form = await request.formData();
  const code = formText(form, "code").replaceAll(" ", "");
  const endpoint = formText(form, "mode") === "backup" ? "verify-backup-code" : "verify-totp";
  const result = await forwardAuthForm(
    request,
    auth.handle,
    `${auth.basePath}/two-factor/${endpoint}`,
    { code },
  );
  if (!result.ok) {
    return formFailure(authErrorMessage(result.error, "Código inválido. Confira e tente de novo."));
  }
  redirectWithCookies(done, result.cookies);
}

/** Asks for the reset link; the answer never says whether the e-mail has an account. */
export async function passwordResetFromForm(
  request: Request,
  auth: AuthInstance,
  { redirectTo }: { redirectTo: string },
) {
  const form = await request.formData();
  const result = await forwardAuthForm(
    request,
    auth.handle,
    `${auth.basePath}/request-password-reset`,
    { email: formText(form, "email"), redirectTo },
  );
  if (!result.ok) {
    return formFailure(
      authErrorMessage(result.error, "Não foi possível enviar o link. Tente de novo."),
    );
  }
  return { sent: true };
}

/** The new password from the e-mail link, checked like the page does before sending it. */
export async function passwordChangeFromForm(
  request: Request,
  auth: AuthInstance,
  { token, minLength, done }: { token: string | undefined; minLength: number; done: string },
) {
  if (!token) return formFailure("Este link não vale mais. Peça um novo.");
  const form = await request.formData();
  const newPassword = formText(form, "password");
  const invalid = newPasswordError(newPassword, formText(form, "confirm"), minLength);
  if (invalid) return formFailure(invalid);
  const result = await forwardAuthForm(request, auth.handle, `${auth.basePath}/reset-password`, {
    newPassword,
    token,
  });
  if (!result.ok) return formFailure(authErrorMessage(result.error));
  redirectWithCookies(done, result.cookies);
}

/**
 * A new account posted without JS, checked like the page does. With e-mail confirmation an
 * address already in use answers like a new one (its owner is told by e-mail).
 */
export async function signUpFromForm(
  request: Request,
  auth: AuthInstance,
  { returnTo, verificationRequired }: { returnTo: string; verificationRequired: boolean },
) {
  const form = await request.formData();
  const password = formText(form, "password");
  const check = checkSignUp({
    name: formText(form, "name"),
    email: formText(form, "email"),
    password,
    minPassword: PASSWORD_LIMITS.user.min,
  });
  if (!check.ok) return formFailure(check.message);
  const result = await forwardAuthForm(request, auth.handle, `${auth.basePath}/sign-up/email`, {
    name: check.name,
    email: check.email,
    password,
    callbackURL: returnTo,
  });
  const duplicate =
    !result.ok && (result.error.status === 422 || result.error.code === "USER_ALREADY_EXISTS");
  if (!result.ok && !(verificationRequired && duplicate)) {
    return formFailure(authErrorMessage(result.error));
  }
  const cookies = result.ok ? result.cookies : [];
  if (!verificationRequired) redirectWithCookies(returnTo, cookies);
  const back = encodeURIComponent(returnTo);
  redirectWithCookies(
    `/verificar-email?email=${encodeURIComponent(check.email)}&voltar=${back}`,
    cookies,
  );
}

type AcceptInvitation = (input: {
  token: string;
  name: string;
  password: string;
}) => Promise<{ data?: unknown; serverError?: string; validationErrors?: unknown }>;

/** The admin invitation posted without JS: the same audited operation the page calls. */
export async function invitationFromForm(
  request: Request,
  accept: AcceptInvitation,
  { token }: { token: string },
) {
  const form = await request.formData();
  const password = formText(form, "password");
  const invalid = newPasswordError(password, formText(form, "confirm"), PASSWORD_LIMITS.admin.min);
  if (invalid) return formFailure(invalid);
  const result = await accept({ token, name: formText(form, "name"), password });
  if (result.serverError) return formFailure(result.serverError);
  if (result.validationErrors) return formFailure("Confira os campos e tente de novo.");
  redirectWithCookies("/admin/entrar?aviso=convite", []);
}
