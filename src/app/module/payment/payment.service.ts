import { Role } from "../../../../generated/prisma/enums"
import { PaymentWhereInput } from "../../../../generated/prisma/models"
import { IQuery } from "../../interfaces"
import { prisma } from "../../lib/prisma"
import { RequestUser } from "../../middleware/checkAuth"
import { AppError } from "../../utils/appError"
import httpStatus from "http-status"

const getMyPayments = async (query: IQuery, user: RequestUser) => {
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
        throw new AppError(httpStatus.NOT_FOUND, "patient not Found");
    }

    const andConditions: PaymentWhereInput[] = [
        {
            appointment: { patientId: patient.id }
        }
    ];

    const payments = await prisma.payment.findMany({
        where: { AND: andConditions },

        //dynamic pagination part
        take: limit,
        skip: skip,

        orderBy: {
            // sortBy : sortOrder
            [sortBy]: sortOrder,
        },
        include: {
            appointment: {
                include: {
                    doctor: true,
                    schedule: true
                }
            }
        },
    });

    return {
        data: payments,
        meta: {
            page,
            limit,
            total: payments.length,
            totalPages: Math.ceil(payments.length / limit),
        },
    };

}
const getAllPayments = async (query: IQuery) => {
    const limit = query.limit ? Number(query.limit) : 10;
    const page = query.page ? Number(query.page) : 1;
    const skip = (page - 1) * limit;

    const sortBy = query.sortBy || "createdAt";
    const sortOrder = query.sortOrder || "desc";

    const andConditions: PaymentWhereInput[] = [];

    if (query.patientEmail) {
        andConditions.push({
            appointment: {
                patient: {
                    email: query.patientEmail
                }
            }
        })
    }

    const payments = await prisma.payment.findMany({
        where: { AND: andConditions },

        //dynamic pagination part
        take: limit,
        skip: skip,

        orderBy: {
            // sortBy : sortOrder
            [sortBy]: sortOrder,
        },
        include: {
            appointment: {
                include: {
                    doctor: true,
                    schedule: true
                }
            }
        },
    });

    return {
        data: payments,
        meta: {
            page,
            limit,
            total: payments.length,
            totalPages: Math.ceil(payments.length / limit),
        },
    };
}
const getSinglePayment = async (paymentId: string, user: RequestUser) => {
    const payment = await prisma.payment.findUnique({
        where: {
            id: paymentId
        },
        include: {
            appointment: {
                include: {
                    patient: true,
                    doctor: true,
                    schedule: true,
                }
            }
        }
    })

    if (!payment) {
        throw new AppError(httpStatus.NOT_FOUND, "payment not found")
    }

    if (user.role === Role.PATIENT) {
        if (payment.appointment.patient.userId !== user.userId) {
            throw new AppError(httpStatus.FORBIDDEN, "You are not allowed to view this payment")
        }
    }

    return payment

}


export const PaymentServices = {
    getMyPayments,
    getAllPayments,
    getSinglePayment,
}