import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { LoginMethodsSettingsInput } from "./validations";
import { getOIDCConfig } from "./oidc";

export interface LoginMethodsSettings {
  passwordEnabled: boolean;
  passkeyEnabled: boolean;
  autoTrigger: "none" | "passkey" | "oidc";
}

const LOGIN_METHODS_SETTINGS_KEY = "login_methods";

const DEFAULT_SETTINGS: LoginMethodsSettings = {
  passwordEnabled: true,
  passkeyEnabled: true,
  autoTrigger: "passkey",
};

/**
 * Get login methods configuration from database
 */
export async function getLoginMethodsConfig(): Promise<LoginMethodsSettings> {
  const setting = await db.query.settings.findFirst({
    where: eq(schema.settings.key, LOGIN_METHODS_SETTINGS_KEY),
  });

  if (!setting) {
    return DEFAULT_SETTINGS;
  }

  try {
    const parsed = JSON.parse(setting.value) as Partial<LoginMethodsSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save login methods configuration to database
 */
export async function saveLoginMethodsConfig(
  config: LoginMethodsSettingsInput
): Promise<void> {
  const value = JSON.stringify(config);

  await db
    .insert(schema.settings)
    .values({
      key: LOGIN_METHODS_SETTINGS_KEY,
      value,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.settings.key,
      set: {
        value,
        updatedAt: new Date(),
      },
    });
}

/**
 * Get the combined login methods status (includes OIDC enabled status)
 */
export async function getLoginMethodsStatus(): Promise<{
  passwordEnabled: boolean;
  passkeyEnabled: boolean;
  oidcEnabled: boolean;
  autoTrigger: "none" | "passkey" | "oidc";
}> {
  const [loginConfig, oidcConfig] = await Promise.all([
    getLoginMethodsConfig(),
    getOIDCConfig(),
  ]);

  return {
    passwordEnabled: loginConfig.passwordEnabled,
    passkeyEnabled: loginConfig.passkeyEnabled,
    oidcEnabled: oidcConfig?.enabled ?? false,
    autoTrigger: loginConfig.autoTrigger,
  };
}
