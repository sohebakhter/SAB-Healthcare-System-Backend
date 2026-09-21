import { AppointmentStatus, Role } from "../../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { RequestUser } from "../../middleware/checkAuth"
import { AppError } from "../../utils/appError";
import httpStatus from "http-status"
import PDFDocument from "pdfkit"
import { ICreatePrescriptionPayload } from "./prescription.interface";
import { UploadApiResponse } from "cloudinary";
import { cloudinary } from "../../lib/coudinary";
import { transporter } from "../../lib/nodemailer";
import config from "../../config";

const createPrescription = async (payload: ICreatePrescriptionPayload, user: RequestUser) => {

    const doctor = await prisma.doctor.findUnique({
        where: {
            userId: user.userId,
        },
    });

    if (!doctor) {
        throw new AppError(httpStatus.NOT_FOUND, "Doctor Profile Not Found");
    }
    const appointment = await prisma.appointment.findUnique({
        where: {
            id: payload.appointmentId, doctorId: doctor.id
        },
        include: { patient: true }
    });

    if (!appointment) {
        throw new AppError(httpStatus.NOT_FOUND, "Appointment Not Found");
    }

    if (appointment.status !== AppointmentStatus.COMPLETED) {
        throw new AppError(httpStatus.BAD_REQUEST, "Prescription can be written for completed appointment");
    }
    if (appointment.prescriptionUrl) {
        throw new AppError(httpStatus.CONFLICT, "Prescription already exists for this appointment");
    }


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

    //pdf content
    pdfDocument.fontSize(20).text("SAB Healthcare System", { align: "center" })
    pdfDocument.fontSize(14).text("Prescription", { align: "center" })
    pdfDocument.moveDown(2)

    pdfDocument.fontSize(12).text(`Patient Name: ${appointment.patient.name}`)
    pdfDocument.text(`Doctor Name: ${doctor.name}`)
    pdfDocument.text(`Specialization: ${doctor.specialization}`)
    pdfDocument.text(`Date: ${new Date().toDateString()}`)
    pdfDocument.moveDown()

    pdfDocument.fontSize(14).text(`Finding`)
    pdfDocument.fontSize(12).text(`${payload.findings}`)
    pdfDocument.moveDown()

    pdfDocument.fontSize(14).text(`Medicines`)
    pdfDocument.moveDown(0.5)

    for (let i = 0; i < payload.medicines.length; i++) {

        const medicine = payload.medicines[i]

        pdfDocument.fontSize(12).text(`${i + 1}. ${medicine.name}`)
        pdfDocument.text(`Dosage: ${medicine.dosage}`)
        pdfDocument.text(`Duration: ${medicine.name}`)

        if (medicine.instructions) {
            pdfDocument.text(`Instructions: ${medicine.instructions}`)
        }
        pdfDocument.moveDown(0.5)
    }

    pdfDocument.end()

    const pdfBuffer = await pdfReadyPromise

    const uploadResult = await new Promise<UploadApiResponse>(
        (resolve, reject) => {
            cloudinary.uploader
                .upload_stream({ resource_type: "raw", format: "pdf" }, (error, result) => {
                    if (error) {
                        reject(error);
                    }
                    if (!result) {
                        return reject(new AppError(httpStatus.BAD_REQUEST, "No result returned from Cloudinary"));
                    }
                    resolve(result);
                })
                .end(pdfBuffer);
        },
    );

    const updatedAppointment = await prisma.appointment.update({
        where: {
            id: appointment.id
        },
        data: {
            prescriptionUrl: uploadResult.secure_url,
            prescriptionPublicId: uploadResult.public_id
        }
    })

    await transporter.sendMail({
        from: config.smtp_user,
        to: appointment.patient.email,
        subject: "Your Prescription - PH Healthcare System",
        text: "Please find your prescription attached.",
        attachments: [
            {
                filename: "prescription.pdf",
                content: pdfBuffer
            }
        ]
    });

    return updatedAppointment

}

const getSinglePrescription = async (appointmentId: string, user: RequestUser) => {
    const appointment = await prisma.appointment.findUnique({
        where: {
            id: appointmentId
        },
        include: { patient: true, doctor: true, }
    });

    if (!appointment) {
        throw new AppError(httpStatus.NOT_FOUND, "Appointment Not Found");
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

    if (!appointment.prescriptionUrl) {
        throw new AppError(httpStatus.NOT_FOUND, "No prescription has been written yet.")
    }


    return {
        appointment,
        prescription: appointment.prescriptionUrl
    }
}

export const PrescriptionServices = {
    createPrescription,
    getSinglePrescription
}