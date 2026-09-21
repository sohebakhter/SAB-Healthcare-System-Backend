import z from "zod";

export const CreatePrescriptionZodSchema = z.object({
	appointmentId: z.string().min(1, "Appoinment Id is required"),

	findings: z
		.string()
		.trim()
		.min(5, "Findings must be atleast 5 characters long"),

	medicines: z
		.array(
			z.object({
				name: z.string().trim().min(1, "Medicine Name is Requried"),
				dosage: z.string().trim().min(1, "dosage is Requried"),
				duration: z.string().trim().min(1, "duration is Requried"),
				instructions: z.string().trim().optional(),
			}),
		)
		.min(1, "Atleast one medicine is required"),
});
