import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload, Secret } from "jsonwebtoken";
import ApiError from "../utils/ApiError";
import asyncHandler from "../utils/asyncHandler";
import { IUser, User } from "../models/user.model";
import { TokenBlacklist } from "../models/tokenBlacklist.model";

export interface AuthenticatedRequest extends Request {
    user: IUser;
}

const isAuthenticated = asyncHandler(
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const token: string =
                req.cookies?.accessToken ||
                (req.headers?.authorization?.startsWith("Bearer ") &&
                    req.headers.authorization.split(" ")[1]);

            if (!token)
                throw new ApiError(401, "No token, authorization denied");

            const isBlacklisted = await TokenBlacklist.findOne({ token });
            if (isBlacklisted)
                throw new ApiError(401, "Token has been invalidated");

            const decoded = jwt.verify(
                token,
                process.env.ACCESS_TOKEN_SECRET as Secret
            ) as JwtPayload;

            const user = await User.findById(decoded?._id).select(
                "-password -refreshToken"
            );

            if (!user) throw new ApiError(401, "Invalid Access Token");

            req.user = user;
            next();
        } catch (error) {
            if (error instanceof Error)
                throw new ApiError(
                    400,
                    error.message || "Invalid access token"
                );
        }
    }
);

export default isAuthenticated;
