import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";
import { AppError } from "../../utils/appError";
import { doctorServices } from "./doctor.service";
import { applyAsDoctorZodSchema } from "./doctor.validation";

const applyAsDoctor = catchAsync(async (req: Request, res: Response) => {
	const files = req.files as {
		[fieldname: string]: Express.Multer.File[];
	};

	const resume = files.resume?.[0];
	const additionalFiles = files.additionalFiles;
	const data = req.body.data ? JSON.parse(req.body.data) : {};

	const zodValidationResult = applyAsDoctorZodSchema.safeParse(data);
	if (!zodValidationResult.success) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			zodValidationResult.error.issues[0].message,
		);
	}

	const result = await doctorServices.applyAsDoctor(
		zodValidationResult.data,
		resume,
		additionalFiles,
	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Doctor application submitted successfully",
		data: result,
	});
});

const verifyDoctorEmail = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;
	const result = await doctorServices.verifyDoctorEmail(payload);

	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Doctor Email verified successfully",
		data: result,
	});
});
const approveDoctor = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;
	const reviewer = req.user!; // Assuming we have a middleware that sets req.user with the authenticated user's information
	const result = await doctorServices.approveDoctor(payload, reviewer);

	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Doctor approved successfully",
		data: result,
	});
});
const getAllDoctors = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await doctorServices.getAllDoctors(req.query);

	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Doctors retrieved successfully",
		data: data,
		meta: meta,
	});
});
const updateDoctorProfile = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;
	const user = req.user!;
	const result = await doctorServices.updateDoctorProfile(payload, user);

	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Doctor profile updated successfully",
		data: result,
	});
});

const getAvailableDoctorByTodaysSchedule = catchAsync(
	async (req: Request, res: Response) => {
		const query = req.query;
		const result =
			await doctorServices.getAvailableDoctorByTodaysSchedule(query);

		sendResponse(res, {
			success: true,
			statusCode: httpStatus.OK,
			message: "Todays Available doctors retrieved successfully",
			data: result.data,
			meta: result.meta,
		});
	},
);

const getAllDoctorsListPublic = catchAsync(
	async (req: Request, res: Response) => {
		const query = req.query;
		const result = await doctorServices.getAllDoctorsListPublic(query);

		sendResponse(res, {
			success: true,
			statusCode: httpStatus.OK,
			message: "Doctors retrieved successfully",
			data: result.data,
			meta: result.meta,
		});
	},
);

const getSingleDoctorPublicProfile = catchAsync(
	async (req: Request, res: Response) => {
		const { doctorId } = req.params;
		const result = await doctorServices.getSingleDoctorPublicProfile(
			doctorId as string,
		);

		sendResponse(res, {
			success: true,
			statusCode: httpStatus.OK,
			message: "Doctor profile retrieved successfully",
			data: result,
		});
	},
);

export const doctorController = {
	applyAsDoctor,
	verifyDoctorEmail,
	approveDoctor,
	getAllDoctors,
	updateDoctorProfile,
	getAvailableDoctorByTodaysSchedule,
	getAllDoctorsListPublic,
	getSingleDoctorPublicProfile,
};
