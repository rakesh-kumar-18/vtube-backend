import { NextFunction, Request, Response } from "express";
import asyncHandler from "../utils/asyncHandler";
import ApiError from "../utils/ApiError";
import { IUser, User } from "../models/user.model";
import uploadOnCloudinary from "../utils/cloudinary";
import ApiResponse from "../utils/ApiResponse";
import generateTokens from "../utils/generateTokens";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { OPTIONS } from "../constants";
import { TokenBlacklist } from "../models/tokenBlacklist.model";
import jwt, { JwtPayload, Secret } from "jsonwebtoken";

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

        const avatar = avatarResponse.url;
        const coverImage = coverImageResponse?.url || "";

        const user = await User.create({
            username: username.toLowerCase(),
            email,
            fullName,
            avatar,
            coverImage,
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
        const { currPassword, newPassword, confPassword } = req.body;

        if (!currPassword || !newPassword || !confPassword)
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

        const avatar = avatarResponse.url;

        const user = User.findByIdAndUpdate(
            req.user?._id,
            { avatar },
            { new: true }
        ).select("-password -refreshToken");

        if (!user) throw new ApiError(404, "User not found");

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

        const coverImage = coverImageResponse.url;

        const user = User.findByIdAndUpdate(
            req.user?._id,
            { coverImage },
            { new: true }
        ).select("-password -refreshToken");

        if (!user) throw new ApiError(404, "User not found");

        const apiResponse = new ApiResponse(
            200,
            user,
            "Cover image updated successfully"
        );
        res.status(200).json(apiResponse);
    }
);
