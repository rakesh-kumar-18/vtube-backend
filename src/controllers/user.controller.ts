import { Request, Response } from "express";
import asyncHandler from "../utils/asyncHandler";
import ApiError from "../utils/ApiError";
import { User } from "../models/user.model";
import uploadOnCloudinary from "../utils/cloudinary";
import ApiResponse from "../utils/ApiResponse";

interface RequestBody {
    username: string;
    email: string;
    fullName: string;
    password: string;
}

interface MulterRequest extends Request {
    files: {
        [fieldName: string]: Express.Multer.File[];
    };
}

export const registerUser = asyncHandler(
    async (req: MulterRequest, res: Response) => {
        const { username, email, fullName, password }: RequestBody = req.body;

        if (
            [username, email, fullName, password].some(
                (field) => field.trim() === ""
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

        const avatarLocalPath = req.files?.avatar[0]?.path;
        const coverImageLocalPath = req.files?.coverImage[0]?.path;

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
