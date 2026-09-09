import z from "zod";

const PatientRegistrationZodSchema = z.object({
	name: z.string("Not a String!!"),
	email: z.email("Not Email!!"),
	password: z
		.string()
		.min(8, { message: "Password must be at least 8 characters long" })
		.max(100, { message: "Password cannot exceed 100 characters" })
		.regex(/[A-Z]/, {
			message: "Password must contain at least one uppercase letter",
		})
		.regex(/[a-z]/, {
			message: "Password must contain at least one lowercase letter",
		})
		.regex(/[0-9]/, { message: "Password must contain at least one number" })
		.regex(/[^A-Za-z0-9]/, { message: "Atleast one Special Charecter." }),
	patient: z
		.object({
			contactNumber: z.string().optional(),
		})
		.optional(),
});
const PatientEmailVerificationZodSchema = z.object({
	email: z.email("Not Email!!"),
	otp: z.string("Not otp!!").length(6),
});

const LoginZodSchema = z.object({
	email: z.email("Not email!!"),
	password: z
		.string()
		.min(8, { message: "Password must be at least 8 characters long" })
		.max(100, { message: "Password cannot exceed 100 characters" })
		.regex(/[A-Z]/, {
			message: "Password must contain at least one uppercase letter",
		})
		.regex(/[a-z]/, {
			message: "Password must contain at least one lowercase letter",
		})
		.regex(/[0-9]/, { message: "Password must contain at least one number" })
		.regex(/[^A-Za-z0-9]/, { message: "Atleast one Special Charecter." }),
});

const ForgotPasswordZodSchema = z.object({
	email: z.email("Not Email!!"),
});
const ResetPasswordZodSchema = z.object({
	email: z.email("Not Email!!"),
	otp: z.string("Not otp!!").length(6),
	newPassword: z
		.string()
		.min(8, { message: "Password must be at least 8 characters long" })
		.max(100, { message: "Password cannot exceed 100 characters" })
		.regex(/[A-Z]/, {
			message: "Password must contain at least one uppercase letter",
		})
		.regex(/[a-z]/, {
			message: "Password must contain at least one lowercase letter",
		})
		.regex(/[0-9]/, { message: "Password must contain at least one number" })
		.regex(/[^A-Za-z0-9]/, { message: "Atleast one Special Charecter." }),
});

export const UserValidation = {
	PatientRegistrationZodSchema,
	PatientEmailVerificationZodSchema,
	LoginZodSchema,
	ForgotPasswordZodSchema,
	ResetPasswordZodSchema,
};
