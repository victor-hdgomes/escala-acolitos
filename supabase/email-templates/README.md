# Supabase e-mail templates

Supabase sends the authentication e-mails itself, from its own dashboard, so
these cannot live in the app's message catalog like every other string does.
They are kept here so the markup is in the repository and not only in a web
form that nobody can diff.

They use the same shell as the app's own mail: the brand line above the card,
a bordered white card, and the muted footer.

## How to apply

Dashboard, **Authentication**, **Emails**, then for each template paste the
matching file:

| Supabase template | File |
| --- | --- |
| Confirm signup | `confirm-signup.html` |
| Reset password | `reset-password.html` |
| Magic link | `magic-link.html` |
| Invite user | `invite.html` |
| Change email address | `change-email.html` |

Every file uses `{{ .ConfirmationURL }}`, which Supabase fills in. Leave the
subject lines to taste; the body is what these replace.

## While you are in there

**Authentication, URL Configuration.** Set **Site URL** to the real domain and
add `<domain>/auth/callback` to **Redirect URLs**. Without it the links in
these e-mails land on an error page in production.

## Sending through Resend

Optional, and only worth doing so the authentication e-mails come from the
same address as the rest. Dashboard, **Project Settings**, **Authentication**,
**SMTP Settings**:

    Host      smtp.resend.com
    Port      465
    Username  resend
    Password  <your Resend API key>
    Sender    the address on your verified domain

Until a domain is verified in Resend, `onboarding@resend.dev` only delivers to
your own address, which is fine for trying it and not for a parish.
