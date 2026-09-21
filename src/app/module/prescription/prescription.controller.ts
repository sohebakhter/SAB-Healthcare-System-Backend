import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";
import { PrescriptionServices } from "./prescription.service";

const createPrescription = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;
	const user = req.user!;
	const result = await PrescriptionServices.createPrescription(payload, user);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Prescription Created Successfully",
		data: result,
	});
});

const getSinglePrescription = catchAsync(
	async (req: Request, res: Response) => {
		const appointmentId = req.params.appointmentId as string;
		const user = req.user!;
		const result = await PrescriptionServices.getSinglePrescription(
			appointmentId,
			user,
		);
		sendResponse(res, {
			success: true,
			statusCode: httpStatus.OK,
			message: "Single Prescription Retrived Successfully",
			data: result,
		});
	},
);

export const PrescriptionController = {
	createPrescription,
	getSinglePrescription,
};
