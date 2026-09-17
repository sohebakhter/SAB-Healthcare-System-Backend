import {
	AppointmentStatus,
	PaymentStatus,
} from "../../../../generated/prisma/enums";
import config from "../../config";
import httpStatus from "http-status";
import { getBkashIdToken } from "../../lib/bkash";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/appError";

const bookAppointment = async (payload: any, user: RequestUser) => {
	const transactionResult = await prisma.$transaction(async (tx) => {
		//appiontment
		const appiontment = await tx.appointment.create({
			data: {
				status: AppointmentStatus.PENDING,
			},
		});
		const bkashIdToken = await getBkashIdToken();
		const res = await fetch(
			`${config.bkash_base_url}/tokenized/checkout/create`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
					Authorization: bkashIdToken,
					"X-App-Key": config.bkash_app_key,
				},
				body: JSON.stringify({
					agreementID: "TokenizedMerchant01L3IKB6H1565072174986", //appointment id
					mode: "0011",
					payerReference: user.email, //user email or phone number ---> auth,params
					callbackURL: `${config.bkash_callback_url}/appointment/book-appointment/payment/callback`,
					merchantAssociationInfo: "MI05MID54RF09123456One",
					amount: "1200",
					currency: "BDT",
					intent: "sale",
					merchantInvoiceNumber: appiontment?.id, // appiontment id
				}),
			},
		);

		const result = await res.json();

		// payment model create
		await tx.payment.create({
			data: {
				amount: result.amount,
				merchantInvoiceNumber: result.merchantInvoiceNumber,
				appointmentId: appiontment.id,
				bkashPaymentId: result.paymentID,
				getwayResponse: result,
				payerReference: user.email,
			},
		});

		return result.bkashURL;
	});

	return {
		paymentUrl: transactionResult,
	};
};

const payAppointment = async (payload: any, user: RequestUser) => {
	const appiontmentId = payload.appointmentId;

	const existingAppointment = await prisma.appointment.findUnique({
		where: {
			id: appiontmentId,
		},
		include: {
			payment: {
				select: {
					amount: true,
				},
			},
		},
	});

	console.log("existingAppointment", existingAppointment);

	if (!existingAppointment) {
			 throw new AppError(httpStatus.NOT_FOUND, "Appointment Dose Not Exists");
	}

	if (existingAppointment.status !== "PENDING") {
			 throw new AppError(httpStatus.CONFLICT, "Appointment is not in pending state");
	}

	const bkashIdToken = await getBkashIdToken();

	if (!bkashIdToken) {
			 throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, "Bkash id Token is missing");
	}
	const res = await fetch(
		`${config.bkash_base_url}/tokenized/checkout/create`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
				Authorization: bkashIdToken,
				"X-App-Key": config.bkash_app_key,
			},
			body: JSON.stringify({
				agreementID: "TokenizedMerchant01L3IKB6H1565072174986", //appointment id
				mode: "0011",
				payerReference: user.email, //user email or phone number ---> auth,params
				callbackURL: `${config.bkash_callback_url}/appointment/book-appointment/payment/callback`,
				merchantAssociationInfo: "MI05MID54RF09123456One",
				amount: existingAppointment?.payment?.amount,
				currency: "BDT",
				intent: "sale",
				merchantInvoiceNumber: existingAppointment?.id, // appiontment id
			}),
		},
	);

	const result = await res.json();

	// payment model update
	await prisma.payment.update({
		where: {
			appointmentId: existingAppointment.id,
		},
		data: {
			merchantInvoiceNumber: result.merchantInvoiceNumber,
			getwayResponse: result,
			bkashPaymentId: result.paymentID,
		},
	});

	return {
		paymentUrl: result.bkashURL,
	};
};

const bookAppointmentCallback = async (query: Record<string, any>) => {
	const transactionResult = await prisma.$transaction(async (tx) => {
		const paymentId = query.paymentID;
		if (!paymentId) {
					throw new AppError(httpStatus.BAD_REQUEST, "Payment ID Missing");
		}
		const status = query.status;
		if (!status) {
					throw new AppError(httpStatus.BAD_REQUEST, "Payment Status is Missing");
		}

		const bkashIdToken = await getBkashIdToken();

		if (!bkashIdToken) {
					throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, "Bkash id Token is missing");
		}

		const bkashExecuteRes = await fetch(
			`${config.bkash_base_url}/tokenized/checkout/execute`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
					Authorization: bkashIdToken,
					"X-App-Key": config.bkash_app_key,
				},
				body: JSON.stringify({
					paymentID: paymentId,
				}),
			},
		);

		const result = await bkashExecuteRes.json();

		if (status === "success") {
			await tx.appointment.update({
				where: {
					id: result.merchantInvoiceNumber,
				},
				data: {
					status: AppointmentStatus.CONFIRMED,
				},
			});

			await tx.payment.update({
				where: {
					bkashPaymentId: paymentId,
				},
				data: {
					bkashTrxId: result.trxID,
					paidAt: result.paymentExecuteTime,
					status: PaymentStatus.PAID,
					getwayResponse: result,
				},
			});
			return {
				redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=success`,
			};
		} else if (status === "failure") {
			await tx.payment.update({
				where: {
					bkashPaymentId: paymentId,
				},
				data: {
					status: PaymentStatus.FAILED,
					getwayResponse: result,
				},
			});
			return {
				redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=failure`,
			};
		} else if (status === "cancel") {
			await tx.payment.update({
				where: {
					bkashPaymentId: paymentId,
				},
				data: {
					status: PaymentStatus.CANCELLED,
					getwayResponse: result,
				},
			});
			return {
				redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=cancel`,
			};
		} else {
			return {
				result,
				redirectUrl: `${config.frontend_url}/dashboard/my-appointments?error=payment-failed`,
			};
		}
	});

	return transactionResult;
};

const cancelAppointment = async (payload: any) => {
	const { appointmentId } = payload;

	// 1. Get appointment and payment first
	const existingAppointment = await prisma.appointment.findUnique({
		where: {
			id: appointmentId,
		},
		include: {
			payment: true,
		},
	});

	if (!existingAppointment) {
			throw new AppError(httpStatus.NOT_FOUND, "Appointment Does Not Exist");
	}

	// 2. Validate appointment status
	if (
		existingAppointment.status === "ONGOING" ||
		existingAppointment.status === "COMPLETED"
	) {
			throw new AppError(httpStatus.CONFLICT, "Cannot cancel an ongoing or completed appointment");
	}

	if (existingAppointment.status === "CANCELLED") {
			throw new AppError(httpStatus.CONFLICT, "Appointment is already cancelled");
	}

	// 3. Get bKash token OUTSIDE transaction
	const bkashIdToken = await getBkashIdToken();

	if (!bkashIdToken) {
			throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, "Bkash id Token is missing");
	}

	// 4. Call bKash refund API OUTSIDE transaction
	const bkashRefundedResponse = await fetch(
		`${config.bkash_base_url}/tokenized/checkout/payment/refund`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
				Authorization: bkashIdToken,
				"X-App-Key": config.bkash_app_key,
			},
			body: JSON.stringify({
				paymentID: existingAppointment.payment?.bkashPaymentId,
				trxID: existingAppointment.payment?.bkashTrxId,
				amount: existingAppointment.payment?.amount.toString(),
				sku: "Appointment Cancellation Refund",
				reason: "Patient requested refund for appointment cancellation",
			}),
		},
	);

	const result = await bkashRefundedResponse.json();

	console.log("bkashRefundedResponse", result);

	// 5. Make sure refund was successful
	if (!bkashRefundedResponse.ok) {
			throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, result?.statusMessage || "Bkash refund request failed");
	}

	// 6. Update database inside transaction
	const transactionResult = await prisma.$transaction(async (tx) => {
		const updatedAppointment = await tx.appointment.update({
			where: {
				id: existingAppointment.id,
			},
			data: {
				status: AppointmentStatus.CANCELLED,
			},
		});

		const updatedPayment = await tx.payment.update({
			where: {
				appointmentId: existingAppointment.id,
			},
			data: {
				status: PaymentStatus.REFUNDED,
				getwayResponse: result,
				refundAmount: result.amount,
				refundedAt: result.completedTime,
				refundTrxId: result.refundTrxID,
				refundReason: "Patient requested refund for appointment cancellation",
			},
		});

		return {
			appointment: updatedAppointment,
			payment: updatedPayment,
		};
	});

	return transactionResult;
};
export const AppointmentServices = {
	bookAppointment,
	payAppointment,
	bookAppointmentCallback,
	cancelAppointment,
};
