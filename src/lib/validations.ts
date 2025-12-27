import { z } from "zod";

export const loginSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(50, "Username must be less than 50 characters"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(100, "Password must be less than 100 characters"),
});

export const createUserSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(50, "Username must be less than 50 characters")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Username can only contain letters, numbers, underscores, and hyphens",
    ),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(100, "Password must be less than 100 characters"),
  role: z.enum(["admin", "user"]),
});

export const updateUserSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(50, "Username must be less than 50 characters")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Username can only contain letters, numbers, underscores, and hyphens",
    )
    .optional(),
  email: z.string().email("Invalid email address").optional(),
  password: z
    .union([
      z.string().min(6, "Password must be at least 6 characters").max(100, "Password must be less than 100 characters"),
      z.literal(""),
    ])
    .optional(),
  role: z.enum(["admin", "user"]).optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(100, "Password must be at most 100 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const changePasswordApiSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password must be at most 100 characters"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ChangePasswordApiInput = z.infer<typeof changePasswordApiSchema>;

// Access Token schemas
export const createAccessTokenSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be less than 100 characters"),
  permissions: z
    .array(z.enum(["pull", "push", "delete"]))
    .min(1, "At least one permission is required")
    .default(["pull"]),
  expiresInDays: z
    .number()
    .int("Expiration must be a whole number")
    .positive("Expiration must be positive")
    .max(365, "Expiration cannot exceed 365 days")
    .optional(),
});

export const deleteAccessTokenSchema = z.object({
  tokenId: z.string().min(1, "Token ID is required"),
});

export type CreateAccessTokenInput = z.infer<typeof createAccessTokenSchema>;

// Namespace schemas
export const createNamespaceSchema = z.object({
  name: z
    .string()
    .min(3, "Namespace must be at least 3 characters")
    .max(50, "Namespace must be less than 50 characters")
    .regex(
      /^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$/,
      "Namespace must start and end with lowercase letter or number, and can only contain lowercase letters, numbers, underscores, and hyphens",
    ),
  userId: z.number().int().positive("User ID is required"),
  description: z
    .string()
    .max(255, "Description must be less than 255 characters")
    .optional(),
});

export const updateNamespaceSchema = z.object({
  description: z
    .string()
    .max(255, "Description must be less than 255 characters")
    .optional(),
});

export const checkNamespaceSchema = z.object({
  name: z.string().min(1, "Namespace name is required"),
});

export type CreateNamespaceInput = z.infer<typeof createNamespaceSchema>;
export type UpdateNamespaceInput = z.infer<typeof updateNamespaceSchema>;
export type CheckNamespaceInput = z.infer<typeof checkNamespaceSchema>;
export type DeleteAccessTokenInput = z.infer<typeof deleteAccessTokenSchema>;
