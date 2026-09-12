import config from "../../config";
import { getBkashIdToken } from "../../lib/bkash";

const bookAppointment = async () => {
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
				payerReference: "01723888888", //user email or phone number
				callbackURL: `${config.bkash_callback_url}/appointment/book-appointment/payment/callback`,
				merchantAssociationInfo: "MI05MID54RF09123456One",
				amount: "1200",
				currency: "BDT",
				intent: "sale",
				merchantInvoiceNumber: "Inv0124", // appiontment id
			}),
		},
	);

	const result = await res.json();

	return result;
};

const bookAppointmentCallback = async (query: Record<string, any>) => {
	const paymentId = query.paymentID;
	if (!paymentId) {
		throw new Error("Payment ID Missing");
	}
	const status = query.status;
	if (!status) {
		throw new Error("Payment Status is Missing");
	}

	const bkashIdToken = await getBkashIdToken();

	if (!bkashIdToken) {
		throw new Error("Bkash id Token is missing");
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
		return {
			result,
			redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=success`,
		};
	}
	if (status === "failure") {
		return {
			result,
			redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=failure`,
		};
	}
	if (status === "cancel") {
		return {
			result,
			redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=cancel`,
		};
	}

	return {
		result,
		redirectUrl: `${config.frontend_url}/dashboard/my-appointments`,
	};
};

export const AppointmentServices = {
	bookAppointment,
	bookAppointmentCallback,
};
