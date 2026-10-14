# Security policy

This integration handles the credentials of a FordPass account: the tokens it
stores can lock, unlock and remotely start a car. Please treat any problem
with them as a security issue.

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help — remove first the tokens, the sign-in address
  (`fordapp://userauthorized/?code=…`), the VIN of your vehicles and their GPS
  position.

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## How the integration protects your account

- Your Ford password is never seen by the integration: you sign in on Ford's
  own page, the integration only receives a one-time code (OAuth2 + PKCE).
- The tokens are stored in the Gladys configuration of the integration, under
  keys that the Configuration screen never displays, and are never logged.
- The integration only talks to Ford's servers (`*.ford.com`, `*.autonomic.ai`)
  over HTTPS, and runs in the read-only, unprivileged Gladys sandbox.
- The **Disconnect from Ford** action deletes the stored tokens. Changing your
  FordPass password also revokes them on Ford's side.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## Scope

In scope: the code of this repository and the Docker image it publishes.

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
and Ford's services, apps and vehicles — report those to Ford.
