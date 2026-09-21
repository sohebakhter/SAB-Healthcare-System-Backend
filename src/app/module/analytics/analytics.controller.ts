import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status"
import { AnalyticsServices } from "./analytics.service";

const getAdminAnalytics = catchAsync(async (req: Request, res: Response) => {

    const result = await AnalyticsServices.getAdminAnalytics();
    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: "getAdminAnalytics Successfully",
        data: result,
    });
});
const getPatientAnalytics = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const result = await AnalyticsServices.getPatientAnalytics(user);
    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: "getPatientAnalytics Successfully",
        data: result,
    });
});
const getDoctorAnalytics = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const result = await AnalyticsServices.getDoctorAnalytics(user);
    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: "getDoctorAnalytics Successfully",
        data: result,
    });
});


export const AnalyticsController = {
    getAdminAnalytics,
    getPatientAnalytics,
    getDoctorAnalytics
}