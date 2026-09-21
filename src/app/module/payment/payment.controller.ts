import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import httpStatus from "http-status";
import { sendResponse } from "../../utils/sendResponse";
import { PaymentServices } from "./payment.service";

const getMyPayments = catchAsync(async (req: Request, res: Response) => {
	const query = req.query;
	const user = req.user!;
	const result = await PaymentServices.getMyPayments(query, user);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "My Payment Successfully",
		data: result,
	});
});
const getAllPayments = catchAsync(async (req: Request, res: Response) => {
	const query = req.query;

	const result = await PaymentServices.getAllPayments(query);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "All Payment Successfully",
		data: result,
	});
});
const getSinglePayment = catchAsync(async (req: Request, res: Response) => {
	const paymentId = req.params.paymentId as string;
	const user = req.user!;
	const result = await PaymentServices.getSinglePayment(paymentId, user);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Single Payment Successfully",
		data: result,
	});
});

export const PaymentController = {
	getMyPayments,
	getAllPayments,
	getSinglePayment,
};
