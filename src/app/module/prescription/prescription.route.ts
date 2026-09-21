import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../../generated/prisma/enums";
import { PrescriptionController } from "./prescription.controller";
import { validateRequest } from "../../middleware/validateRequest";
import { CreatePrescriptionZodSchema } from "./prescription.validation";

const router = Router();

router.post(
	"/create-prescription",
	auth(Role.DOCTOR),
	validateRequest(CreatePrescriptionZodSchema),
	PrescriptionController.createPrescription,
);
router.get(
	"/:appointmentId",
	auth(Role.PATIENT, Role.DOCTOR, Role.ADMIN, Role.SUPER_ADMIN),
	PrescriptionController.getSinglePrescription,
);

export const PrescriptionRoutes = router;
