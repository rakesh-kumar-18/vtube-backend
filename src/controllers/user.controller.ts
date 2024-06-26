import { NextFunction, Request, Response } from "express";
import asyncHandler from "../utils/asyncHandler";
import ApiError from "../utils/ApiError";
import { IUser, User } from "../models/user.model";
import { deleteFromCloudinary, uploadOnCloudinary } from "../utils/cloudinary";
import ApiResponse from "../utils/ApiResponse";
import generateTokens from "../utils/generateTokens";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { OPTIONS } from "../constants";
import { TokenBlacklist } from "../models/tokenBlacklist.model";
import jwt, { JwtPayload, Secret } from "jsonwebtoken";
import { Types } from "mongoose";

interface RequestBody {
    username: string;
    email: string;
    fullName: string;
    password: string;
}

export interface MulterRequest extends Request {
    files: {
        [fieldName: string]: Express.Multer.File[];
    };
}

export const registerUser = asyncHandler(
    async (req: MulterRequest, res: Response, next: NextFunction) => {
        const { username, email, fullName, password }: RequestBody = req.body;

        const avatarLocalPath: string = req.files?.avatar?.[0]?.path;
        const coverImageLocalPath: string = req.files?.coverImage?.[0]?.path;

        if (
            [username, email, fullName, password].some(
                (field) => !field || field.trim() === ""
            )
        )
            throw new ApiError(400, "All fields are required");

        const isUserExist = await User.findOne({
            $or: [{ username }, { email }],
        });

        if (isUserExist)
            throw new ApiError(
                409,
                "User with this username or email already exist"
            );

        if (!avatarLocalPath)
            throw new ApiError(400, "Avatar file is required");

        const avatarResponse = await uploadOnCloudinary(avatarLocalPath);
        const coverImageResponse =
            await uploadOnCloudinary(coverImageLocalPath);

        if (!avatarResponse) throw new ApiError(400, "Avatar file is required");

        const avatarUrl = avatarResponse.url;
        const coverImageUrl = coverImageResponse?.url || "";
        const avatarId = avatarResponse.public_id;
        const coverImageId = coverImageResponse?.public_id || "";

        const user = await User.create({
            username: username.toLowerCase(),
            email,
            fullName,
            avatar: { url: avatarUrl, public_id: avatarId },
            coverImage: { url: coverImageUrl, public_id: coverImageId },
            password,
        });

        const createdUser = await User.findById(user._id).select(
            "-password -refreshToken"
        );

        if (!createdUser)
            throw new ApiError(
                500,
                "Something went wrong while registering the user"
            );

        const apiResponse = new ApiResponse<typeof createdUser>(
            201,
            createdUser,
            "User registered successfully"
        );
        res.status(201).json(apiResponse);
    }
);

export const loginUser = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const {
            username,
            password,
        }: Pick<RequestBody, "username" | "password"> = req.body;

        if ([username, password].some((field) => !field || field.trim() === ""))
            throw new ApiError(400, "All fields are required");

        const user = await User.findOne({ username });

        if (!user) throw new ApiError(401, "Invalid Credentials");

        const isPasswordValid = await user.isValidPassword(password);

        if (!isPasswordValid) throw new ApiError(401, "Invalid Credentials");

        const { accessToken, refreshToken } = await generateTokens(user);

        const loggedInUser = await User.findByIdAndUpdate(user._id, {
            refreshToken,
        }).select("-password -refreshToken");

        res.cookie("accessToken", accessToken, OPTIONS);
        res.cookie("refreshToken", refreshToken, OPTIONS);

        const apiResponse = new ApiResponse(
            200,
            { loggedInUser, accessToken, refreshToken },
            "Login successful"
        );
        res.status(200).json(apiResponse);
    }
);

export const logoutUser = asyncHandler(
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const user = req.user;

        if (!user) throw new ApiError(404, "User not found");

        const accessToken: string = req.cookies.accessToken;
        await TokenBlacklist.create({ token: accessToken });

        await User.findByIdAndUpdate(
            user._id,
            { refreshToken: null },
            { new: true }
        );

        res.clearCookie("accessToken", OPTIONS);
        res.clearCookie("refreshToken", OPTIONS);

        const apiResponse = new ApiResponse(200, {}, "Logout successful");
        res.status(200).json(apiResponse);
    }
);

export const refreshAccessToken = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const token: string =
            req.cookies?.refreshToken ||
            req.headers["authorization"]?.split(" ")[1];

        if (!token) throw new ApiError(401, "Refresh token is missing");

        try {
            const decoded = jwt.verify(
                token,
                process.env.REFRESH_TOKEN_SECRET as Secret
            ) as JwtPayload;

            const user = await User.findById(decoded?._id);

            if (!user || user.refreshToken !== token)
                throw new ApiError(401, "Invalid refresh token");

            const { accessToken } = await generateTokens(user);

            res.cookie("accessToken", accessToken, OPTIONS);
            const apiResponse = new ApiResponse(
                200,
                { accessToken },
                "Access token refresh"
            );
            res.status(200).json(apiResponse);
        } catch (error) {
            if (error instanceof Error)
                throw new ApiError(
                    401,
                    error.message || "Invalid refresh token"
                );
        }
    }
);

export const changePassword = asyncHandler(
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const {
            currPassword,
            newPassword,
            confPassword,
        }: { currPassword: string; newPassword: string; confPassword: string } =
            req.body;

        if (!currPassword.trim() || !newPassword.trim() || !confPassword.trim())
            throw new ApiError(400, "All fields are required");

        const user = (await User.findById(req.user?._id))!;

        if (!user) throw new ApiError(404, "User not found");

        const isPasswordValid = await user.isValidPassword(currPassword);

        if (!isPasswordValid)
            throw new ApiError(400, "Invalid current password");

        if (currPassword === newPassword)
            throw new ApiError(
                400,
                "New password can't be same as old password"
            );

        if (newPassword !== confPassword)
            throw new ApiError(
                400,
                "Both new and confirm password field should match"
            );

        user.password = newPassword;
        await user.save({ validateBeforeSave: false });

        const apiResponse = new ApiResponse(
            200,
            {},
            "Password changed successfully"
        );
        res.status(200).json(apiResponse);
    }
);

export const getCurrentUser = asyncHandler(
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const user = req.user;

        if (!user) throw new ApiError(404, "User not found");

        const apiResponse = new ApiResponse(
            200,
            user,
            "Current user fetched successfully"
        );
        res.status(200).json(apiResponse);
    }
);

export const updateAccountDetails = asyncHandler(
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const { fullName, email } = req.body;

        if (!fullName.trim() && !email.trim())
            throw new ApiError(400, "At least one field must be provided");

        const updateFields: Partial<IUser> = {};
        if (fullName.trim()) updateFields.fullName = fullName;
        if (email.trim()) updateFields.email = email;

        const user = await User.findByIdAndUpdate(req.user?.id, updateFields, {
            new: true,
        }).select("-password -refreshToken");

        if (!user) throw new ApiError(404, "User not found");

        const apiResponse = new ApiResponse(
            200,
            user,
            "Account details updated successfully"
        );
        res.status(200).json(apiResponse);
    }
);

export const updateUserAvatar = asyncHandler(
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const avatarLocalPath = req.file?.path;

        if (!avatarLocalPath)
            throw new ApiError(400, "Avatar file is required");

        const avatarResponse = await uploadOnCloudinary(avatarLocalPath);

        if (!avatarResponse) throw new ApiError(400, "Avatar file is required");

        const avatarUrl = avatarResponse.url;
        const avatarId = avatarResponse.public_id;

        const oldAvatarId = req.user?.avatar.public_id;

        const user = await User.findByIdAndUpdate(
            req.user?._id,
            { avatar: { url: avatarUrl, public_id: avatarId } },
            { new: true }
        ).select("-password -refreshToken");

        if (!user) throw new ApiError(404, "User not found");

        await deleteFromCloudinary(oldAvatarId);

        const apiResponse = new ApiResponse(
            200,
            user,
            "Avatar image updated successfully"
        );
        res.status(200).json(apiResponse);
    }
);

export const updateUserCoverImage = asyncHandler(
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const coverImageLocalPath = req.file?.path;

        if (!coverImageLocalPath)
            throw new ApiError(400, "Cover image file is required");

        const coverImageResponse =
            await uploadOnCloudinary(coverImageLocalPath);

        if (!coverImageResponse)
            throw new ApiError(400, "Cover image file is required");

        const coverImageUrl = coverImageResponse.url;
        const coverImageId = coverImageResponse.public_id;

        const oldCoverImageId = req.user?.coverImage?.public_id;

        const user = await User.findByIdAndUpdate(
            req.user?._id,
            { coverImage: { url: coverImageUrl, public_id: coverImageId } },
            { new: true }
        ).select("-password -refreshToken");

        if (!user) throw new ApiError(404, "User not found");

        await deleteFromCloudinary(oldCoverImageId);

        const apiResponse = new ApiResponse(
            200,
            user,
            "Cover image updated successfully"
        );
        res.status(200).json(apiResponse);
    }
);

export const getChannelDetails = asyncHandler(
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const { username } = req.params;

        if (!username?.trim()) throw new ApiError(400, "username is missing");

        const channel = await User.aggregate([
            {
                $match: { username: username?.toLowerCase() },
            },
            {
                $lookup: {
                    from: "subscriptions",
                    localField: "_id",
                    foreignField: "channel",
                    as: "subscribers",
                },
            },
            {
                $lookup: {
                    from: "subscriptions",
                    localField: "_id",
                    foreignField: "subscriber",
                    as: "subscribedTo",
                },
            },
            {
                $addFields: {
                    totalSubscribers: { $size: "$subscribers" },
                    totalSubscribedTo: { $size: "$subscribedTo" },
                    isSubscribed: {
                        $cond: {
                            if: {
                                $in: [req.user?._id, "$subscribers.subscriber"],
                            },
                            then: true,
                            else: false,
                        },
                    },
                },
            },
            {
                $project: {
                    username: 1,
                    fullName: 1,
                    avatar: 1,
                    coverImage: 1,
                    totalSubscribers: 1,
                    totalSubscribedTo: 1,
                    isSubscribed: 1,
                },
            },
        ]);

        console.log(channel);

        if (!channel?.length)
            throw new ApiError(404, "channel does not exists");

        const apiResponse = new ApiResponse(
            200,
            channel[0],
            "channel details fetched successfully"
        );
        res.status(200).json(apiResponse);
    }
);

export const getWatchHistory = asyncHandler(
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const user = await User.aggregate([
            {
                $match: {
                    _id: new Types.ObjectId(req.user._id as string),
                },
            },
            {
                $lookup: {
                    from: "videos",
                    localField: "watchHistory",
                    foreignField: "_id",
                    as: "watchHistory",
                    pipeline: [
                        {
                            $lookup: {
                                from: "users",
                                localField: "owner",
                                foreignField: "_id",
                                as: "owner",
                                pipeline: [
                                    {
                                        $project: {
                                            username: 1,
                                            fullName: 1,
                                            avatar: 1,
                                        },
                                    },
                                ],
                            },
                        },
                        {
                            $addFields: {
                                owner: { $first: "$owner" },
                            },
                        },
                    ],
                },
            },
        ]);

        console.log(user);

        const apiResponse = new ApiResponse(
            200,
            user[0]?.watchHistory,
            "watch history fetched successfully"
        );
        res.status(200).json(apiResponse);
    }
);
