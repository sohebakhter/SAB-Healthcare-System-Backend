import { z } from "zod";

export const applyAsDoctorZodSchema = z.object({
	user: z.object({
		name: z
			.string()
			.min(2, "Name must be at least 2 characters long")
			.max(100, "Name cannot exceed 100 characters"),

		email: z.email("Please provide a valid email address").toLowerCase().trim(),
	}),

	doctor: z.object({
		address: z
			.string()
			.min(5, "Address must be at least 5 characters long")
			.max(255, "Address cannot exceed 255 characters")
			.optional(),

		specialization: z
			.string()
			.min(2, "Specialization is required")
			.max(100, "Specialization cannot exceed 100 characters"),

		licenseNumber: z
			.string()
			.min(3, "License number is required")
			.max(100, "License number cannot exceed 100 characters"),

		qualifications: z
			.string()
			.min(2, "Qualifications are required")
			.max(500, "Qualifications cannot exceed 500 characters"),

		experienceYears: z
			.number()
			.int("Experience years must be a whole number")
			.min(0, "Experience years cannot be negative")
			.max(70, "Experience years cannot exceed 70"),

		bio: z.string().max(2000, "Bio cannot exceed 2000 characters").optional(),

		consultationFee: z
			.number()
			.min(0, "Consultation fee cannot be negative")
			.optional(),

		contactNumber: z
			.string()
			.min(10, "Contact number is invalid")
			.max(20, "Contact number is invalid")
			.optional(),
	}),
});
