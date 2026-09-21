import {
	AppointmentStatus,
	PaymentStatus,
	Role,
	ScheduleStatus,
} from "../../../../generated/prisma/enums";
import config from "../../config";
import httpStatus from "http-status";
import { getBkashIdToken } from "../../lib/bkash";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/appError";
import { IBookAppointmentPayload, ICancelAppointmentPayload, IPayAppointmentPayload, IUpdateAppointmentStatusPayload } from "./appointment.interface";
import { addMinutes, isBefore, isSameDay, subHours } from "date-fns";
import { transporter } from "../../lib/nodemailer";
import PDFDocument from "pdfkit"
import { IQuery } from "../../interfaces";
import { AppointmentWhereInput } from "../../../../generated/prisma/models";

const bookAppointment = async (
	payload: IBookAppointmentPayload,
	user: RequestUser,
) => {
	const transactionResult = await prisma.$transaction(async (tx) => {
		//appiontment

		const patient = await tx.patient.findUnique({
			where: {
				userId: user.userId,
			},
		});

		if (!patient) {
			throw new AppError(httpStatus.NOT_FOUND, "Patient Profile not found");
		}
		const schedule = await tx.schedule.findUnique({
			where: {
				id: payload.scheduleId,
			},
			include: { doctor: true },
		});

		if (!schedule || schedule.isDeleted) {
			throw new AppError(httpStatus.NOT_FOUND, "schedule not found");
		}

		if (schedule.status !== ScheduleStatus.PUBLISHED) {
			throw new AppError(httpStatus.BAD_REQUEST, "schedule not published yet");
		}

		const now = new Date();

		if (!isSameDay(now, schedule.startDateTime)) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"schedule is not available today",
			);
		}
		if (!isBefore(now, schedule.startDateTime)) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"this schedule has already started",
			);
		}

		const existingAppointment = await tx.appointment.findFirst({
			where: {
				patientId: patient.id,
				scheduleId: schedule.id,
			},
		});

		if (existingAppointment?.status === AppointmentStatus.PENDING) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"you already have a pending appointment, pay it first",
			);
		}
		if (existingAppointment?.status === AppointmentStatus.CONFIRMED) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"you already have a CONFIRMED appointment",
			);
		}
		if (existingAppointment?.status === AppointmentStatus.ONGOING) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"you already have a ONGOING appointment",
			);
		}
		if (existingAppointment?.status === AppointmentStatus.COMPLETED) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"you already have a COMPLETED appointment on this schedule, please try again another day",
			);
		}

		if (schedule.availableSlots === 0) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"this schedule is fully booked",
			);
		}

		if (!schedule.doctor.consultationFee) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"doctor has not set consultation Fee yet",
			);
		}

		const amount = schedule.doctor.consultationFee.toString();

		const appiontment = await tx.appointment.create({
			data: {
				status: AppointmentStatus.PENDING,
				patientId: patient.id,
				doctorId: schedule.doctor.id,
				scheduleId: schedule.id,
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
					amount: amount,
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

		return {
			paymentUrl: result.bkashURL,
		};
	});

	return transactionResult;
};

const payAppointment = async (payload: IPayAppointmentPayload, user: RequestUser) => {
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

	if (!existingAppointment) {
		throw new AppError(httpStatus.NOT_FOUND, "Appointment Dose Not Exists");
	}

	if (existingAppointment.status !== "PENDING") {
		throw new AppError(
			httpStatus.CONFLICT,
			"Appointment is not in pending state",
		);
	}

	const bkashIdToken = await getBkashIdToken();

	if (!bkashIdToken) {
		throw new AppError(
			httpStatus.INTERNAL_SERVER_ERROR,
			"Bkash id Token is missing",
		);
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
			throw new AppError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Bkash id Token is missing",
			);
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
			const appoinment = await tx.appointment.findUnique({
				where: {
					id: result.merchantInvoiceNumber,
				},
				include: {
					schedule: true,
					patient: true,
					doctor: true
				},
			});

			if (!appoinment) {
				throw new AppError(httpStatus.NOT_FOUND, "Appointment not found");
			}

			const alreadyBookSlots = appoinment.schedule.totalSlots - appoinment.schedule.availableSlots

			const serialNumber = alreadyBookSlots + 1

			const joiningTime = addMinutes(appoinment.schedule.startDateTime, (serialNumber - 1) * 20)

			await tx.appointment.update({
				where: {
					id: result.merchantInvoiceNumber,
				},
				data: {
					status: AppointmentStatus.CONFIRMED,
					joiningTime,
					serialNumber
				},
			});

			const newAvailableSlots = appoinment.schedule.availableSlots - 1;

			await tx.schedule.update({
				where: {
					id: appoinment.schedule.id
				},
				data: {
					availableSlots: newAvailableSlots
				}
			})

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

			const pdfDocument = new PDFDocument({ margin: 50 })

			const pdfChunks: Buffer[] = []

			pdfDocument.on("data", (chunk: Buffer) => {
				pdfChunks.push(chunk)
			})


			const pdfReadyPromise = new Promise<Buffer>((resolve) => {
				pdfDocument.on("end", () => {
					resolve(Buffer.concat(pdfChunks))
				})
			})

			pdfDocument.fontSize(20).text("SAB Healthcare System", { align: "center" })
			pdfDocument.fontSize(14).text("Appointment Invoice", { align: "center" })
			pdfDocument.moveDown(2)

			pdfDocument.fontSize(12).text(`Patient Name: ${appoinment.patient.name}`)
			pdfDocument.text(`Patient email: ${appoinment.patient.email}`)
			pdfDocument.moveDown()

			pdfDocument.text(`Doctor Name: ${appoinment.doctor.name}`)
			pdfDocument.text(`Specialization: ${appoinment.doctor.specialization}`)
			pdfDocument.moveDown()

			pdfDocument.text(`Appointment Date: ${appoinment.schedule.startDateTime.toDateString()}`)
			pdfDocument.text(`Your Joining Time: ${appoinment.joiningTime?.toString()}`)
			pdfDocument.text(`Your Serial Number: ${appoinment.serialNumber}`)
			pdfDocument.text(`Meeting Link: ${appoinment.schedule.meetingLink}`)
			pdfDocument.moveDown()

			pdfDocument.text(`Amount Paid: ${result.amount} BDT`)
			pdfDocument.text("Payment Method: Bkash")
			pdfDocument.text(`Transaction Id: ${result.trxID}`)
			pdfDocument.text(`Paid At: ${result.paymentExecuteTime}`)

			pdfDocument.end()

			const pdfBuffer = await pdfReadyPromise

			await transporter.sendMail({
				from: config.smtp_user,
				to: appoinment.patient.email,
				subject: "Your Appointment Invoice - SAB Healthcare",
				text: "Thank You For Your Booking, Please find your invoice attached.",

				attachments: [
					{
						filename: "invoice.pdf",
						content: pdfBuffer
					}
				]
			})

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

const cancelAppointment = async (payload: ICancelAppointmentPayload) => {
	const { appointmentId } = payload;

	// 1. Get appointment and payment first
	const existingAppointment = await prisma.appointment.findUnique({
		where: {
			id: appointmentId,
		},
		include: {
			payment: true,
			schedule: true,
		},
	});

	if (!existingAppointment) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"Appointment Does Not Exist",
		);
	}

	// 2. Validate appointment status
	if (
		existingAppointment.status === AppointmentStatus.ONGOING ||
		existingAppointment.status === AppointmentStatus.COMPLETED
	) {
		throw new AppError(
			httpStatus.CONFLICT,
			"Cannot cancel an ongoing or completed appointment",
		);
	}

	if (existingAppointment.status === AppointmentStatus.CANCELLED) {
		throw new AppError(
			httpStatus.CONFLICT,
			"Appointment is already cancelled",
		);
	}

	// 3. Check refund eligibility
	const now = new Date();
	const startDateTime = existingAppointment.schedule.startDateTime;

	const refundCutOffTime = subHours(startDateTime, 1);

	const isEligibleForRefund = isBefore(now, refundCutOffTime);

	let refundResult = null;

	// 4. Refund only if eligible
	if (isEligibleForRefund) {
		// Make sure payment exists
		if (!existingAppointment.payment) {
			throw new AppError(
				httpStatus.NOT_FOUND,
				"Payment does not exist for this appointment",
			);
		}

		// Get bKash token
		const bkashIdToken = await getBkashIdToken();

		if (!bkashIdToken) {
			throw new AppError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Bkash id Token is missing",
			);
		}

		// Call bKash refund API
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
					paymentID: existingAppointment.payment.bkashPaymentId,
					trxID: existingAppointment.payment.bkashTrxId,
					amount: existingAppointment.payment.amount.toString(),
					sku: "Appointment Cancellation Refund",
					reason:
						"Patient requested refund for appointment cancellation",
				}),
			},
		);

		const result = await bkashRefundedResponse.json();

		// Make sure refund was successful
		if (!bkashRefundedResponse.ok) {
			throw new AppError(
				httpStatus.INTERNAL_SERVER_ERROR,
				result?.statusMessage ||
				"Bkash refund request failed",
			);
		}

		refundResult = result;
	}

	// 5. Update database
	const transactionResult = await prisma.$transaction(async (tx) => {
		// Cancel appointment
		const updatedAppointment = await tx.appointment.update({
			where: {
				id: existingAppointment.id,
			},
			data: {
				status: AppointmentStatus.CANCELLED,
			},
		});

		// Increase available slot
		await tx.schedule.update({
			where: {
				id: existingAppointment.schedule.id,
			},
			data: {
				availableSlots: {
					increment: 1,
				},
			},
		});

		// Update payment ONLY if refund was processed
		let updatedPayment = null;

		if (isEligibleForRefund && refundResult) {
			updatedPayment = await tx.payment.update({
				where: {
					appointmentId: existingAppointment.id,
				},
				data: {
					status: PaymentStatus.REFUNDED,
					getwayResponse: refundResult,
					refundAmount: refundResult.amount,
					refundedAt: refundResult.completedTime,
					refundTrxId: refundResult.refundTrxID,
					refundReason:
						"Patient requested refund for appointment cancellation",
				},
			});
		}

		return {
			appointment: updatedAppointment,
			payment: updatedPayment,
			isEligibleForRefund,
		};
	});

	return transactionResult;
};

const updateAppointmentStatus = async (appointmentId: string, payload: IUpdateAppointmentStatusPayload, user: RequestUser) => {
	const doctor = await prisma.doctor.findUnique({
		where: {
			id: user.userId
		}
	})

	if (!doctor) {
		throw new AppError(httpStatus.NOT_FOUND, "Doctor Profile not found")
	}
	const appointment = await prisma.appointment.findUnique({
		where: {
			id: appointmentId,
			doctorId: doctor.id
		}
	})

	if (!appointment) {
		throw new AppError(httpStatus.NOT_FOUND, "Appointment Not Found")
	}
	if (appointment.status === AppointmentStatus.COMPLETED) {
		throw new AppError(httpStatus.FORBIDDEN, "Appointment is Already Completed")
	}
	if (appointment.status === AppointmentStatus.CANCELLED) {
		throw new AppError(httpStatus.FORBIDDEN, "Appointment is Already cancelled")
	}
	if (appointment.status === AppointmentStatus.PENDING) {
		throw new AppError(httpStatus.FORBIDDEN, "Appointment is pending. you can change the status after appointment is confirmed")
	}

	if (appointment.status === AppointmentStatus.CONFIRMED) {
		if (payload.status !== AppointmentStatus.ONGOING) {
			throw new AppError(httpStatus.BAD_REQUEST, "Confirmed Appointment must be ongoing at first!")
		}

		await prisma.appointment.update({
			where: {
				id: appointment.id
			},
			data: {
				status: AppointmentStatus.ONGOING
			}
		})
	}
	if (appointment.status === AppointmentStatus.ONGOING) {
		if (payload.status !== AppointmentStatus.COMPLETED) {
			throw new AppError(httpStatus.BAD_REQUEST, "Ongoing Appointment must be completed")
		}

		await prisma.appointment.update({
			where: {
				id: appointment.id
			},
			data: {
				status: AppointmentStatus.COMPLETED
			}
		})
	}

	const updatedAppointment = await prisma.appointment.findUnique({
		where: {
			id: appointment.id
		}
	})

	return updatedAppointment

}

const getMyAppointments = async (query: IQuery, user: RequestUser) => {

	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;

	const sortBy = query.sortBy || "createdAt";
	const sortOrder = query.sortOrder || "desc";


	const patient = await prisma.patient.findUnique({
		where: {
			userId: user.userId
		}
	})

	if (!patient) {
		throw new AppError(httpStatus.NOT_FOUND, "patient Profile not found")
	}

	const andConditions: AppointmentWhereInput[] = [
		{
			patientId: patient.id
		}
	];

	if (query.status) {
		andConditions.push({
			status: query.status
		})
	}
	const appointments = await prisma.appointment.findMany({
		// dynamic filtering --->
		where: {
			AND: andConditions,
		},

		//dynamic pagination part
		take: limit,
		skip: skip,

		orderBy: {
			// sortBy : sortOrder
			[sortBy]: sortOrder,
		},
		include: {
			doctor: true,
			schedule: true,
			payment: true
		},
	});

	return {
		data: appointments,
		meta: {
			page,
			limit,
			total: appointments.length,
			totalPages: Math.ceil(appointments.length / limit),
		},
	};
}

const getDoctorAppointments = async (query: IQuery, user: RequestUser) => {

	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;

	const sortBy = query.sortBy || "createdAt";
	const sortOrder = query.sortOrder || "desc";


	const doctor = await prisma.doctor.findUnique({
		where: {
			userId: user.userId
		}
	})

	if (!doctor) {
		throw new AppError(httpStatus.NOT_FOUND, "doctor Profile not found")
	}

	const andConditions: AppointmentWhereInput[] = [
		{
			patientId: doctor.id
		}
	];

	if (query.status) {
		andConditions.push({
			status: query.status
		})
	}
	const appointments = await prisma.appointment.findMany({
		// dynamic filtering --->
		where: {
			AND: andConditions,
		},

		//dynamic pagination part
		take: limit,
		skip: skip,

		orderBy: {
			// sortBy : sortOrder
			[sortBy]: sortOrder,
		},
		include: {
			doctor: true,
			schedule: true,
			payment: true
		},
	});

	return {
		data: appointments,
		meta: {
			page,
			limit,
			total: appointments.length,
			totalPages: Math.ceil(appointments.length / limit),
		},
	};
}

const getAllAppointments = async (query: IQuery) => {
	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;

	const sortBy = query.sortBy || "createdAt";
	const sortOrder = query.sortOrder || "desc";

	const andConditions: AppointmentWhereInput[] = [];

	if (query.status) {
		andConditions.push({
			status: query.status
		})
	}
	if (query.doctorId) {
		andConditions.push({
			doctorId: query.doctorId
		})
	}
	if (query.patientId) {
		andConditions.push({
			patientId: query.patientId
		})
	}
	if (query.doctorEmail) {
		andConditions.push({
			doctor: {
				email: query.doctorEmail
			}
		})
	}
	if (query.patientEmail) {
		andConditions.push({
			patient: {
				email: query.patientEmail
			}
		})
	}

	const appointments = await prisma.appointment.findMany({
		// dynamic filtering --->
		where: {
			AND: andConditions,
		},

		//dynamic pagination part
		take: limit,
		skip: skip,

		orderBy: {
			// sortBy : sortOrder
			[sortBy]: sortOrder,
		},
		include: {
			doctor: true,
			schedule: true,
			payment: true
		},
	});

	return {
		data: appointments,
		meta: {
			page,
			limit,
			total: appointments.length,
			totalPages: Math.ceil(appointments.length / limit),
		},
	};
}

const getSingleAppointment = async (appointmentId: string, user: RequestUser) => {
	const appointment = await prisma.appointment.findUnique({
		where: {
			id: appointmentId
		},
		include: {
			patient: true,
			doctor: true,
			schedule: true,
			payment: true
		}
	})

	if (!appointment) {
		throw new AppError(httpStatus.NOT_FOUND, "appointment not found")
	}

	if (user.role === Role.PATIENT) {
		if (appointment.patient.userId !== user.userId) {
			throw new AppError(httpStatus.FORBIDDEN, "You are not allowed to view this appointment")
		}
	}
	if (user.role === Role.DOCTOR) {
		if (appointment.doctor.userId !== user.userId) {
			throw new AppError(httpStatus.FORBIDDEN, "You are not allowed to view this appointment")
		}
	}

	return appointment


}

export const AppointmentServices = {
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
