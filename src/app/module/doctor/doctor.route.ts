import { Router } from "express";
import { doctorController } from "./doctor.controller";
import { upload } from "../../lib/multer";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../../generated/prisma/enums";
import { validateRequest } from "../../middleware/validateRequest";
import { UpdateDoctorProfileZodSchema } from "./doctor.validation";

const router = Router();

router.post(
	"/apply-as-doctor",
	upload.fields([
		{ name: "resume", maxCount: 1 },
		{ name: "additionalFiles", maxCount: 10 },
	]),
	doctorController.applyAsDoctor,
);

router.post(
	"/apply-as-doctor/verify-email",
	doctorController.verifyDoctorEmail,
);

router.post(
	"/approve-doctor",
	auth(Role.ADMIN, Role.SUPER_ADMIN),
	doctorController.approveDoctor,
);
router.post(
	"/all-doctors",
	auth(Role.ADMIN, Role.SUPER_ADMIN),
	doctorController.getAllDoctors,
);
router.patch(
	"/update-my-profile",
	auth(Role.DOCTOR),
	validateRequest(UpdateDoctorProfileZodSchema),
	doctorController.updateDoctorProfile,
);

router.get(
	"/public/available-today",
	doctorController.getAvailableDoctorByTodaysSchedule,
);
router.get("/public/all-doctors", doctorController.getAllDoctorsListPublic);
router.get("/public/:doctorId", doctorController.getSingleDoctorPublicProfile);

export const doctorRoutes = router;
