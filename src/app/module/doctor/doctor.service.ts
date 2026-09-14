import type { UploadApiResponse } from "cloudinary";
import { cloudinary } from "../../lib/coudinary";
import { prisma } from "../../lib/prisma";
import {
	DoctorVerificationStatus,
	Role,
} from "../../../../generated/prisma/enums";
import bcrypt from "bcryptjs";
import config from "../../config";
import crypto from "crypto";
import { transporter } from "../../lib/nodemailer";
import path from "path";
import ejs from "ejs";
import { redisClient } from "../../lib/redis";
import type {
	IApplyAsDoctorPayload,
	IApproveDoctorPayload,
	IVerifyDoctorEmailPayload,
} from "./doctor.interface";
import type { RequestUser } from "../../middleware/checkAuth";
import type { IQuery } from "../../interfaces";
import type { DoctorWhereInput } from "../../../../generated/prisma/models";

const applyAsDoctor = async (
	payload: IApplyAsDoctorPayload,
	resume: Express.Multer.File | undefined,
	additionalFiles: Express.Multer.File[] | undefined,
) => {
	const existingUser = await prisma.user.findUnique({
		where: {
			email: payload.user.email,
		},
	});

	if (existingUser) {
		throw new Error("User with this email already exists");
	}

	const resumeCloudinaryResult = await new Promise<UploadApiResponse>(
		(resolve, reject) => {
			cloudinary.uploader
				.upload_stream({ resource_type: "auto" }, (error, result) => {
					if (error) {
						reject(error);
					}
					if (!result) {
						return reject(new Error("No result returned from Cloudinary"));
					}
					resolve(result);
				})
				.end(resume?.buffer);
		},
	);

	const additionalFilesCloudinaryResult = await Promise.all(
		(additionalFiles || []).map((file) => {
			return new Promise<UploadApiResponse>((resolve, reject) => {
				cloudinary.uploader
					.upload_stream({ resource_type: "auto" }, (error, result) => {
						if (error) {
							reject(error);
						}
						if (!result) {
							return reject(new Error("No result returned from Cloudinary"));
						}
						resolve(result);
					})
					.end(file.buffer);
			});
		}),
	);

	const randomPassword = Math.random().toString(36).slice(-8);
	const hashedPassword = await bcrypt.hash(
		randomPassword,
		Number(config.bcrypt_salt_rounds),
	);
	const doctorApplication = await prisma.user.create({
		data: {
			...payload.user,
			role: Role.DOCTOR,
			password: hashedPassword,
			needPasswordChange: true,
			doctor: {
				create: {
					name: payload.user.name,
					email: payload.user.email,
					...payload.doctor,
					resume: resumeCloudinaryResult?.secure_url,
					resumePublicId: resumeCloudinaryResult?.public_id,
					additionalFiles: additionalFilesCloudinaryResult.map((file) => ({
						url: file.secure_url,
						publicId: file.public_id,
					})),
				},
			},
		},
		include: {
			doctor: true,
		},
	});

	const otpKey = `doctor-application-otp:${payload.user.email}`;
	const otpValue = crypto.randomInt(100000, 1000000).toString();

	await redisClient.set(otpKey, otpValue, {
		expiration: {
			type: "EX",
			value: 60 * 60, // 1 hour
		},
	});

	const templatePath = path.join(
		process.cwd(),
		"src/app/templates/user-registration-otp.ejs",
	);
	const templateData = {
		name: payload.user.name,
		email: payload.user.email,
		otp: otpValue,
		expirationTime: "1 hour",
	};

	const html = await ejs.renderFile(templatePath, templateData);

	await transporter.sendMail({
		from: config.smtp_user,
		to: payload.user.email,
		subject: "Verify Your Email - Doctor Application",
		html,
	});

	return doctorApplication;
};

const verifyDoctorEmail = async (payload: IVerifyDoctorEmailPayload) => {
	const { email, otp } = payload;

	const isDoctorExists = await prisma.user.findUnique({
		where: { email, role: Role.DOCTOR },
		include: { doctor: true },
	});

	if (!isDoctorExists) {
		throw new Error("Doctor with this email does not exist");
	}

	if (!isDoctorExists.emailVerified) {
		throw new Error("Doctor's email is not verified yet");
	}

	const otpKey = `doctor-application-otp:${email}`;
	const storedOtp = await redisClient.get(otpKey);

	if (!storedOtp) {
		throw new Error("OTP has expired or is invalid");
	}
	if (storedOtp !== otp) {
		throw new Error("Invalid OTP");
	}
	await redisClient.del(otpKey);

	const verifiedDoctor = await prisma.user.update({
		where: { email: isDoctorExists.email },
		data: { emailVerified: true },
		omit: {
			password: true,
		},
		include: {
			doctor: true,
		},
	});

	return verifiedDoctor;
};

const approveDoctor = async (
	payload: IApproveDoctorPayload,
	reviewer: RequestUser,
) => {
	const { doctorId, verificationStatus, rejectionReason } = payload;
	const existingDoctor = await prisma.doctor.findUnique({
		where: { id: doctorId },
		include: { user: true },
	});

	if (!existingDoctor) {
		throw new Error("Doctor not found");
	}

	if (existingDoctor.isDeleted) {
		throw new Error(
			"Doctor has been deleted and cannot be approved or rejected",
		);
	}

	if (existingDoctor.verificationStatus === DoctorVerificationStatus.APPROVED) {
		throw new Error("Doctor is already approved");
	}

	if (existingDoctor.user.emailVerified === false) {
		throw new Error("Doctor's email is not verified yet");
	}

	if (existingDoctor.verificationStatus !== DoctorVerificationStatus.PENDING) {
		throw new Error(
			`Doctor is already ${existingDoctor.verificationStatus.toLowerCase()}`,
		);
	}

	if (
		verificationStatus === DoctorVerificationStatus.REJECTED &&
		!rejectionReason
	) {
		throw new Error("Rejection reason is required when rejecting a doctor");
	}

	const updatedDoctor = await prisma.doctor.update({
		where: { id: doctorId },
		data: {
			verificationStatus,
			rejectionReason:
				verificationStatus === DoctorVerificationStatus.REJECTED
					? rejectionReason
					: null,
			reviewedBy: reviewer.userId,
			reviewedAt: new Date(),
		},
		include: {
			user: true,
		},
	});

	const isDoctorApproved =
		verificationStatus === DoctorVerificationStatus.APPROVED;

	const templatePath = path.join(
		process.cwd(),
		isDoctorApproved
			? "src/app/templates/doctor-approve-email.ejs"
			: "src/app/templates/doctor-reject-email.ejs",
	);

	const templateData = {
		name: updatedDoctor.user.name,
	};

	const html = await ejs.renderFile(templatePath, templateData);

	await transporter.sendMail({
		from: config.smtp_user,
		to: updatedDoctor.user.email,
		subject: isDoctorApproved
			? "Your Doctor Application has been Approved"
			: "Your Doctor Application has been Rejected",
		html,
	});

	return updatedDoctor;
};

const getAllDoctors = async (query: IQuery) => {
	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;

	const sortBy = query.sortBy || "createdAt";
	const sortOrder = query.sortOrder || "desc";

	const andConditions: DoctorWhereInput[] = [];

	//searching
	if (query.searchTerm) {
		andConditions.push({
			OR: [
				{
					name: {
						contains: query.searchTerm,
						mode: "insensitive",
					},
				},
				{
					email: {
						contains: query.searchTerm,
						mode: "insensitive",
					},
				},
				{
					specialization: {
						contains: query.searchTerm,
						mode: "insensitive",
					},
				},
				{
					licenseNumber: {
						contains: query.searchTerm,
						mode: "insensitive",
					},
				},
			],
		});
	}

	//filtering
	if (query.name) {
		andConditions.push({
			name: query.name,
		});
	}
	if (query.email) {
		andConditions.push({
			email: query.email,
		});
	}
	if (query.specialization) {
		andConditions.push({
			specialization: query.specialization,
		});
	}
	if (query.licenseNumber) {
		andConditions.push({
			licenseNumber: query.licenseNumber,
		});
	}
	if (query.verificationStatus) {
		andConditions.push({
			verificationStatus: query.verificationStatus as DoctorVerificationStatus,
		});
	}
	// fixed filtering for doctors those are not deleted
	andConditions.push({
		isDeleted: false,
	});

	const doctors = await prisma.doctor.findMany({
		// dynamic searching, filtering --->
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
			user: {
				omit: {
					password: true,
				},
			},
			//schedules: true,
			//appointments: true,
			//prescriptions: true,
		},
	});

	return {
		data: doctors,
		meta: {
			page,
			limit,
			total: doctors.length,
			totalPages: Math.ceil(doctors.length / limit),
		},
	};
};

export const doctorServices = {
	applyAsDoctor,
	verifyDoctorEmail,
	approveDoctor,
	getAllDoctors,
};
