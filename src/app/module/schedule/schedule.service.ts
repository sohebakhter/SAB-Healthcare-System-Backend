import {
	addDays,
	differenceInMinutes,
	isAfter,
	isSameDay,
	startOfDay,
} from "date-fns";
import { prisma } from "../../lib/prisma";
import { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/appError";
import httpsStatus from "http-status";
import { ISchedulePayload, IUpdateSchedulePayload } from "./schedule.interface";
import { IQuery } from "../../interfaces";
import { ScheduleWhereInput } from "../../../../generated/prisma/models";
import { ScheduleStatus } from "../../../../generated/prisma/enums";

const createSchedule = async (payload: ISchedulePayload, user: RequestUser) => {
	const doctor = await prisma.doctor.findUnique({
		where: {
			userId: user.userId,
		},
	});

	if (!doctor) {
		throw new AppError(httpsStatus.NOT_FOUND, "Doctor not Found");
	}

	const isSameDate = isSameDay(payload.startDateTime, payload.endDateTime);
	if (!isSameDate) {
		throw new AppError(
			httpsStatus.CONFLICT,
			"Provided Start Date and End Date are not in the same date",
		);
	}

	const isDateAfterTheDate = isAfter(
		payload.startDateTime,
		payload.endDateTime,
	);
	if (isDateAfterTheDate) {
		throw new AppError(
			httpsStatus.CONFLICT,
			"Start dateTime can't be after End dateTime!",
		);
	}

	const startOfTheDay = startOfDay(payload.startDateTime);
	const startOfNextDay = addDays(startOfTheDay, 1);

	const existingScheduleOnThisDate = await prisma.schedule.findFirst({
		where: {
			isDeleted: false,

			doctorId: doctor.id,

			startDateTime: {
				gte: startOfTheDay,
				lt: startOfNextDay,
			},
		},
	});

	if (existingScheduleOnThisDate) {
		throw new AppError(
			httpsStatus.CONFLICT,
			"You already have a schedule for this date",
		);
	}

	const durationInMinutes = differenceInMinutes(
		payload.startDateTime,
		payload.endDateTime,
	);

	const MINUTES_ALLOCATED_PER_SLOT = 20;
	const totalSlots = Math.floor(durationInMinutes / MINUTES_ALLOCATED_PER_SLOT);

	const schedule = await prisma.schedule.create({
		data: {
			totalSlots,
			availableSlots: totalSlots,
			startDateTime: payload.startDateTime,
			endDateTime: payload.endDateTime,
			meetingLink: payload.meetingLink,
			doctorId: doctor.id,
		},
		include: {
			doctor: {
				select: {
					name: true,
					email: true,
					contactNumber: true,
				},
			},
		},
	});

	return schedule;
};

const getMySchedules = async (query: IQuery, user: RequestUser) => {
	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;

	const sortBy = query.sortBy || "createdAt";
	const sortOrder = query.sortOrder || "desc";

	const doctor = await prisma.doctor.findUnique({
		where: {
			userId: user.userId,
		},
	});

	if (!doctor) {
		throw new AppError(httpsStatus.NOT_FOUND, "Doctor not Found");
	}

	const andConditions: ScheduleWhereInput[] = [
		{
			doctorId: doctor.id,
		},
		{
			isDeleted: false,
		},
	];

	//filtering
	if (query.status) {
		andConditions.push({
			status: query.status,
		});
	}

	const schedules = await prisma.schedule.findMany({
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
			appointments: {
				include: {
					patient: true,
				},
			},
		},
	});

	return {
		data: schedules,
		meta: {
			page,
			limit,
			total: schedules.length,
			totalPages: Math.ceil(schedules.length / limit),
		},
	};
};
const getAllSchedules = async (query: IQuery) => {
	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;

	const sortBy = query.sortBy || "createdAt";
	const sortOrder = query.sortOrder || "desc";

	const andConditions: ScheduleWhereInput[] = [];

	//filtering
	if (query.doctorId) {
		andConditions.push({
			doctorId: query.doctorId,
		});
	}
	if (query.email) {
		andConditions.push({
			doctor: { email: query.email },
		});
	}
	if (query.status) {
		andConditions.push({
			status: query.status,
		});
	}

	//searching
	if (query.searchTerm) {
		andConditions.push({
			doctor: {
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
				],
			},
		});
	}

	const schedules = await prisma.schedule.findMany({
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
			appointments: {
				include: {
					patient: true,
				},
			},
		},
	});

	return {
		data: schedules,
		meta: {
			page,
			limit,
			total: schedules.length,
			totalPages: Math.ceil(schedules.length / limit),
		},
	};
};

const getScheduleById = async (scheduleId: string) => {
	const schedule = await prisma.schedule.findUnique({
		where: {
			id: scheduleId,
		},
		include: {
			doctor: {
				select: {
					id: true,
					name: true,
					email: true,
					specialization: true,
					userId: true,
				},
			},
			appointments: {
				include: {
					patient: true,
				},
			},
		},
	});

	if (!schedule || schedule.isDeleted) {
		throw new AppError(httpsStatus.NOT_FOUND, "Schedule Not Found");
	}

	return schedule;
};

const updateSchedule = async (
	scheduleId: string,
	payload: IUpdateSchedulePayload,
	user: RequestUser,
) => {
	const doctor = await prisma.doctor.findUnique({
		where: {
			userId: user.userId,
		},
	});

	if (!doctor) {
		throw new AppError(httpsStatus.NOT_FOUND, "Doctor Profile Not Found");
	}

	const schedule = await prisma.schedule.findUnique({
		where: {
			id: scheduleId,
		},
	});

	if (!schedule) {
		throw new AppError(httpsStatus.NOT_FOUND, "Schedule not found ");
	}

	if (
		schedule.status === ScheduleStatus.PUBLISHED &&
		schedule.totalSlots !== schedule.availableSlots
	) {
		throw new AppError(
			httpsStatus.BAD_REQUEST,
			"You can't update, because schedule is published and slots are not equal",
		);
	}

	payload.startDateTime = payload.startDateTime || schedule.startDateTime;
	payload.endDateTime = payload.endDateTime || schedule.endDateTime;
	payload.meetingLink = payload.meetingLink || schedule.meetingLink;

	const isSameDate = isSameDay(payload.startDateTime, payload.endDateTime);
	if (!isSameDate) {
		throw new AppError(
			httpsStatus.CONFLICT,
			"Provided Start Date and End Date are not in the same date",
		);
	}

	const isDateAfterTheDate = isAfter(
		payload.startDateTime,
		payload.endDateTime,
	);
	if (isDateAfterTheDate) {
		throw new AppError(
			httpsStatus.CONFLICT,
			"Start dateTime can't be after End dateTime!",
		);
	}
	//---------
	const startOfTheDay = startOfDay(payload.startDateTime);
	const startOfNextDay = addDays(startOfTheDay, 1);

	const existingScheduleOnThisDate = await prisma.schedule.findFirst({
		where: {
			doctorId: doctor.id,
			isDeleted: false,

			startDateTime: {
				gte: startOfTheDay,
				lt: startOfNextDay,
			},
		},
	});

	if (existingScheduleOnThisDate) {
		throw new AppError(
			httpsStatus.CONFLICT,
			"You already have a schedule for this date",
		);
	}

	const durationInMinutes = differenceInMinutes(
		payload.startDateTime,
		payload.endDateTime,
	);

	const MINUTES_ALLOCATED_PER_SLOT = 20;
	const totalSlots = Math.floor(durationInMinutes / MINUTES_ALLOCATED_PER_SLOT);

	const updatedSchedule = await prisma.schedule.update({
		where: { id: schedule.id },
		data: {
			totalSlots,
			availableSlots: totalSlots,
			startDateTime: payload.startDateTime,
			endDateTime: payload.endDateTime,
			meetingLink: payload.meetingLink,
			doctorId: doctor.id,
		},
		include: {
			doctor: {
				select: {
					name: true,
					email: true,
					contactNumber: true,
				},
			},
		},
	});

	return updatedSchedule;
};

const publishSchedule = async (scheduleId: string, user: RequestUser) => {
	const doctor = await prisma.doctor.findUnique({
		where: {
			userId: user.userId,
		},
	});

	if (!doctor) {
		throw new AppError(httpsStatus.NOT_FOUND, "Doctor Profile Not Found");
	}

	const schedule = await prisma.schedule.findUnique({
		where: {
			id: scheduleId,
			doctorId: doctor.id,
		},
	});

	if (!schedule || schedule.isDeleted) {
		throw new AppError(httpsStatus.NOT_FOUND, "Schedule not found ");
	}

	if (schedule.status === ScheduleStatus.PUBLISHED) {
		throw new AppError(
			httpsStatus.BAD_REQUEST,
			"You can't published again, because schedule is already published ",
		);
	}

	const publishedSchedule = await prisma.schedule.update({
		where: {
			id: schedule.id,
		},
		data: {
			status: ScheduleStatus.PUBLISHED,
		},
	});

	return publishedSchedule;
};
const deleteSchedule = async (scheduleId: string, user: RequestUser) => {
	const doctor = await prisma.doctor.findUnique({
		where: {
			userId: user.userId,
		},
	});

	if (!doctor) {
		throw new AppError(httpsStatus.NOT_FOUND, "Doctor Profile Not Found");
	}

	const schedule = await prisma.schedule.findUnique({
		where: {
			id: scheduleId,
			doctorId: doctor.id,
		},
	});

	if (!schedule || schedule.isDeleted) {
		throw new AppError(httpsStatus.NOT_FOUND, "Schedule not found ");
	}

	if (
		schedule.status === ScheduleStatus.PUBLISHED &&
		schedule.totalSlots !== schedule.availableSlots
	) {
		throw new AppError(
			httpsStatus.BAD_REQUEST,
			"You can't delete, because schedule is published and slots are booked",
		);
	}

	const deletedSchedule = await prisma.schedule.update({
		where: {
			id: schedule.id,
		},
		data: {
			isDeleted: true,
			deletedAt: new Date(),
		},
	});

	return deletedSchedule;
};

const getTodaysSchedules = async (query: IQuery) => {
	if (query.doctorId) {
		throw new AppError(httpsStatus.NOT_FOUND, "Doctor Query not found");
	}
	const doctor = await prisma.doctor.findUnique({
		where: {
			id: query.doctorId,
		},
	});

	if (!doctor) {
		throw new AppError(httpsStatus.NOT_FOUND, "Doctor Profile Not Found");
	}

	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;

	const sortBy = query.sortBy || "createdAt";
	const sortOrder = query.sortOrder || "desc";

	const now = new Date();

	const startOfToday = startOfDay(now);
	const startOfTomorrow = addDays(startOfToday, 1);

	const andConditions: ScheduleWhereInput[] = [
		{
			doctorId: query.doctorId,
		},
		{
			isDeleted: false,
		},
		{
			status: ScheduleStatus.PUBLISHED,
		},
		{
			startDateTime: {
				gte: startOfToday,
				lt: startOfTomorrow,
				gt: now,
			},
		},
		{
			availableSlots: { gt: 0 },
		},
	];

	const schedules = await prisma.schedule.findMany({
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
	});

	return {
		data: schedules,
		meta: {
			page,
			limit,
			total: schedules.length,
			totalPages: Math.ceil(schedules.length / limit),
		},
	};
};

export const ScheduleServices = {
	createSchedule,
	getMySchedules,
	getAllSchedules,
	getScheduleById,
	updateSchedule,
	publishSchedule,
	deleteSchedule,
	getTodaysSchedules,
};
