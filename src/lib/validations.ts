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
		.string()
		.min(6, "Password must be at least 6 characters")
		.max(100, "Password must be less than 100 characters")
		.optional(),
	role: z.enum(["admin", "user"]).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
