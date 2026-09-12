import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";
import { AppointmentServices } from "./appointment.service";

const bookAppointment = catchAsync(async (req: Request, res: Response) => {
	const result = await AppointmentServices.bookAppointment();
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Bkash Payment Created Successfully",
		data: result,
	});
});
const bookAppointmentCallback = catchAsync(
	async (req: Request, res: Response) => {
		const { result, redirectUrl } =
			await AppointmentServices.bookAppointmentCallback(req.query);

		console.log(result, "callback controller");

		res.redirect(redirectUrl);
		// sendResponse(res, {
		// 	success: true,
		// 	statusCode: httpStatus.OK,
		// 	message: "Bkash Payment Callback",
		// 	data: result,
		// });
	},
);

export const AppointmentController = {
	bookAppointment,
	bookAppointmentCallback,
};
