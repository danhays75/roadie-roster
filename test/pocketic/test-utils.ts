/** Register through the same public API as sign-in, without assigning or weakening roles.
 * Use only when the app's generated declarations expose _initialize_access_control.
 * Give each identity its own actor when tests may run concurrently.
 *
 * The platform's shared authorization mixin makes the first caller a platform
 * admin, but the app's own guards read the app-level access-grant map. The app
 * exposes `bootstrapAdmin()` to bridge that platform grant into its own model,
 * so call it after initialization; it is idempotent and only acts for a caller
 * the platform already considers an admin.
 */
export async function registerCaller<
  Identity,
  Service extends {
    setIdentity(identity: Identity): void;
    _initialize_access_control(): Promise<unknown>;
    bootstrapAdmin(): Promise<unknown>;
  },
>(actor: Service, identity: Identity): Promise<Service> {
  actor.setIdentity(identity);
  await actor._initialize_access_control();
  await actor.bootstrapAdmin();
  return actor;
}
