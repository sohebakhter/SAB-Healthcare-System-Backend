import z from "zod";

export const BookAppointmentZodSchema = z.object({
	scheduleId: z.string().min(1, "Schedule id is required"),
});

export const UpdateAppointmentStatusZodSchema = z.object({
	status: z.enum(
		["ONGOING", "COMPLETED"],
		"Status must be either ONGOING or COMPLETED",
	),
});
