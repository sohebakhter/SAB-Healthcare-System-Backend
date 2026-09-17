import config from "../config";
import httpStatus from "http-status";
import { redisClient } from "./redis";
import { AppError } from "../utils/appError";

export const getBkashIdToken = async () => {
	try {
		const idTokenKey = "bkash:idToken";
		const refreshTokenKey = "bkash:refreshToken";

		let bkashIdToken = await redisClient.get(idTokenKey);
		const bkashIdTokenTTL = await redisClient.ttl(idTokenKey);

		const bkashRefreshToken = await redisClient.get(refreshTokenKey);
		const bkashRefreshTokenTTL = await redisClient.ttl(refreshTokenKey);

		if (
			(bkashIdTokenTTL <= 600 || !bkashIdToken) &&
			bkashRefreshToken &&
			bkashRefreshTokenTTL > 600
		) {
			const refreshTokenRes = await fetch(
				`${config.bkash_base_url}/tokenized/checkout/token/refresh`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Accept: "application/json",
						username: config.bkash_username,
						password: config.bkash_password,
					},
					body: JSON.stringify({
						app_key: config.bkash_app_key,
						app_secret: config.bkash_app_secret,
						refresh_token: bkashRefreshToken,
					}),
				},
			);
			const data = await refreshTokenRes.json();
			bkashIdToken = data.id_token as string;

			await redisClient.set(idTokenKey, bkashIdToken, {
				expiration: {
					type: "EX",
					value: 60 * 60,
				},
			});

			return bkashIdToken;
		}

		if (bkashIdTokenTTL > 600) {
			return bkashIdToken;
		}

		const res = await fetch(
			`${config.bkash_base_url}/tokenized/checkout/token/grant`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
					username: config.bkash_username,
					password: config.bkash_password,
				},
				body: JSON.stringify({
					app_key: config.bkash_app_key,
					app_secret: config.bkash_app_secret,
				}),
			},
		);

		const data = await res.json();

		//id token set
		await redisClient.set(idTokenKey, data.id_token, {
			expiration: {
				type: "EX",
				value: 60 * 60,
			},
		});
		//refresh token set
		await redisClient.set(refreshTokenKey, data.refresh_token, {
			expiration: {
				type: "EX",
				value: 60 * 60 * 24 * 28,
			},
		});
		// ----->
		bkashIdToken = data.id_token;

		return data.id_token;
	} catch (error: any) {
			 throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, error.message);
	}
};
