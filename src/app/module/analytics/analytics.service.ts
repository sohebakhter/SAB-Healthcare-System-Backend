import { AppointmentStatus, DoctorVerificationStatus, PaymentStatus, ScheduleStatus } from "../../../../generated/prisma/enums"
import { prisma } from "../../lib/prisma"
import { RequestUser } from "../../middleware/checkAuth"
import { AppError } from "../../utils/appError"
import httpStatus from "http-status"

const getAdminAnalytics = async () => {
    const totalDoctors = await prisma.doctor.count({
        where: {
            isDeleted: false
        }
    })
    const totalPendingDoctors = await prisma.doctor.count({
        where: {
            isDeleted: false,
            status: DoctorVerificationStatus.PENDING
        }
    })
    const totalApprovedDoctors = await prisma.doctor.count({
        where: {
            isDeleted: false,
            status: DoctorVerificationStatus.APPROVED
        }
    })
    const totalRejectedDoctors = await prisma.doctor.count({
        where: {
            isDeleted: false,
            status: DoctorVerificationStatus.REJECTED
        }
    })

    const totalPatients = await prisma.patient.count({
        where: {
            isDeleted: false
        }
    })
    const totalAppointments = await prisma.appointment.count({})
    const totalCompletedAppointments = await prisma.appointment.count({
        where: {
            status: AppointmentStatus.COMPLETED
        }
    })
    const totalCancelledAppointments = await prisma.appointment.count({
        where: {
            status: AppointmentStatus.CANCELLED
        }
    })

    const totalRefundResult = await prisma.payment.aggregate({
        where: {
            status: PaymentStatus.REFUNDED
        },
        _sum: {
            amount: true
        }
    })
    const totalRefund = Number(totalRefundResult._sum.amount) || 0

    const totalRevenueResult = await prisma.payment.aggregate({
        where: {
            status: PaymentStatus.PAID
        },
        _sum: {
            amount: true
        }
    })

    const totalRevenue = Number(totalRevenueResult._sum.amount) || 0 - totalRefund


    return {
        totalDoctors,
        totalApprovedDoctors,
        totalPendingDoctors,
        totalRejectedDoctors,
        totalPatients,
        totalAppointments,
        totalCompletedAppointments,
        totalCancelledAppointments,
        totalRefund,
        totalRevenue
    }
}

const getPatientAnalytics = async (user: RequestUser) => {
    const patient = await prisma.patient.findUnique({
        where: {
            userId: user.userId
        }
    })

    if (!patient) {
        throw new AppError(httpStatus.NOT_FOUND, "Patient not found")
    }

    const totalAppointments = await prisma.appointment.count({
        where: {
            patientId: patient.id
        }
    })
    const totalUpcomingAppointments = await prisma.appointment.count({
        where: {
            patientId: patient.id,
            status: AppointmentStatus.CONFIRMED
        }
    })
    const totalCompletedAppointments = await prisma.appointment.count({
        where: {
            patientId: patient.id,
            status: AppointmentStatus.COMPLETED
        }
    })
    const totalCancelledAppointments = await prisma.appointment.count({
        where: {
            patientId: patient.id,
            status: AppointmentStatus.CANCELLED
        }
    })

    const totalAmountSpentResult = await prisma.payment.aggregate({
        where: {
            appointment: {
                patientId: patient.id
            },
            status: PaymentStatus.PAID
        },
        _sum: {
            amount: true
        }
    })

    const totalAmountSpent = totalAmountSpentResult._sum.amount?.toNumber() || 0


    const totalRefundedResult = await prisma.payment.aggregate({
        where: {
            appointment: {
                patientId: patient.id
            },
            status: PaymentStatus.REFUNDED
        },
        _sum: {
            amount: true
        }
    })
    const totalRefunded = totalRefundedResult._sum.amount?.toNumber() || 0
    return {
        totalAppointments,
        totalUpcomingAppointments,
        totalCompletedAppointments,
        totalCancelledAppointments,
        totalAmountSpent,
        totalRefunded
    }
}

const getDoctorAnalytics = async (user: RequestUser) => {
    const doctor = await prisma.doctor.findUnique({
        where: {
            userId: user.userId
        }
    })

    if (!doctor) {
        throw new AppError(httpStatus.NOT_FOUND, "Doctor not found")
    }

    const totalSchedules = await prisma.schedule.count({
        where: {
            doctorId: doctor.id,
            isDeleted: false
        }
    })
    const publishedSchedules = await prisma.schedule.count({
        where: {
            doctorId: doctor.id,
            isDeleted: false,
            status: ScheduleStatus.PUBLISHED
        }
    })

    const totalAppointments = await prisma.appointment.count({
        where: {
            doctorId: doctor.id
        }
    })
    const totalUpcomingAppointments = await prisma.appointment.count({
        where: {
            doctorId: doctor.id,
            status: AppointmentStatus.CONFIRMED
        }
    })
    const totalOngoingAppointments = await prisma.appointment.count({
        where: {
            doctorId: doctor.id,
            status: AppointmentStatus.ONGOING
        }
    })
    const totalCompletedAppointments = await prisma.appointment.count({
        where: {
            doctorId: doctor.id,
            status: AppointmentStatus.COMPLETED
        }
    })
    const totalCancelledAppointments = await prisma.appointment.count({
        where: {
            doctorId: doctor.id,
            status: AppointmentStatus.CANCELLED
        }
    })

    const totalDoctorRefundedResult = await prisma.payment.aggregate({
        where: {
            appointment: {
                doctorId: doctor.id,

            },
            status: PaymentStatus.REFUNDED
        },
        _sum: {
            amount: true
        }
    })
    const totalDoctorRefunded = totalDoctorRefundedResult._sum.amount?.toNumber() || 0

    const totalDoctorEarningResult = await prisma.payment.aggregate({
        where: {
            appointment: {
                doctorId: doctor.id,

            },
            status: PaymentStatus.PAID
        },
        _sum: {
            amount: true
        }
    })
    const totalDoctorEarnings = (totalDoctorEarningResult._sum.amount?.toNumber() || 0) - totalDoctorRefunded
    return {
        totalSchedules,
        publishedSchedules,
        totalAppointments,
        totalUpcomingAppointments,
        totalOngoingAppointments,
        totalCompletedAppointments,
        totalCancelledAppointments,
        totalDoctorEarnings,
        totalDoctorRefunded

    }
}

export const AnalyticsServices = {
    getAdminAnalytics,
    getPatientAnalytics,
    getDoctorAnalytics
}