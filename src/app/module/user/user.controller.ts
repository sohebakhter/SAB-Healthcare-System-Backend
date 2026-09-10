import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";
import { UserServices } from "./user.service";

const uploadProfileImage = catchAsync(async (req: Request, res: Response) => {
	// console.log(req.file, "profile image");
	if (!req.file) {
		throw new Error("Profile Picture is not Uploaded");
	}
	const userId = req.user?.userId;
	const result = await UserServices.uploadProfileImage(
		req.file?.buffer,
		userId as string,
	);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Profile Image Uploaded Successfully",
		data: result,
	});
});

export const UserController = {
	uploadProfileImage,
};
