import { NextFunction, Request, Response } from "express";
import asyncHandler from "../utils/asyncHandler";
import ApiError from "../utils/ApiError";
import { User } from "../models/user.model";
import uploadOnCloudinary from "../utils/cloudinary";
import ApiResponse from "../utils/ApiResponse";
import generateTokens from "../utils/generateTokens";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { OPTIONS } from "../constants";

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
            { ...loggedInUser, accessToken, refreshToken },
            "Login successful"
        );
        res.status(200).json(apiResponse);
    }
);

export const logoutUser = asyncHandler(
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const user = req.user;

        if (!user) throw new ApiError(400, "Invalid User Id");

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
