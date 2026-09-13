import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";
import { AppointmentServices } from "./appointment.service";

const bookAppointment = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;
	const user = req.user!;

	const result = await AppointmentServices.bookAppointment(payload, user);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Bkash Payment Intent Created Successfully",
		data: result,
	});
});
const payAppointment = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;
	const user = req.user!;

	const result = await AppointmentServices.payAppointment(payload, user);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Bkash Payment Initialized Successfully",
		data: result,
	});
});
const bookAppointmentCallback = catchAsync(
	async (req: Request, res: Response) => {
		const { redirectUrl } = await AppointmentServices.bookAppointmentCallback(
			req.query,
		);

		res.redirect(redirectUrl);
		// sendResponse(res, {
		// 	success: true,
		// 	statusCode: httpStatus.OK,
		// 	message: "Bkash Payment Callback",
		// 	data: result,
		// });
	},
);

const cancelAppointment = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;
	const result = await AppointmentServices.cancelAppointment(payload);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Appointment Cancelled Successfully",
		data: result,
	});
});

export const AppointmentController = {
	bookAppointment,
	payAppointment,
	bookAppointmentCallback,
	cancelAppointment,
};
