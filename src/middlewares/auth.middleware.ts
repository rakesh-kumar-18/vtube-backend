import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload, Secret } from "jsonwebtoken";
import ApiError from "../utils/ApiError";
import asyncHandler from "../utils/asyncHandler";
import { IUser, User } from "../models/user.model";
import { Document, Types } from "mongoose";

export interface AuthenticatedRequest extends Request {
    user: Document<unknown, {}, IUser> &
        IUser & {
            _id: Types.ObjectId;
        };
}

const isAuthenticated = asyncHandler(
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const token: string =
            req.cookies?.accessToken ||
            (req.headers?.authorization?.startsWith("Bearer ") &&
                req.headers.authorization.split(" ")[1]);

        if (!token) throw new ApiError(401, "No token, authorization denied");

        const payload = jwt.verify(
            token,
            process.env.ACCESS_TOKEN_SECRET as Secret
        ) as JwtPayload;

        const user = await User.findById(payload?._id).select(
            "-password -refreshToken"
        );

        if (!user) throw new ApiError(401, "Invalid Access Token");

        req.user = user;
        next();
    }
);

export default isAuthenticated;
