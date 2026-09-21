import type { Request, Response } from "express";
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
const updateAppointmentStatus = catchAsync(async (req: Request, res: Response) => {
	const appointmentId = req.body.appointmentId;
	const payload = req.body;
	const user = req.user!;
	const result = await AppointmentServices.updateAppointmentStatus(appointmentId, payload, user);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Appointment updated Successfully",
		data: result,
	});
});
const getMyAppointments = catchAsync(async (req: Request, res: Response) => {
	const query = req.query;
	const user = req.user!;
	const result = await AppointmentServices.getMyAppointments(query, user);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "My Appointment Successfully",
		data: result,
	});
});
const getDoctorAppointments = catchAsync(async (req: Request, res: Response) => {
	const query = req.query;
	const user = req.user!;
	const result = await AppointmentServices.getDoctorAppointments(query, user);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Doctor Appointment Successfully",
		data: result,
	});
});
const getAllAppointments = catchAsync(async (req: Request, res: Response) => {
	const query = req.query;
	const result = await AppointmentServices.getAllAppointments(query);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "All Appointment Successfully",
		data: result,
	});
});
const getSingleAppointment = catchAsync(async (req: Request, res: Response) => {
	const appointmentId = req.body.appointmentId;
	const user = req.user!;
	const result = await AppointmentServices.getSingleAppointment(appointmentId, user);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Single Appointment Successfully",
		data: result,
	});
});

export const AppointmentController = {
	bookAppointment,
	payAppointment,
	bookAppointmentCallback,
	cancelAppointment,
	updateAppointmentStatus,
	getMyAppointments,
	getDoctorAppointments,
	getAllAppointments,
	getSingleAppointment
};
